import express from 'express'
import { getPlans, upsertPlan, deletePlan } from '../controllers/plan.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { adminMiddleware } from '../middlewares/admin.middleware'

const router = express.Router()

// Public: get plans (any authenticated user)
router.get('/', authMiddleware, getPlans)

// Admin routes
router.post('/', authMiddleware, adminMiddleware, upsertPlan)
router.put('/:id', authMiddleware, adminMiddleware, upsertPlan)
router.delete('/:id', authMiddleware, adminMiddleware, deletePlan)

export default router