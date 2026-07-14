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
    // ✅ DUPLICATE TOKEN CHECK (Sirf Verified transactions ko Duplicate maano)
    const { data: existingTx } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, status')
      .eq('purchase_token', purchaseToken)
      .eq('product_id', productId)
      .maybeSingle();

    if (existingTx) {
      // Agar already verified hai toh duplicate
      if (existingTx.status === 'verified' || existingTx.status === 'active') {
        logger.info(`⏳ Duplicate purchase token ignored: ${purchaseToken}`);
        return successResponse(res, {
          message: 'Purchase already processed',
          isValid: true,
          alreadyProcessed: true,
        });
      }
      // Agar pending_acknowledgement hai toh aage badhne do (Retry case)
      logger.info(`🔄 Retry for pending acknowledgement: ${purchaseToken}`);
    }

    // 1️⃣ Verify purchase
    const result = await verifyPurchase(productId, purchaseToken, isSubscription);

    if (!result.isValid) {
      return errorResponse(res, 'Invalid purchase token');
    }

    // 2️⃣ Expiry date calculate karo
    let expiryDate = null;
    if (isSubscription && result.expiryTime) {
      expiryDate = new Date(Number(result.expiryTime)).toISOString();
    }

    // 3️⃣ 🔥 OPTIMISTIC ACTIVATION: User ko turant Active karo (Paise cut gaye hain)
    if (isSubscription && expiryDate) {
      await supabaseAdmin
        .from('users')
        .update({
          subscription_status: true,
          subscription_expiry: expiryDate,
        })
        .eq('id', userId);

      logger.info(`✅ User ${userId} activated (Optimistic). Expires: ${expiryDate}`);
    }

    // 4️⃣ 🔥 DB Transaction Log (Pehle se pending status ke saath)
    const { data: txData, error: txError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        user_id: userId,
        product_id: productId,
        purchase_token: purchaseToken,
        order_id: result.orderId || `mock_order_${Date.now()}`,
        platform: 'google_play',
        type: isSubscription ? 'subscription' : 'inapp',
        status: 'pending_acknowledgement', // ✅ Pehle se pending
        amount: result.priceAmountMicros ? result.priceAmountMicros / 1000000 : null,
        subscription_start: new Date().toISOString(),
        subscription_end: expiryDate,
      })
      .select()
      .single();

    if (txError) {
      logger.error('❌ Failed to log transaction:', txError);
      // User already active hai, isliye aage badho
    }

    // 5️⃣ Acknowledge attempt (Best effort)
    let ackSuccess = false;
    let ackError = null;
    try {
      const ackResult = await acknowledgePurchase(productId, purchaseToken, isSubscription);
      ackSuccess = ackResult.success;
      if (!ackSuccess) {
        ackError = ackResult.error || 'Unknown error';
      }
    } catch (err: any) {
      ackError = err.message;
      logger.error('❌ Acknowledge exception:', err);
    }

    // 6️⃣ Agar Acknowledge success hai toh status update karo
    if (ackSuccess && txData) {
      await supabaseAdmin
        .from('payment_transactions')
        .update({ status: 'verified' })
        .eq('id', txData.id);
      logger.info(`✅ Acknowledge SUCCESS for user ${userId}`);
    } else if (!ackSuccess) {
      logger.warn(`⚠️ Acknowledge FAILED for user ${userId}. Will retry via cron. Error: ${ackError}`);
    }

    // 7️⃣ Final Response (User ko access mil chuka hai)
    successResponse(res, {
      message: ackSuccess
        ? 'Purchase verified and subscription activated successfully!'
        : 'Purchase verified and subscription activated. Acknowledgment pending (will be completed shortly).',
      isValid: true,
      isSubscription,
      expiryDate,
      acknowledgeStatus: ackSuccess ? 'done' : 'pending',
      data: result,
    });

  } catch (err) {
    logger.error('Error in verifyGooglePurchase:', err);
    errorResponse(res, 'Failed to verify purchase');
  }
};