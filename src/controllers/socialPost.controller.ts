import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { uploadToBackblaze } from '../utils/s3Upload';
import { successResponse, errorResponse } from '../utils/response';
import { sendPushNotification } from '../utils/notifications';
import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';


const getAuthSupabase = (token: string) => {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
};


export const createPost = async (req: Request, res: Response) => {
  const { title, description, link } = req.body || {};
  const mediaFile = req.file;
  if (!mediaFile) return errorResponse(res, 'Media (image or video) is required');

  try {
    const mediaType = mediaFile.mimetype.startsWith('video') ? 'video' : 'image';
    const folder = mediaType === 'video' ? 'posts/videos' : 'posts/images';
    const mediaUrl = await uploadToBackblaze(mediaFile, folder);

    const supabaseAuth = getAuthSupabase(req.token!);

    // Post INSERT (प्रमाणित क्लाइंट – RLS ठीक)
    const { data, error } = await supabaseAuth
      .from('posts')
      .insert({
        user_id: req.user!.id,
        title: title || null,
        description: description || null,
        link: link || null,
        media_url: mediaUrl,
        media_type: mediaType,
      })
      .select()
      .single();
    if (error) throw error;

    // Streak update (supabaseAdmin – RLS बायपास)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('last_post_date, streak')
      .eq('id', req.user!.id)
      .single();

    let newStreak = userData?.streak || 0;
    if (!userData?.last_post_date) {
      newStreak = 1;
    } else if (userData.last_post_date === yesterday) {
      newStreak += 1;
    } else if (userData.last_post_date !== today) {
      newStreak = 1;
    }

    await supabaseAdmin
      .from('users')
      .update({ last_post_date: today, streak: newStreak })
      .eq('id', req.user!.id);

    successResponse(res, { message: 'Post created', post: data });
  } catch (err) {
    logger.error('Error in createPost (social):', err);
    errorResponse(res, 'Failed to create post');
  }
};

export const getFeed = async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;
  try {
    const { data, error, count } = await supabase
      .from('posts')
      .select(`*, users!inner (id, name, profile_pic_url)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    successResponse(res, { posts: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Error in getFeed:', err);
    errorResponse(res, 'Failed to fetch feed');
  }
};

export const toggleLike = async (req: Request, res: Response) => {
  const { id: postId } = req.params;
  const userId = req.user!.id;
  try {
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Unlike
      await supabase.from('likes').delete().eq('id', existing.id);
      await supabase.rpc('decrement_post_likes', { post_id: postId });
      successResponse(res, { liked: false });
    } else {
      // Like
      await supabase.from('likes').insert({ post_id: postId, user_id: userId });
      await supabase.rpc('increment_post_likes', { post_id: postId });

      // 🚀 Send push notification to post owner (if not self)
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      if (post && post.user_id !== userId) {
        // Get liker's name
        const { data: liker } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single();
        const name = liker?.name || 'Someone';
        await sendPushNotification(post.user_id, 'New Like', `${name} liked your post`);
      }
      successResponse(res, { liked: true });
    }
  } catch (err) {
    logger.error('Error in toggleLike:', err);
    errorResponse(res, 'Failed to process like');
  }
};


export const addComment = async (req: Request, res: Response) => {
  const { id: postId } = req.params;
  const { content, parentCommentId } = req.body;
  if (!content) return errorResponse(res, 'Comment content is required');
  const userId = req.user!.id;
  const token = req.token!;
  const supabaseAuth = getAuthSupabase(token);

  try {
    if (parentCommentId) {
      const { data: parent } = await supabaseAuth
        .from('comments')
        .select('parent_comment_id')
        .eq('id', parentCommentId)
        .single();
      if (parent?.parent_comment_id) {
        return errorResponse(res, 'Nesting only up to 2 levels allowed');
      }
    }
    const { data, error } = await supabaseAuth
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        parent_comment_id: parentCommentId || null,
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAuth.rpc('increment_post_comments', { post_id: postId });

    // 🚀 Send push notification to post owner (if not self)
    const { data: post } = await supabaseAuth
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    if (post && post.user_id !== userId) {
      const { data: commenter } = await supabaseAuth
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();
      const name = commenter?.name || 'Someone';
      await sendPushNotification(post.user_id, 'New Comment', `${name} commented: ${content.substring(0, 50)}`);
    }
    successResponse(res, { comment: data });
  } catch (err) {
    logger.error('Error in addComment:', err);
    errorResponse(res, 'Failed to add comment');
  }
};

export const getComments = async (req: Request, res: Response) => {
  const { id: postId } = req.params;
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`*, users!inner (id, name, profile_pic_url)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    // Build nested tree (2 levels)
    const map = new Map();
    const roots: any[] = [];
    data.forEach((c: any) => {
      c.replies = [];
      map.set(c.id, c);
      if (!c.parent_comment_id) roots.push(c);
      else {
        const parent = map.get(c.parent_comment_id);
        if (parent) parent.replies.push(c);
      }
    });
    successResponse(res, roots);
  } catch (err) {
    logger.error('Error in getComments:', err);
    errorResponse(res, 'Failed to fetch comments');
  }
};

export const editPost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description } = req.body;
  const userId = req.user!.id;
  try {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', id).single();
    if (!post) return errorResponse(res, 'Post not found');
    if (post.user_id !== userId) return errorResponse(res, 'Unauthorized', 403);
    await supabase.from('posts').update({ title, description, updated_at: new Date() }).eq('id', id);
    successResponse(res, { message: 'Post updated' });
  } catch (err) {
    logger.error('Error in editPost:', err);
    errorResponse(res, 'Failed to update post');
  }
};

export const deletePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  try {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', id).single();
    if (!post) return errorResponse(res, 'Post not found');
    if (post.user_id !== userId) return errorResponse(res, 'Unauthorized', 403);
    await supabase.from('posts').delete().eq('id', id);
    successResponse(res, { message: 'Post deleted' });
  } catch (err) {
    logger.error('Error in deletePost:', err);
    errorResponse(res, 'Failed to delete post');
  }
};


// Add this function after existing ones
export const getUserPosts = async (req: Request, res: Response) => {
  const { userId } = req.params;
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
    successResponse(res, { posts: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Error in getUserPosts:', err);
    errorResponse(res, 'Failed to fetch user posts');
  }
};