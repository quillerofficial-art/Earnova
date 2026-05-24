import 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
      }
    }
  }
}

export interface SubscriptionPlan {
  id: string
  name: string
  duration_months: number
  amount: number
  is_active: boolean
}
export {}