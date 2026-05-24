import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'  // ✅ Add this line

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  upi_id: z.string().optional(),
  mobile_number: z.string().regex(/^[0-9]{10}$/).optional(),
})

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