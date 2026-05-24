import express from 'express';
import {
  getProductsByCategory,
  createBannerProduct,
  createFeaturedProduct,
  createNewArrivalProduct,
  updateProduct,
  deleteProduct
} from '../controllers/product.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { uploadProductImage } from '../middlewares/upload.middleware';

const router = express.Router();

// Public routes (authenticated users can view products)
router.get('/category/:category', authMiddleware, getProductsByCategory);

// Admin routes
router.post('/banner', authMiddleware, adminMiddleware, uploadProductImage, createBannerProduct);
router.post('/featured', authMiddleware, adminMiddleware, uploadProductImage, createFeaturedProduct);
router.post('/new-arrival', authMiddleware, adminMiddleware, uploadProductImage, createNewArrivalProduct);
router.put('/:id', authMiddleware, adminMiddleware, uploadProductImage, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);

export default router;