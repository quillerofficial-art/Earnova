import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import { verifyPurchase, acknowledgePurchase } from '../services/googlePlay.service';
import logger from '../utils/logger';

export const verifyGooglePurchase = async (req: Request, res: Response) => {
  const { productId, purchaseToken, isSubscription } = req.body;
  const userId = req.user!.id;

  if (!productId || !purchaseToken) {
    return errorResponse(res, 'productId and purchaseToken are required');
  }

  try {
    // 1️⃣ Verify purchase
    const result = await verifyPurchase(productId, purchaseToken, isSubscription);

    if (!result.isValid) {
      return errorResponse(res, 'Invalid purchase token');
    }

    // 2️⃣ Acknowledge (consume) the purchase - ✅ IS_SUBSCRIPTION PASS KARO
    await acknowledgePurchase(productId, purchaseToken, isSubscription);

    // 3️⃣ Update user subscription
    let expiryDate = null;
    if (isSubscription && result.expiryTime) {
      expiryDate = new Date(Number(result.expiryTime)).toISOString();

      await supabaseAdmin
        .from('users')
        .update({
          subscription_status: true,
          subscription_expiry: expiryDate,
        })
        .eq('id', userId);

      logger.info(`✅ User ${userId} subscription updated via Google Play. Expires: ${expiryDate}`);
    }

    // 4️⃣ Log transaction
    await supabaseAdmin
      .from('payment_transactions')
      .insert({
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        order_id: result.orderId || `mock_order_${Date.now()}`,
        platform: 'google_play',
        type: isSubscription ? 'subscription' : 'inapp',
        status: 'verified',
        amount: result.priceAmountMicros ? result.priceAmountMicros / 1000000 : null,
        subscription_start: new Date().toISOString(),
        subscription_end: expiryDate,
      });

    successResponse(res, {
      message: 'Purchase verified successfully',
      isValid: true,
      isSubscription,
      expiryDate,
      data: result,
    });

  } catch (err) {
    logger.error('Error in verifyGooglePurchase:', err);
    errorResponse(res, 'Failed to verify purchase');
  }
};