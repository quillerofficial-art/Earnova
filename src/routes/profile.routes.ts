import express from 'express';
import { getMyProfile, getUserProfile, updateMyProfile } from '../controllers/profile.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getMyProfile);
router.get('/:userId', getUserProfile);
router.put('/me', updateMyProfile);

export default router;