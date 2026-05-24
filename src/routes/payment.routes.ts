import express, { NextFunction, Request, Response } from 'express'
import { createSubscription, getPaymentStatus, verifyPayment } from '../controllers/payment.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { validate, createSubscriptionSchema } from '../validators/payment.validator'


const router = express.Router()


router.get('/status/:orderId', authMiddleware, getPaymentStatus);
router.post('/create-subscription', authMiddleware, validate(createSubscriptionSchema), createSubscription)


export default router