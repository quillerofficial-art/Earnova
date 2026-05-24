import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import logger from '../utils/logger'

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_status, subscription_expiry')
      .eq('id', req.user!.id)
      .single()

    if (error || !user) {
      return res.status(401).json({ message: 'User not found' })
    }

    const isActive = user.subscription_status === true &&
                     (user.subscription_expiry === null || new Date(user.subscription_expiry) > new Date())

    if (!isActive) {
      return res.status(403).json({ message: 'Subscription required. Please subscribe to continue.' })
    }

    next()
  } catch (err) {
    logger.error('Error in requireActiveSubscription:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Server error' })
  }
}