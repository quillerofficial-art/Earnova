import express from 'express';
import { verifyGooglePurchase } from '../controllers/googlePlay.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);
router.post('/verify-purchase', verifyGooglePurchase);

export default router;