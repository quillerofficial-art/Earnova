import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase'; // ✅ supabase (Anon) import karo
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const email = req.user!.email; // ✅ Middleware se email milega
  const { reason, password } = req.body; // ✅ Password body se lo

  // ✅ 1. Check if password is provided
  if (!password) {
    return errorResponse(res, 'Password is required to delete account', 400);
  }

  try {
    // ✅ 2. Verify password using Supabase Auth
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (signInError) {
      // ❌ Password galat hai
      return errorResponse(res, 'Incorrect password', 401);
    }

    // ✅ 3. (Optional) Log deletion reason
    if (reason) {
      await supabaseAdmin
        .from('account_deletions')
        .insert({ user_id: userId, reason });
    }

    // ✅ 4. Delete from Auth (Supabase)
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // ✅ 5. Delete from public.users (CASCADE will delete posts, likes, comments, etc.)
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