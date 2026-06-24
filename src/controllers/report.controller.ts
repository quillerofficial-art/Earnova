import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const createReport = async (req: Request, res: Response) => {
  const { type, targetId, reason } = req.body;
  const reporterId = req.user!.id;

  // ✅ Validation
  if (!type || !targetId || !reason) {
    return errorResponse(res, 'type, targetId, and reason are required');
  }

  const validTypes = ['post', 'user', 'comment'];
  if (!validTypes.includes(type)) {
    return errorResponse(res, 'Invalid type. Allowed: post, user, comment');
  }

  if (reason.length < 3) {
    return errorResponse(res, 'Reason must be at least 3 characters');
  }

  try {
    // ✅ Check if already reported (optional – prevent spam)
    const { data: existing } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('target_type', type)
      .eq('target_id', targetId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return errorResponse(res, 'You have already reported this content');
    }

    // ✅ Insert Report
    const { data, error } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: reporterId,
        target_type: type,
        target_id: targetId,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // ✅ (Optional) Send Admin Notification – बाद में जोड़ सकते हो
    // await sendPushNotification(adminUserId, 'New Report', `${type} reported: ${reason}`);

    successResponse(res, {
      message: 'Report submitted successfully',
      reportId: data.id,
    });
  } catch (err) {
    logger.error('Error in createReport:', err);
    errorResponse(res, 'Failed to submit report');
  }
};