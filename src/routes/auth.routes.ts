import express from 'express'
import { changePassword, sendOtp, signup, login, resetPasswordWithOtp, getReferrerInfo, logout, verifyToken, verifyOtp } from '../controllers/auth.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { authRateLimiter, otpRateLimiter } from '../middlewares/rateLimit.middleware'
import { validate, signupSchema, loginSchema, changePasswordSchema, sendOtpSchema } from '../validators/auth.validator'
import { refreshToken } from '../controllers/auth.controller';

const router = express.Router()

router.post('/send-otp', otpRateLimiter, validate(sendOtpSchema), sendOtp);
router.post('/signup', authRateLimiter, validate(signupSchema), signup)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword)
router.post('/login', login)
router.get('/referrer-info', getReferrerInfo)
// ✅ OTP Routes (Already existing - Use these)
router.post('/send-otp', otpRateLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtp);

// ✅ New Forgot Password Route (OTP Based)
router.post('/reset-password-otp', resetPasswordWithOtp); // <-- Naya Route
router.post('/logout', authMiddleware, logout)
router.get('/verify', authMiddleware, verifyToken)
router.post('/verify-otp', otpRateLimiter, verifyOtp);
router.post('/refresh', refreshToken);

export default router