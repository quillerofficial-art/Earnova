import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import logger from '../utils/logger';

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ सीधे supabaseAdmin का उपयोग करें (RLS बायपास)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('subscription_status, subscription_expiry, level')
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // ✅ लेवल 1+ फ्री
    if (user.level >= 1) {
      return next();
    }

    // ✅ लेवल 0 के लिए सब्सक्रिप्शन चेक
    const isActive = user.subscription_status === true &&
                     (user.subscription_expiry === null || new Date(user.subscription_expiry) > new Date());

    if (!isActive) {
      // ✅ अब 403 सही से आएगा
      return res.status(403).json({ message: 'Subscription required. Please subscribe to continue.' });
    }

    next();
  } catch (err) {
    logger.error('Error in requireActiveSubscription:', { error: err, userId: req.user?.id });
    res.status(500).json({ message: 'Server error' });
  }
};