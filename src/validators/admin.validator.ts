import { z } from 'zod'

export const sendNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()),
  title: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
})