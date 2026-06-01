import express from 'express';
import { searchUsers } from '../controllers/search.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);
router.get('/users', searchUsers);

export default router;