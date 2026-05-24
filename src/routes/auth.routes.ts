import express from 'express'
import { changePassword, sendOtp, signup, login, forgotPassword, getReferrerInfo, logout, verifyToken, verifyOtp } from '../controllers/auth.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { authRateLimiter, otpRateLimiter } from '../middlewares/rateLimit.middleware'
import { validate, signupSchema, loginSchema, changePasswordSchema, sendOtpSchema } from '../validators/auth.validator'
import { resetPassword } from '../controllers/auth.controller';
import { refreshToken } from '../controllers/auth.controller';

const router = express.Router()

router.post('/send-otp', otpRateLimiter, validate(sendOtpSchema), sendOtp);
router.post('/signup', authRateLimiter, validate(signupSchema), signup)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword)
router.post('/login', login)
router.get('/referrer-info', getReferrerInfo)
router.post('/forgot-password', forgotPassword)
router.post('/logout', authMiddleware, logout)
router.get('/verify', authMiddleware, verifyToken)
router.post('/reset-password', resetPassword);
router.post('/verify-otp', otpRateLimiter, verifyOtp);
router.post('/refresh', refreshToken);

export default router