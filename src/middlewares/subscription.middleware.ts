import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { verifyPurchase } from '../services/googlePlay.service';
import logger from '../utils/logger';

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // ✅ 1. User fetch करो
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('subscription_status, subscription_expiry, level')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // ✅ 2. Level 1+ = Lifetime Free
    if (user.level >= 1) {
      return next();
    }

    // ✅ 3. DB Expiry Check (Normal Fast Path)
    const now = new Date();
    const dbExpiry = user.subscription_expiry ? new Date(user.subscription_expiry) : null;
    const dbIsActive = user.subscription_status === true && (dbExpiry === null || dbExpiry > now);

    // 🔥 4. अगर DB Active है → तुरंत Access दो (Fast Path - कोई API Call नहीं)
    if (dbIsActive) {
      return next();
    }

    // ⚠️ 5. DB Inactive है → Google Play से Real-time पूछो (1 Last Chance)
    logger.info(`🔄 [REALTIME] DB subscription expired for user ${userId}. Checking Google Play API...`);

    // 5a. User की Latest Google Play Subscription Transaction fetch करो
    const { data: tx, error: txError } = await supabaseAdmin
      .from('payment_transactions')
      .select('product_id, purchase_token')
      .eq('user_id', userId)
      .eq('platform', 'google_play')
      .eq('type', 'subscription')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // ✅ maybeSingle() use karo (no error if no record)

    // अगर कोई Google Play Transaction नहीं है → Real Block
    if (txError || !tx || !tx.purchase_token) {
      logger.warn(`⛔ No Google Play transaction found for user ${userId}. Blocking.`);
      return res.status(403).json({ message: 'Subscription required. Please subscribe to continue.' });
    }

    // 5b. Google Play API से Real-time Verify करो
    let result;
    try {
      result = await verifyPurchase(tx.product_id, tx.purchase_token, true);
    } catch (err) {
      logger.error(`❌ Google Play API error for user ${userId}:`, err);
      // API Fail होने पर Safe Side रहो – Block करो
      return res.status(403).json({ message: 'Subscription verification failed. Please contact support.' });
    }

    // 5c. Google API Result Check
    if (!result.isValid || !result.expiryTime) {
      logger.warn(`⛔ Google Play says INVALID for user ${userId}. Blocking.`);
      return res.status(403).json({ message: 'Subscription required. Please subscribe to continue.' });
    }

    const googleExpiry = new Date(Number(result.expiryTime));

    // 5d. अगर Google Expiry Future में है → DB Update करो और Access दो! 🎉
    if (googleExpiry > now) {
      // ✅ DB Update करो (ताकि अगली बार Fast Path लगे)
      await supabaseAdmin
        .from('users')
        .update({
          subscription_status: true,
          subscription_expiry: googleExpiry.toISOString(),
        })
        .eq('id', userId);

      logger.info(`✅ [REALTIME] Google Play says ACTIVE for user ${userId}. Updated expiry to ${googleExpiry.toISOString()}`);
      return next(); // ✅ Access दो!
    } else {
      // ❌ Google Expiry भी Past है → Real Block
      logger.warn(`⛔ Google Play expiry is past (${googleExpiry.toISOString()}) for user ${userId}. Blocking.`);
      return res.status(403).json({ message: 'Subscription expired. Please renew to continue.' });
    }

  } catch (err) {
    logger.error('Error in requireActiveSubscription:', { error: err, userId: req.user?.id });
    // Error आने पर Safe Side रहो – Block करो
    return res.status(500).json({ message: 'Server error while verifying subscription' });
  }
};