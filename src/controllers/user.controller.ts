import { Request, Response } from 'express'
import { supabase, supabaseAdmin } from '../config/supabase'
import logger from '../utils/logger'
import { successResponse, errorResponse } from '../utils/response'
import { addLikeStatusToPosts, getBlockedUserIds } from '../utils/helpers';

// Get own profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, upi_id, profile_pic_url, referral_code, sponsor_id, parent_id, total_downline, level, subscription_status, subscription_expiry, mobile_number')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return errorResponse(res, 'User not found');
    }

    const { count: totalReferrals, error: refError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_id', userId)
      .eq('is_deleted', false);
    if (refError) throw refError;

    const { data: inactiveCountData, error: inactiveError } = await supabase.rpc('count_inactive_downline', { user_id: userId });
    if (inactiveError) throw inactiveError;
    const inactiveDownlineCount = inactiveCountData || 0;

    // ✅ REAL-TIME SUBSCRIPTION STATUS (Middleware jaisa)
    let actualStatus = false;
    let userStatus = 'inactive';

    if (user.level >= 1) {
      // Level 1+ = Lifetime Free
      actualStatus = true;
      userStatus = 'active';
      user.subscription_expiry = null;
    } else {
      const now = new Date();
      const expiry = user.subscription_expiry ? new Date(user.subscription_expiry) : null;
      actualStatus = user.subscription_status === true && (expiry === null || expiry > now);
      userStatus = actualStatus ? 'active' : 'inactive';
    }

    // ✅ Override DB status
    user.subscription_status = actualStatus;

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

    // ✅ REAL-TIME SUBSCRIPTION STATUS
    let actualStatus = false;
    if (user.level >= 1) {
      actualStatus = true;
      user.subscription_expiry = null;
    } else {
      const now = new Date();
      const expiry = user.subscription_expiry ? new Date(user.subscription_expiry) : null;
      actualStatus = user.subscription_status === true && (expiry === null || expiry > now);
    }

    // ✅ Override DB status
    user.subscription_status = actualStatus;

    successResponse(res, { 
      ...user, 
      total_posts: totalPosts, 
      inactive_downline_count: inactiveDownlineCount 
    });
  } catch (err) {
    logger.error('Error in getMyProfile:', err);
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

    // ✅ Aspect Ratio + Like Status add karo
    const postsWithStatus = await addLikeStatusToPosts(data, req.user!.id);
    const postsWithRatio = postsWithStatus.map((post: any) => ({
     ...post,
     aspectRatio: post.width && post.height ? Number((post.width / post.height).toFixed(4)) : null
    }));
    successResponse(res, {
      posts: postsWithRatio,
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
    // ✅ 1. userId ko string mein convert karo (FIX)
    const targetUserId = Array.isArray(userId) ? userId[0] : userId;

    // ✅ 2. Mutual Blocked Users fetch
    const blockedIds = await getBlockedUserIds(req.user!.id);

    // ✅ 3. Agar Current User ne Profile Owner ko Block kiya hai, toh No Posts
    if (blockedIds.includes(targetUserId)) {
      return successResponse(res, { 
        posts: [], 
        total: 0, 
        page: Number(page), 
        limit: Number(limit) 
      });
    }

    let query = supabase
      .from('posts')
      .select(`
        *,
        users!inner (id, name, profile_pic_url)
      `, { count: 'exact' })
      .eq('user_id', targetUserId);

    // ✅ 4. Blocked Users ki Posts hatao (Mutual)
    if (blockedIds.length > 0) {
      query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // ✅ Aspect Ratio + Like Status add karo
    const postsWithStatus = await addLikeStatusToPosts(data, req.user!.id);
    const postsWithRatio = postsWithStatus.map((post: any) => ({
      ...post,
      aspectRatio: post.width && post.height ? Number((post.width / post.height).toFixed(4)) : null
    }));

    successResponse(res, {
      posts: postsWithRatio,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    logger.error('Error in getUserPostsProfile:', err);
    errorResponse(res, 'Failed to fetch posts');
  }
};