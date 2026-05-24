import express from 'express'
import { getAllUsers, deleteUser, sendNotification, getNotifications, getDashboardStats, getInactiveUsers, sendNotificationToAll, broadcastNotification } from '../controllers/admin.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { adminMiddleware } from '../middlewares/admin.middleware'

const router = express.Router()

router.use(authMiddleware, adminMiddleware)

router.get('/users', getAllUsers)
router.delete('/users/:id', deleteUser)
router.post('/notifications', sendNotification)
router.get('/notifications', getNotifications)
router.get('/dashboard-stats', getDashboardStats)
router.get('/inactive-users', getInactiveUsers);
router.post('/notifications/all', sendNotificationToAll);
router.post('/notifications/broadcast', broadcastNotification);
export default router