import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { guardObjectId } from '../middleware/validateObjectId.js';
import { emitToUser, emitToConversation } from '../realtime/socket.js';

// GET /api/messages/conversations?page=&limit=
// QD-024 — Paginated. Limit capped at 50.
export const getMyConversations = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const filter = { participants: req.user._id };
  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .populate('participants', 'name avatarUrl')
      .populate('listing', 'title images price')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(filter)
  ]);
  res.json({ conversations, total, page, pages: Math.ceil(total / limit) });
});

// POST /api/messages/conversations
// QD-011 — guardObjectId on recipientId (body) and listingId (body, optional).
export const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, listingId } = req.body;
  if (!recipientId) {
    res.status(400);
    throw new Error('recipientId is required');
  }
  guardObjectId(recipientId, 'recipientId', res);
  if (listingId) guardObjectId(listingId, 'listingId', res);
  if (recipientId === String(req.user._id)) {
    res.status(400);
    throw new Error("You can't message yourself");
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, recipientId], $size: 2 },
    listing: listingId || null
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, recipientId],
      listing: listingId || null
    });
  }

  // Populate so the response matches the list shape.
  conversation = await conversation.populate('participants', 'name avatarUrl');
  conversation = await conversation.populate('listing', 'title images price');

  res.status(201).json({ conversation });
});

// GET /api/messages/conversations/:id?page=&limit=&before=
// QD-011 — guardObjectId on req.params.id.
// QD-024 — Paginated. Limit capped at 50. Supports cursor-based
// pagination via `?before=<messageId>` for infinite-scroll UIs.
//
// THIRD-PASS FIX (caught in second-pass audit) — the original `total`
// and `pages` fields used the FULL conversation count, ignoring the
// cursor filter. We now count with the same filter so the response
// reflects the actual remaining-older-message count for infinite-scroll
// "load more" decisions. When `?before=` is set, we ignore `page`/`skip`
// (the cursor replaces page-based).
export const getMessages = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => String(p) === String(req.user._id))) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const useCursor = Boolean(req.query.before);

  // Cursor-based: filter by _id < before, ignore page/skip.
  // Page-based: use skip = (page-1) * limit.
  const filter = { conversation: conversation._id };
  if (useCursor) {
    guardObjectId(req.query.before, 'before', res);
    filter._id = { $lt: req.query.before };
  }
  const skip = useCursor ? 0 : (Math.max(1, Number(req.query.page) || 1) - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .populate('sender', 'name avatarUrl')
      .sort({ createdAt: -1 }) // newest first when cursor-paginating
      .skip(skip)
      .limit(limit),
    // Count uses the same filter so cursor mode reflects "remaining
    // older messages" and page mode reflects the full conversation.
    Message.countDocuments(filter)
  ]);

  // Flip to oldest-first for the response so the chat reads naturally.
  const ordered = messages.reverse();

  const page = useCursor ? 1 : Math.max(1, Number(req.query.page) || 1);
  res.json({
    messages: ordered,
    total,
    page,
    pages: useCursor ? 1 : Math.ceil(total / limit),
    // `hasMore` is the cursor-mode signal for infinite-scroll.
    hasMore: messages.length === limit
  });
});

// POST /api/messages/conversations/:id
// QD-011 — guardObjectId on req.params.id.
export const sendMessage = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const { text } = req.body;
  if (!text?.trim()) {
    res.status(400);
    throw new Error('Message text is required');
  }
  if (text.length > 2000) {
    res.status(400);
    throw new Error('Messages are limited to 2000 characters');
  }

  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => String(p) === String(req.user._id))) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  let message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text: text.trim(),
    readBy: [req.user._id]
  });
  message = await message.populate('sender', 'name avatarUrl');

  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Real-time delivery: emit to the conversation room (both participants
  // who have it open) + to each participant's personal room (for the
  // conversation-list preview update).
  emitToConversation(conversation._id, 'message:new', { conversationId: conversation._id, message });

  // The other participant(s) get a conversation-list update event so their
  // sidebar re-orders to put this conversation on top.
  const otherIds = conversation.participants
    .filter((p) => String(p) !== String(req.user._id))
    .map(String);
  for (const otherId of otherIds) {
    emitToUser(otherId, 'conversation:updated', {
      conversationId: conversation._id,
      lastMessageAt: conversation.lastMessageAt,
      preview: message.text
    });
  }

  res.status(201).json({ message });
});

// PATCH /api/messages/conversations/:id/read
// Marks all messages in the conversation as read by the current user.
// QD-011 — guardObjectId on req.params.id.
export const markRead = asyncHandler(async (req, res) => {
  guardObjectId(req.params.id, 'id', res);
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => String(p) === String(req.user._id))) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  await Message.updateMany(
    { conversation: conversation._id, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );

  // Let the other participant know their messages were read.
  const otherIds = conversation.participants
    .filter((p) => String(p) !== String(req.user._id))
    .map(String);
  for (const otherId of otherIds) {
    emitToUser(otherId, 'messages:read', { conversationId: conversation._id, userId: req.user._id });
  }

  res.json({ message: 'Marked as read' });
});
