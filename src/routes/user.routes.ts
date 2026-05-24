import express from 'express'
import { getProfile, updateProfile, getNotifications, markNotificationRead, getUserById } from '../controllers/user.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { uploadProfilePic } from '../controllers/upload.controller'
import { uploadSingle } from '../middlewares/upload.middleware'
import { requireActiveSubscription } from '../middlewares/subscription.middleware'
import { validate, updateProfileSchema } from '../validators/user.validator'

const router = express.Router()

router.use(authMiddleware)
router.use(requireActiveSubscription)

router.get('/profile', getProfile)
router.put('/profile', validate(updateProfileSchema), updateProfile)
router.get('/notifications', getNotifications)
router.put('/notifications/:id/read', markNotificationRead)
router.post('/profile-pic', uploadSingle, uploadProfilePic)
router.get('/:id', getUserById)

export default router