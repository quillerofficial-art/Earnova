import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const getMyProfile = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, mobile_number, upi_id, profile_pic_url, level, total_downline, subscription_status, subscription_expiry, bio, social_links, streak, last_post_date')
      .eq('id', userId)
      .single();
    if (error) throw error;
    const { count: totalPosts } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    const { data: inactiveCount } = await supabaseAdmin
      .rpc('count_inactive_downline', { user_id: userId });
    const inactiveDownlineCount = inactiveCount || 0;

    // ✅ REAL-TIME SUBSCRIPTION STATUS (Middleware jaisa)
    let actualStatus = false;
    if (user.level >= 1) {
      // Level 1+ = Lifetime Free → Always Active
      actualStatus = true;
      user.subscription_expiry = null; // Frontend को null bhejo
    } else {
      const now = new Date();
      const expiry = user.subscription_expiry ? new Date(user.subscription_expiry) : null;
      actualStatus = user.subscription_status === true && (expiry === null || expiry > now);
    }
    // ✅ Override DB status with real-time status
    user.subscription_status = actualStatus;

    // 🔥 YEH 2 LINES DAALO (successResponse se pehle)
    console.log('🕐 SERVER UTC TIME:', new Date().toISOString());
    console.log('📅 EXPIRY UTC TIME:', user.subscription_expiry);

    successResponse(res, { ...user, total_posts: totalPosts, inactive_downline_count: inactiveDownlineCount });
  } catch (err) {
    logger.error('Error in getMyProfile:', err);
    errorResponse(res, 'Server error');
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, profile_pic_url, level, total_downline, bio, social_links, streak')
      .eq('id', userId)
      .eq('is_deleted', false)
      .single();
    if (error || !user) return errorResponse(res, 'User not found', 404);
    const { count: totalPosts } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    successResponse(res, { ...user, total_posts: totalPosts });
  } catch (err) {
    logger.error('Error in getUserProfile:', err);
    errorResponse(res, 'Server error');
  }
};

export const updateMyProfile = async (req: Request, res: Response) => {
  const { name, upi_id, mobile_number, bio, social_links } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (upi_id !== undefined) updates.upi_id = upi_id;
  if (mobile_number !== undefined) updates.mobile_number = mobile_number;
  if (bio !== undefined) updates.bio = bio;
  if (social_links !== undefined) updates.social_links = social_links;

  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user!.id);
    if (error) throw error;
    successResponse(res, { message: 'Profile updated' });
  } catch (err) {
    logger.error('Error in updateMyProfile:', err);
    errorResponse(res, 'Failed to update profile');
  }
};