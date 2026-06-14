import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const registerDevice = async (req: Request, res: Response) => {
  const { fcm_token, device_type } = req.body;
  if (!fcm_token) return errorResponse(res, 'FCM token is required');

  try {
    // ✅ पहले पुराने टोकन हटाएँ (सभी)
    const { error: deleteError, count } = await supabaseAdmin
      .from('user_devices')
      .delete({ count: 'exact' })
      .eq('user_id', req.user!.id);

    if (deleteError) {
      logger.error('Error deleting old devices:', deleteError);
    } else {
      logger.info(`Deleted ${count} old device tokens for user ${req.user!.id}`);
    }

    // ✅ नया टोकन डालें
    const { error: insertError } = await supabaseAdmin
      .from('user_devices')
      .insert({
        user_id: req.user!.id,
        fcm_token,
        device_type: device_type || 'unknown',
        updated_at: new Date(),
      });

    if (insertError) throw insertError;

    successResponse(res, { message: 'Device registered successfully (only current device active)' });
  } catch (err) {
    logger.error('Error in registerDevice:', err);
    errorResponse(res, 'Failed to register device');
  }
};