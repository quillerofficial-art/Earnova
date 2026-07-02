import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import { addLikeStatusToPosts, getBlockedUserIds } from '../utils/helpers';

export const searchUsers = async (req: Request, res: Response) => {
  const { q, page = 1, limit = 20 } = req.query;
  if (!q || typeof q !== 'string') return errorResponse(res, 'Search query (q) is required');

  const from = (Number(page)-1)*Number(limit);
  const to = from+Number(limit)-1;
  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('id, name, profile_pic_url, level, streak', { count: 'exact' })
      .ilike('name', `%${q}%`)
      .eq('is_deleted', false)
      .range(from, to);
    if (error) throw error;
    successResponse(res, { users: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('Error in searchUsers:', err);
    errorResponse(res, 'Search failed');
  }
};

export const searchPosts = async (req: Request, res: Response) => {
  const { q, category, combined_category, page = 1, limit = 20 } = req.query;
  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  try {
    // ✅ 1. Mutual Blocked Users fetch (NEW)
    const blockedIds = await getBlockedUserIds(req.user!.id);

    let query = supabase
      .from('posts')
      .select(`
        *,
        users!inner (id, name, profile_pic_url)
      `, { count: 'exact' });

    // ✅ 2. Blocked Users ki Posts search se hatao (NEW)
    if (blockedIds.length > 0) {
      query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
    }

    // ✅ Category filter
    if (category && typeof category === 'string') {
      const allowedCategories = ['entertainment', 'news', 'books', 'shopping'];
      if (!allowedCategories.includes(category)) {
        return errorResponse(res, 'Invalid category');
      }
      query = query.eq('category', category);
    }

    // ✅ Combined category filter (नया - entertainment + news)
    if (combined_category && typeof combined_category === 'string') {
      if (combined_category === 'entertainment_news') {
        query = query.in('category', ['entertainment', 'news']);
      } else {
        return errorResponse(res, 'Invalid combined_category. Use: entertainment_news');
      }
    }

    // ✅ Search term (title या description में)
    if (q && typeof q === 'string') {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
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
    logger.error('Error in searchPosts:', err);
    errorResponse(res, 'Failed to search posts');
  }
};