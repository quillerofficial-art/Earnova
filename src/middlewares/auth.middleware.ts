import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }

  req.user = { id: user.id, email: user.email! }
  next()
}