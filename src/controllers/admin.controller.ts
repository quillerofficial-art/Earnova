import { Request, Response } from 'express'
import { supabase, supabaseAdmin} from '../config/supabase'
import { successResponse, errorResponse} from '../utils/response'
import { sendPushNotification } from '../utils/notifications';
import logger from '../utils/logger'

// Get all users with filters
export const getAllUsers = async (req: Request, res: Response) => {
  const { search, subscription, level, page = 1, limit = 20 } = req.query
  let query = supabase
    .from('users')
    .select('id, name, email, upi_id, mobile_number, profile_pic_url, total_downline, level, subscription_status, created_at', { count: 'exact' })
    .eq('role', 'user')
    .eq('is_deleted', false)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (subscription !== undefined) {
    query = query.eq('subscription_status', subscription === 'true')
  }
  if (level) {
    query = query.eq('level', level)
  }

  const from = (page as number - 1) * (limit as number)
  const to = from + (limit as number) - 1

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
  return errorResponse(res, error.message)
  }

  successResponse(res, {
    users: data,
    total: count,
    page: Number(page),
    limit: Number(limit),
  })
}

// Permanent delete user
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    // 1. यूजर की जानकारी (parent_id)
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, parent_id')
      .eq('id', userId)
      .single();
    if (fetchError || !user) return res.status(404).json({ message: 'User not found' });

    // 2. इस यूजर के सभी बच्चों को लाएँ
    const { data: children } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', userId);
    
    // 3. बच्चों का parent_id null करें (वे नए रूट बन जाएँ)
    if (children && children.length > 0) {
      const childIds = children.map(c => c.id);
      // बच्चों का parent_id = null करें
      await supabaseAdmin
        .from('users')
        .update({ parent_id: null })
        .in('id', childIds);
      
      // हर बच्चे के लिए downline recalc (क्योंकि अब वे रूट हैं)
      for (const childId of childIds) {
        await supabaseAdmin.rpc('recalc_user_and_ancestors_v5', { target_id: childId });
      }
    }

    // 4. पैरेंट के child_ids से इस यूजर को हटाएँ (अगर पैरेंट है)
    if (user.parent_id) {
      const { data: parent } = await supabaseAdmin
        .from('users')
        .select('child_ids')
        .eq('id', user.parent_id)
        .single();
      let updatedChildren = (parent?.child_ids || []).filter((cId: string) => cId !== userId);
      await supabaseAdmin
        .from('users')
        .update({ child_ids: updatedChildren })
        .eq('id', user.parent_id);
      
      // पैरेंट का downline recalc करें
      await supabaseAdmin.rpc('recalc_user_and_ancestors_v5', { target_id: user.parent_id });
    }

    // 5. Supabase Auth से यूजर डिलीट करें
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authErr) {
      logger.error('Auth delete error:', authErr);
    }

    // 6. public.users टेबल से यूजर डिलीट करें (CASCADE से posts, likes, comments भी)
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);
    if (deleteError) throw deleteError;

    successResponse(res, { 
      message: 'User permanently deleted. Their children became new roots (parent_id = null).',
      childrenPromoted: children?.length || 0
    });
  } catch (err) {
    logger.error('Error in deleteUser (permanent):', { error: err, userId: req.user?.id });
    errorResponse(res, 'Failed to delete user permanently');
  }
};

// Send notification to selected users
export const sendNotification = async (req: Request, res: Response) => {
  const { userIds, title, message } = req.body;
  if (!message || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'userIds array and message required' });
  }
  try {
    // Insert into notifications table (as before)
    const { data: notif, error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({ admin_id: req.user!.id, title: title || 'Notification', message })
      .select()
      .single();
    if (notifError) throw notifError;

    // Insert into user_notifications
    const userNotifications = userIds.map((userId: string) => ({
      user_id: userId,
      notification_id: notif.id,
    }));
    const { error: insertError } = await supabaseAdmin.from('user_notifications').insert(userNotifications);
    if (insertError) throw insertError;

    // 🚀 Send push notifications to each user
    for (const userId of userIds) {
      await sendPushNotification(userId, title || 'Notification', message);
    }

    successResponse(res, { message: 'Notification sent successfully', notificationId: notif.id });
  } catch (err) {
    logger.error('Error in sendNotification:', err);
    errorResponse(res, 'Failed to send notifications');
  }
};

