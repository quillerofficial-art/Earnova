import express from 'express';
import { searchPosts, searchUsers } from '../controllers/search.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);
router.get('/users', searchUsers);
router.get('/posts', searchPosts);        // ✅ नया (पोस्ट सर्च)

export default router;