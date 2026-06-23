import { Request, Response } from 'express'
import { supabase, supabaseAdmin } from '../config/supabase'
import logger from '../utils/logger'
import { successResponse, errorResponse } from '../utils/response'

// Get own profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, upi_id, profile_pic_url, referral_code, sponsor_id, parent_id, total_downline, level, subscription_status, subscription_expiry, mobile_number')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return errorResponse(res, 'User not found');
    }

    // Count total referrals (users who have this user as sponsor)
    const { count: totalReferrals, error: refError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_id', userId)
      .eq('is_deleted', false);

    if (refError) throw refError;

    // Count inactive users in downline (total_downline with subscription_status = false)
    // Note: This is not direct from users table; we need to count descendants with subscription_status = false
    // Let's do a recursive CTE or a separate query
    const { data: inactiveCountData, error: inactiveError } = await supabase.rpc('count_inactive_downline', { user_id: userId });
    if (inactiveError) throw inactiveError;
    const inactiveDownlineCount = inactiveCountData || 0;

    // Compute status string
    const userStatus = user.subscription_status === true && 
  (user.subscription_expiry === null || new Date(user.subscription_expiry) > new Date())
  ? 'active' : 'inactive';

    successResponse(res, {
      ...user,
      total_referrals: totalReferrals || 0,
      inactive_downline_count: inactiveDownlineCount,
      status: userStatus,
    });
  } catch (err) {
    logger.error('Error in getProfile:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error');
  }
};

// Update profile (name, upi_id, mobile_number)
export const updateProfile = async (req: Request, res: Response) => {
  const { name, upi_id, mobile_number } = req.body

  try {
    const { error } = await supabase
      .from('users')
      .update({ name, upi_id, mobile_number })
      .eq('id', req.user!.id)

    if (error) {
      return res.status(400).json({ message: error.message })
    }

    successResponse(res, { message: 'Profile updated' })
  } catch (err) {
    logger.error('Error in updateProfile:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error')
  }
}

// Get user's notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('user_notifications')
      .select(`
        id,
        is_read,
        created_at,
        notifications (title, message, created_at)
      `)
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(res, error.message )
    }

    successResponse(res, notifications)
  } catch (err) {
    logger.error('Error in getNotifications:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error')
  }
}

// Mark notification as read
export const markNotificationRead = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const { error } = await supabaseAdmin
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user!.id)

    if (error) {
      return errorResponse(res, error.message )
    }

    successResponse(res, { message: 'Notification marked as read' })
  } catch (err) {
    logger.error('Error in markNotificationRead:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error')
  }
}

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, profile_pic_url, level, subscription_status, subscription_expiry, created_at, mobile_number')
      .eq('id', id)
      .single();

    if (error || !data) {
      return errorResponse(res, 'User not found');
    }

    const userStatus = data.subscription_status === true &&
      (data.subscription_expiry === null || new Date(data.subscription_expiry) > new Date())
      ? 'active' : 'inactive';

    successResponse(res, {
      ...data,
      status: userStatus,
    });
  } catch (err) {
    logger.error('Error in getUserById:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Server error');
  }
};

// Get own posts (pagination)
export const getMyPosts = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 10 } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  try {
    const { data, error, count } = await supabase
      .from('posts')
      .select(`
        *,
        users!inner (id, name, profile_pic_url)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    successResponse(res, {
      posts: data,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    logger.error('Error in getMyPosts:', err);
    errorResponse(res, 'Failed to fetch posts');
  }
};

// Get posts of any user (by userId)
export const getUserPostsProfile = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  // Check if user exists (optional – to avoid 404)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('is_deleted', false)
    .single();

  if (userError || !user) {
    return errorResponse(res, 'User not found', 404);
  }

  try {
    const { data, error, count } = await supabase
      .from('posts')
      .select(`
        *,
        users!inner (id, name, profile_pic_url)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    successResponse(res, {
      posts: data,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    logger.error('Error in getUserPostsProfile:', err);
    errorResponse(res, 'Failed to fetch posts');
  }
};