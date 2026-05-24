import { v4 as uuidv4 } from 'uuid'
import { Request, Response, NextFunction } from 'express'

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4()
  req.headers['x-request-id'] = requestId
  res.setHeader('x-request-id', requestId)
  next()
}