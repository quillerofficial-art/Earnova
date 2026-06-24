import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

// Block a User
export const blockUser = async (req: Request, res: Response) => {
  const { userId } = req.body;
  const blockerId = req.user!.id;

  if (!userId) return errorResponse(res, 'userId is required');
  if (userId === blockerId) return errorResponse(res, 'You cannot block yourself');

  try {
    // ✅ Check if already blocked
    const { data: existing } = await supabaseAdmin
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId)
      .maybeSingle();

    if (existing) {
      return errorResponse(res, 'User already blocked');
    }

    const { error } = await supabaseAdmin
      .from('blocks')
      .insert({
        blocker_id: blockerId,
        blocked_id: userId,
      });

    if (error) throw error;

    successResponse(res, { message: 'User blocked successfully' });
  } catch (err) {
    logger.error('Error in blockUser:', err);
    errorResponse(res, 'Failed to block user');
  }
};

// Unblock a User
export const unblockUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const blockerId = req.user!.id;

  if (!userId) return errorResponse(res, 'userId is required');

  try {
    const { error } = await supabaseAdmin
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId);

    if (error) throw error;

    successResponse(res, { message: 'User unblocked successfully' });
  } catch (err) {
    logger.error('Error in unblockUser:', err);
    errorResponse(res, 'Failed to unblock user');
  }
};

// Get Blocked Users List (optional – frontend के लिए)
export const getBlockedUsers = async (req: Request, res: Response) => {
  const blockerId = req.user!.id;
  const { page = 1, limit = 20 } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  try {
    const { data, error, count } = await supabaseAdmin
      .from('blocks')
      .select(`
        blocked_id,
        blocked:users!blocks_blocked_id_fkey (id, name, profile_pic_url)
      `, { count: 'exact' })
      .eq('blocker_id', blockerId)
      .range(from, to);

    if (error) throw error;

    const users = data.map((item: any) => item.blocked).filter(Boolean);

    successResponse(res, {
      users,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    logger.error('Error in getBlockedUsers:', err);
    errorResponse(res, 'Failed to fetch blocked users');
  }
};