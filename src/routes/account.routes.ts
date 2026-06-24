import express from 'express';
import { deleteAccount } from '../controllers/account.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
router.use(authMiddleware);

router.delete('/', deleteAccount);

export default router;