import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import { UserRole } from '../types/enums'
import logger from '../utils/logger'

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user!.id)
      .single()

  if (error || !user) {
      return res.status(403).json({ message: 'Access denied' })
    }

     if (user.role?.toLowerCase() !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Access denied. Admin only.' })
    }
    
    next()
  } catch (err) {
    logger.error('Error in adminMiddleware:', { error: err, userId: req.user?.id })
    res.status(500).json({ message: 'Server error' })
  }
}