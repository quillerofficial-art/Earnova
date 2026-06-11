import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const registerDevice = async (req: Request, res: Response) => {
  const { fcm_token, device_type } = req.body;
  if (!fcm_token) return errorResponse(res, 'FCM token is required');

  try {
    const { error } = await supabaseAdmin
      .from('user_devices')
      .upsert({
        user_id: req.user!.id,
        fcm_token,
        device_type: device_type || 'unknown',
        updated_at: new Date(),
      }, { onConflict: 'user_id, fcm_token' });
    if (error) throw error;
    successResponse(res, { message: 'Device registered successfully' });
  } catch (err) {
    logger.error('Error in registerDevice:', err);
    errorResponse(res, 'Failed to register device');
  }
};