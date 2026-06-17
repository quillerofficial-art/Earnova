import express from 'express'
import { generateInvite, getRoot, getChildren, searchDownline } from '../controllers/tree.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireActiveSubscription } from '../middlewares/subscription.middleware'

const router = express.Router()

router.use(authMiddleware)
router.use(requireActiveSubscription)

router.post('/generate-invite', generateInvite)
router.get('/root', getRoot)
router.get('/node/:nodeId/children', getChildren)
router.get('/search', searchDownline);


export default router