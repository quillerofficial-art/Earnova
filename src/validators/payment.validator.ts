import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID format'),
})

import { Request, Response, NextFunction } from 'express'

export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error: any) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors.map((e: any) => e.message) 
      })
    }
  }
}