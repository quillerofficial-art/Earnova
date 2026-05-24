import fs from 'fs';
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}
import express from 'express'
import { handleWebhook } from './controllers/payment.controller';
import dotenv from 'dotenv'
import './types'
import { validateEnv } from './config/validateEnv'
import helmet from 'helmet'
import cors from 'cors'
import { apiRateLimiter } from './middlewares/rateLimit.middleware';
import { requestIdMiddleware } from './middlewares/requestId.middleware'
import { errorHandler } from './middlewares/error.middleware'
import cron from 'node-cron';
import { supabase } from './config/supabase';

dotenv.config()


// Import routes
import healthRoutes from './routes/health.routes'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import treeRoutes from './routes/tree.routes'
import adminRoutes from './routes/admin.routes'
import paymentRoutes from './routes/payment.routes'
import postRoutes from './routes/post.routes'
import planRoutes from './routes/plan.routes'
import productRoutes from './routes/product.routes'
import inviteRoutes from './routes/invite.routes'

validateEnv()

const app = express()

app.use(helmet())
app.use(apiRateLimiter);
app.set('trust proxy', 1) // Trust first proxy (Render)
const PORT = process.env.PORT || 8000

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public')) // For serving invite page assets
app.use(requestIdMiddleware)

// Routes
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/tree', treeRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/products', productRoutes)
app.use('/invite', inviteRoutes)

// Error handling middleware (should be last)
app.use(errorHandler)

// Har raat 2:00 baje purane orders delete karo
cron.schedule('0 2 * * *', async () => {
  console.log('Deleting old payment transactions...');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { error } = await supabase
    .from('payment_transactions')
    .delete()
    .in('status', ['created', 'expired', 'failed'])
    .lt('created_at', thirtyDaysAgo.toISOString());
    
  if (error) {
    console.error('Cleanup failed:', error);
  } else {
    console.log('Old orders cleaned up');
  }
});

// Delete notifications older than 7 days
cron.schedule('0 2 * * *', async () => {
  console.log('Deleting old notifications...');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  try {
    // First delete from user_notifications (if no cascade)
    const { error: userNotifError } = await supabase
      .from('user_notifications')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());
    
    if (userNotifError) {
      console.error('Error deleting user_notifications:', userNotifError);
    }
    
    // Then delete from notifications
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());
    
    if (notifError) {
      console.error('Error deleting notifications:', notifError);
    } else {
      console.log('Old notifications cleaned up');
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})