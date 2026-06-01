import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

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