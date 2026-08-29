import { Router } from 'express';
import {
  register,
  verifyOtpAndLogin,
  resendOtp,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authRateLimiter, resendOtpLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Strict rate limit on the brute-force-prone routes.
router.post('/register', authRateLimiter, register);
router.post('/verify-otp', authRateLimiter, verifyOtpAndLogin);
router.post('/resend-otp', resendOtpLimiter, resendOtp);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', resendOtpLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.post('/change-password', authRateLimiter, protect, changePassword);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
