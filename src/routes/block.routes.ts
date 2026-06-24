import express from 'express';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
router.use(authMiddleware);

router.post('/', blockUser);
router.delete('/:userId', unblockUser);
router.get('/', getBlockedUsers);

export default router;