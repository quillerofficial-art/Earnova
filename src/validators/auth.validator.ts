import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'

export const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  upi_id: z.string().optional(),
  mobile_number: z.string().regex(/^[0-9]{10}$/, 'Invalid mobile number').optional(),
  token: z.string().min(1, 'Token is required'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  purpose: z.enum(['signup', 'forgot']),
})

// ✅ FIX: Create validation middleware
export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: any) {
      // Zod error format
      const errors = error.errors?.map((e: any) => e.message) || 
                     error.issues?.map((e: any) => e.message) || 
                     [error.message || 'Validation error'];
      return res.status(400).json({
        message: 'Validation error',
        errors,
      });
    }
  };
};