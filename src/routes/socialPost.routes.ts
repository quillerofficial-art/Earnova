import express from 'express';
import {
  createPost,
  getFeed,
  toggleLike,
  addComment,
  getComments,
  editPost,
  deletePost,
  getUserPosts,
  getReels
} from '../controllers/socialPost.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadPostMedia } from '../middlewares/upload.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
// Optional: if you want only active subscribers to post
router.use(requireActiveSubscription);

router.post('/', uploadPostMedia, createPost);
router.get('/feed', getFeed);
router.get('/reels', getReels);
router.get('/user/:userId', getUserPosts);
router.post('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.get('/:id/comments', getComments);
router.put('/:id', editPost);
router.delete('/:id', deletePost);

export default router;