import jwt from 'jsonwebtoken';
import { COOKIE_NAME } from '../utils/generateToken.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// In-memory map: userId -> Set<socketId>. A user can have multiple
// sockets open (laptop + phone), so we keep a set per user.
const onlineUsers = new Map();

export function setupSocketIO(io) {
  // Make the io instance available to the helper functions below so
  // controllers elsewhere in the app can emit without a circular import.
  registerIO(io);

  // ---- Auth middleware -------------------------------------------------
  // Verifies the JWT from the httpOnly cookie on the initial handshake.
  // Without this, anyone could connect and listen to any room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie;

    // The cookie header is the raw string — parse out our cookie.
    let jwtToken = socket.handshake.auth?.token;
    if (!jwtToken && socket.handshake.headers?.cookie) {
      const cookies = Object.fromEntries(
        socket.handshake.headers.cookie.split('; ').map((c) => {
          const [k, ...v] = c.split('=');
          return [k, v.join('=')];
        })
      );
      jwtToken = cookies[COOKIE_NAME];
    }

    if (!jwtToken) {
      return next(new Error('Not authenticated'));
    }

    try {
      const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid or expired session'));
    }
  });

  // ---- Connection handler ---------------------------------------------
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Track this socket under the user's set.
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join a personal room named after the user's ID so any server-side
    // code can emit to them without knowing their socket IDs.
    socket.join(`user:${userId}`);

    // ---- Join a conversation room ----
    // Verified server-side: the user must be a participant.
    socket.on('conversation:join', async (conversationId) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv) return;
        const isParticipant = conv.participants.some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;
        socket.join(`conversation:${conversationId}`);
      } catch {
        // Ignore — bad payload.
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ---- Typing indicator ----
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        isTyping
      });
    });

    // ---- Mark messages as read ----
    // The REST endpoint already handles the DB write; this just broadcasts
    // the "read" event so the other party's UI updates in real time.
    socket.on('messages:read', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('messages:read', {
        conversationId,
        userId
      });
    });

    // ---- Disconnect ----
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) onlineUsers.delete(userId);
      }
    });
  });
}

// ---- Helper functions for the rest of the backend -----------------------
// Called by messageController / orderController / adminController to push
// real-time events to a specific user (across all their open sockets).

export function emitToUser(userId, event, payload) {
  if (globalThis.__io) {
    globalThis.__io.to(`user:${String(userId)}`).emit(event, payload);
  }
}

export function emitToConversation(conversationId, event, payload) {
  if (globalThis.__io) {
    globalThis.__io.to(`conversation:${String(conversationId)}`).emit(event, payload);
  }
}

export function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

// Called from server.js after the io instance is created so these helpers
// can reference it without a circular import.
export function registerIO(ioInstance) {
  globalThis.__io = ioInstance;
}
