import express from 'express';
import { createReport } from '../controllers/report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
router.use(authMiddleware);

router.post('/', createReport);

export default router;