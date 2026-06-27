import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { uploadToBackblaze } from '../utils/s3Upload';
import { successResponse, errorResponse } from '../utils/response';
import { sendPushNotification } from '../utils/notifications';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import logger from '../utils/logger';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { addLikeStatusToPosts } from '../utils/helpers';


const getAuthSupabase = (token: string) => {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
};


export const createPost = async (req: Request, res: Response) => {
  const { title, description, link, category } = req.body || {};
  const mediaFile = req.file;
  if (!mediaFile) return errorResponse(res, 'Media (image or video) is required');

  const allowedCategories = ['entertainment', 'news', 'books', 'shopping'];
  if (category && !allowedCategories.includes(category)) {
    return errorResponse(res, `Invalid category. Allowed: ${allowedCategories.join(', ')}`);
  }

  try {
    const mediaType = mediaFile.mimetype.startsWith('video') ? 'video' : 'image';
    const folder = mediaType === 'video' ? 'posts/videos' : 'posts/images';

    let width: number | null = null;
    let height: number | null = null;
    let duration: number | null = null;
    let thumbnailUrl: string | null = null;

    // ✅ IMAGE – Width/Height
    if (mediaType === 'image') {
      try {
        const metadata = await sharp(mediaFile.buffer).metadata();
        width = metadata.width || null;
        height = metadata.height || null;
      } catch (err) {
        console.warn('Could not extract image dimensions:', err);
      }
    } 
    // ✅ VIDEO – Width/Height + Duration + Thumbnail
    else if (mediaType === 'video') {
      try {
        const tempId = uuidv4();
        const tempPath = path.join('/tmp', `video_${tempId}.mp4`);
        
        // 1️⃣ Temp file likho
        await fs.writeFile(tempPath, mediaFile.buffer);
        
        // 2️⃣ FFprobe se Dimensions + Duration nikaalo
        const { width: w, height: h, duration: dur } = await new Promise<{ width: number | null; height: number | null; duration: number | null }>((resolve) => {
          ffmpeg.ffprobe(tempPath, (err, metadata) => {
            if (err) {
              console.error('FFprobe error:', err.message);
              return resolve({ width: null, height: null, duration: null });
            }
            
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const w = videoStream?.width || null;
            const h = videoStream?.height || null;
            const dur = metadata.format.duration ? Math.round(metadata.format.duration) : null; // seconds
            
            resolve({ width: w, height: h, duration: dur });
          });
        });
        
        width = w;
        height = h;
        duration = dur;
        
        // 3️⃣ Thumbnail Generate karo (1 second pe)
        try {
          const thumbFileName = `thumb_${tempId}.jpg`;
          const thumbPath = path.join('/tmp', thumbFileName);
          
          await new Promise<void>((resolve, reject) => {
            ffmpeg(tempPath)
              .screenshots({
                timestamps: [4], // 4 second mark
                filename: thumbFileName,
                folder: '/tmp',
                size: '640x?', // Width 640, height auto (aspect ratio maintain)
              })
              .on('end', () => resolve())
              .on('error', (err) => reject(err));
          });
          
          // ✅ Thumbnail file read karo
          const thumbBuffer = await fs.readFile(thumbPath);
          
          // 🧹 Temp thumbnail delete karo
          await fs.unlink(thumbPath).catch(() => {});
          
          // ✅ Virtual Multer File banake R2 upload karo
          const virtualFile = {
            buffer: thumbBuffer,
            originalname: `thumbnail_${tempId}.jpg`,
            mimetype: 'image/jpeg',
            size: thumbBuffer.length,
            fieldname: 'file',
            encoding: '7bit',
          } as Express.Multer.File;
          
          thumbnailUrl = await uploadToBackblaze(virtualFile, 'posts/thumbnails');
          
        } catch (thumbErr) {
          console.error('Could not generate thumbnail:', thumbErr);
          // Thumbnail fail ho toh bhi post banegi (thumbnailUrl null rahega)
        }
        
        // 🧹 Main temp video delete karo
        await fs.unlink(tempPath).catch(() => {});
        
      } catch (ffmpegErr) {
        console.error('Could not process video:', ffmpegErr);
        // Agar FFprobe fail ho, toh width/height/duration null rahenge
        // Post create ho jayegi (App crash nahi)
      }
    }

    // ✅ Upload Original Media to R2
    const mediaUrl = await uploadToBackblaze(mediaFile, folder);

    const supabaseAuth = getAuthSupabase(req.token!);

    // ✅ INSERT with ALL fields (width, height, duration, thumbnail_url)
    const { data, error } = await supabaseAuth
      .from('posts')
      .insert({
        user_id: req.user!.id,
        title: title || null,
        description: description || null,
        link: link || null,
        category: category || null,
        media_url: mediaUrl,
        media_type: mediaType,
        width: width,
        height: height,
        duration: duration,          // ✅ Naya
        thumbnail_url: thumbnailUrl, // ✅ Naya (pehle null tha)
      })
      .select()
      .single();
    if (error) throw error;

    // ✅ Streak update (same as before)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('last_post_date, streak')
      .eq('id', req.user!.id)
      .single();

    let newStreak = userData?.streak || 0;
    const lastDate = userData?.last_post_date;
    if (lastDate === today) {
      // Already posted today
    } else if (lastDate === yesterdayStr) {
      newStreak += 1;
    } else {
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
  const { page = 1, limit = 10, category, combined_category } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        users!inner (id, name, profile_pic_url)
      `, { count: 'exact' });

    // ✅ Single category filter
    if (category && typeof category === 'string') {
      const allowedCategories = ['entertainment', 'news', 'books', 'shopping'];
      if (!allowedCategories.includes(category)) {
        return errorResponse(res, 'Invalid category');
      }
      query = query.eq('category', category);
    }

    // ✅ Combined category filter (entertainment + news)
    if (combined_category && typeof combined_category === 'string') {
      if (combined_category === 'entertainment_news') {
        query = query.in('category', ['entertainment', 'news']);
      } else {
        return errorResponse(res, 'Invalid combined_category. Use: entertainment_news');
      }
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

        // ✅ In-app notification for like (using supabaseAdmin to bypass RLS)
        try {
          const { data: notif } = await supabaseAdmin
            .from('notifications')
            .insert({
              admin_id: null,
              title: 'New Like',
              message: `${name} liked your post`
            })
            .select()
            .single();

          if (notif) {
            await supabaseAdmin
              .from('user_notifications')
              .insert({ user_id: post.user_id, notification_id: notif.id });
          }
        } catch (notifErr) {
          logger.error('Error inserting in-app like notification:', notifErr);
        }
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
      const shortContent = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await sendPushNotification(post.user_id, 'New Comment', `${name} commented: ${shortContent}`);

      // ✅ In-app notification for comment (using supabaseAdmin to bypass RLS)
      try {
        const { data: notif } = await supabaseAdmin
          .from('notifications')
          .insert({
            admin_id: null,
            title: 'New Comment',
            message: `${name} commented: ${shortContent}`
          })
          .select()
          .single();

        if (notif) {
          await supabaseAdmin
            .from('user_notifications')
            .insert({ user_id: post.user_id, notification_id: notif.id });
        }
      } catch (notifErr) {
        logger.error('Error inserting in-app comment notification:', notifErr);
      }
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

    // ✅ Aspect Ratio + Like Status add karo
    const postsWithStatus = await addLikeStatusToPosts(data, req.user!.id);
    const postsWithRatio = postsWithStatus.map((post: any) => ({
     ...post,
     aspectRatio: post.width && post.height ? Number((post.width / post.height).toFixed(4)) : null
    }));

    successResponse(res, { posts: postsWithRatio, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Error in getUserPosts:', err);
    errorResponse(res, 'Failed to fetch user posts');
  }
};

export const getReels = async (req: Request, res: Response) => {
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
      .eq('media_type', 'video')   // ✅ केवल Video
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
    logger.error('Error in getReels:', err);
    errorResponse(res, 'Failed to fetch reels');
  }
};