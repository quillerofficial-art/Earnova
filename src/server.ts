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
import { supabase, supabaseAdmin } from './config/supabase';
import profileRoutes from './routes/profile.routes';
import searchRoutes from './routes/search.routes';
import socialPostRoutes from './routes/socialPost.routes';
import notificationRoutes from './routes/notification.routes';
import { initFirebase } from './utils/notifications';
import { sendPushNotification } from './utils/notifications';

initFirebase();
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
app.use('/api/social-posts', socialPostRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

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
// Delete notifications older than 7 days (using supabaseAdmin to bypass RLS)
cron.schedule('0 2 * * *', async () => {
  console.log('Deleting old notifications...');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  try {
    // 1. पहले user_notifications से डिलीट करें
    const { error: userNotifError, count } = await supabaseAdmin
      .from('user_notifications')
      .delete({ count: 'exact' })
      .lt('created_at', sevenDaysAgo.toISOString());
    
    if (userNotifError) {
      console.error('Error deleting user_notifications:', userNotifError);
    } else {
      console.log(`✅ Deleted ${count} old user_notifications`);
    }
    
    // 2. फिर notifications टेबल से डिलीट करें
    const { error: notifError, count: notifCount } = await supabaseAdmin
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('created_at', sevenDaysAgo.toISOString());
    
    if (notifError) {
      console.error('Error deleting notifications:', notifError);
    } else {
      console.log(`✅ Deleted ${notifCount} old notifications`);
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
});

// हर रात 12:00 बजे (UTC) – स्ट्रीक रीसेट
cron.schedule('0 0 * * *', async () => {
  console.log('Running streak reset...');
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const { error } = await supabaseAdmin
    .from('users')
    .update({ streak: 0 })
    .neq('last_post_date', yesterdayStr); // जिन्होंने कल पोस्ट नहीं की
  if (error) {
    console.error('Streak reset error:', error);
  } else {
    console.log('Streak reset completed');
  }
});

// Subscription expiry / inactivity reminder (daily at 9:00 AM)
cron.schedule('0 9 * * *', async () => {
  console.log('Running subscription reminder check...');
  try {
    // Users who are either:
    // 1) not subscribed (subscription_status = false) AND (expiry passed OR last_post_date older than 4 days)
    // 2) reminder_sent = false
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('is_deleted', false)
      .eq('reminder_sent', false)
      .or(`subscription_status.eq.false,and(subscription_expiry.lt.${new Date().toISOString()}),and(last_post_date.lt.${new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()},subscription_status.eq.false)`);

    if (error) {
      console.error('Reminder fetch error:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('No users need reminder today.');
      return;
    }

    console.log(`Sending reminder to ${users.length} users...`);
    for (const user of users) {
      await sendPushNotification(
        user.id,
        '⏰ Subscription Needed',
        'Your subscription has expired or you have been inactive. Subscribe now to continue enjoying Poster!'
      );
      // Mark reminder as sent
      await supabaseAdmin.from('users').update({ reminder_sent: true }).eq('id', user.id);
    }
    console.log('Reminder notifications sent.');
  } catch (err) {
    console.error('Reminder cron error:', err);
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})