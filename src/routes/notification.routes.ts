import express from 'express';
import { registerDevice } from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
router.use(authMiddleware);
router.post('/register-device', registerDevice);

export default router;