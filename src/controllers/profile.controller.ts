import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const getMyProfile = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, mobile_number, profile_pic_url, referral_code, level, total_downline, subscription_status, bio, social_links, streak, last_post_date')
      .eq('id', userId)
      .single();
    if (error) throw error;
    const { count: totalPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    successResponse(res, { ...user, total_posts: totalPosts });
  } catch (err) {
    logger.error('Error in getMyProfile:', err);
    errorResponse(res, 'Server error');
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, profile_pic_url, level, total_downline, bio, social_links, streak')
      .eq('id', userId)
      .eq('is_deleted', false)
      .single();
    if (error || !user) return errorResponse(res, 'User not found', 404);
    const { count: totalPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
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
    const { error } = await supabase.from('users').update(updates).eq('id', req.user!.id);
    if (error) throw error;
    successResponse(res, { message: 'Profile updated' });
  } catch (err) {
    logger.error('Error in updateMyProfile:', err);
    errorResponse(res, 'Failed to update profile');
  }
};