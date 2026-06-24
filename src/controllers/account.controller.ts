import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { reason } = req.body; // Optional

  try {
    // ✅ 1. Log deletion reason (optional)
    if (reason) {
      await supabaseAdmin
        .from('account_deletions')
        .insert({ user_id: userId, reason });
    }

    // ✅ 2. Delete from Auth (Supabase)
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // ✅ 3. Delete from public.users (CASCADE will delete posts, likes, comments, etc.)
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    successResponse(res, { message: 'Account deleted successfully' });
  } catch (err) {
    logger.error('Error in deleteAccount:', err);
    errorResponse(res, 'Failed to delete account');
  }
};