// Get all notifications (admin view)
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        message,
        created_at,
        users!inner (name),
        user_notifications (count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(res, error.message)
    }

    successResponse(res, { notifications: data })
  } catch (err) {
    logger.error('Error in getNotifications:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Server error' )
  }
}

// Get dashboard stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Total users (not deleted)
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    // Active subscribers (subscription_status = true AND expiry > now)
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('subscription_status', true)
      .gt('subscription_expiry', new Date().toISOString());

    // Inactive users (subscription_status = false OR expired, and not deleted)
    const { count: inactiveUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('subscription_status', false);

    successResponse(res, {
      totalUsers,
      activeUsers,
      inactiveUsers,
    });
  } catch (err) {
    logger.error('Error in getDashboardStats:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Failed to fetch stats' );
  }
};

// Get inactive users with pagination and search
export const getInactiveUsers = async (req: Request, res: Response) => {
  const { search, page = 1, limit = 20 } = req.query;
  let query = supabase
    .from('users')
    .select('id, name, email, upi_id, mobile_number, profile_pic_url, total_downline, level, subscription_status, created_at', { count: 'exact' })
    .eq('is_deleted', false)
    .eq('subscription_status', false);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return errorResponse(res, 'Failed to fetch inactive users' );
  }

  successResponse(res, {
    users: data,
    total: count,
    page: Number(page),
    limit: Number(limit),
  });
};

export const sendNotificationToAll = async (req: Request, res: Response) => {
  const { title, message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Get all users (who are not deleted)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('is_deleted', false);
    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const userIds = users.map(u => u.id);

    // Insert notification
    const { data: notif, error: notifError } = await supabase
      .from('notifications')
      .insert({ admin_id: req.user!.id, title: title || 'Notification', message })
      .select()
      .single();
    if (notifError) throw notifError;

    // Insert user_notifications in batches
    const batchSize = 500;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize).map(userId => ({
        user_id: userId,
        notification_id: notif.id,
      }));
      await supabase.from('user_notifications').insert(batch);
    }

    // 🚀 Send push notifications to all users (async, no need to wait one by one)
    for (const user of users) {
      await sendPushNotification(user.id, title || 'Notification', message);
    }

    res.json({ 
      message: 'Notification sent to all users', 
      notificationId: notif.id,
      totalRecipients: userIds.length 
    });
  } catch (err) {
    logger.error('Error in sendNotificationToAll:', { error: err, userId: req.user?.id });
    res.status(500).json({ message: 'Failed to send notifications' });
  }
};


export const broadcastNotification = async (req: Request, res: Response) => {
  const { title, message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Get all active users (not deleted)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('is_deleted', false);
    if (usersError) throw usersError;

    const { data: notif, error: notifError } = await supabase
      .from('notifications')
      .insert({ admin_id: req.user!.id, title: title || 'Notification', message })
      .select()
      .single();
    if (notifError) throw notifError;

    // Batch insert into user_notifications
    const batchSize = 500;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize).map(u => ({
        user_id: u.id,
        notification_id: notif.id,
      }));
      await supabase.from('user_notifications').insert(batch);
    }

    // 🚀 Send push notifications to all users
    for (const user of users) {
      await sendPushNotification(user.id, title || 'Notification', message);
    }

    res.json({ message: 'Broadcast sent', notificationId: notif.id, totalRecipients: users.length });
  } catch (err) {
    logger.error('Error in broadcastNotification:', err);
    res.status(500).json({ message: 'Failed to send broadcast' });
  }
};