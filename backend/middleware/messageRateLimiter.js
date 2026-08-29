import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

// QD-resource-limit — per-conversation message rate limit.
//
// Without this, a malicious user could spam a conversation with
// thousands of messages per second, bloating the Message collection
// and the conversation's lastMessageAt field. We rate-limit at
// 30 messages / minute per (user, conversation) pair.
//
// Uses the in-memory store by default; if a Redis store is configured
// at the global level, this limiter doesn't share state across
// instances (it's per-process). For 99% of conversations that's
// fine — the worst case is N× the budget under multi-instance deploy.
// If we need shared state, we can wire the same RedisStore here.

export const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per (user, conversation) per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || req.ip}:${req.params.id}`,
  message: { message: 'You are sending messages too fast. Please slow down.' }
});

// Per-user conversation-start rate limit — prevents creating
// thousands of throwaway conversations to spam different sellers.
export const conversationStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 new conversations per user per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { message: 'You have started too many conversations. Please try again later.' }
});
