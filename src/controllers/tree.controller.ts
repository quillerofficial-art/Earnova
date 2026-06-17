import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';
import { isDescendant } from '../utils/helpers';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

// Generate a random 12-character alphanumeric uppercase token (A-Z, 0-9)
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

export const generateInvite = async (req: Request, res: Response) => {
  const { parent_id, position } = req.body;
  if (!parent_id || position === undefined || position < 1 || position > 5) {
    return errorResponse(res, 'Invalid parent_id or position (1-5)');
  }

  try {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .select('child_ids')
      .eq('id', parent_id)
      .single();
    if (parentError || !parent) return errorResponse(res, 'Parent not found');

    const isInTree = await isDescendant(req.user!.id, parent_id);
    if (!isInTree) return errorResponse(res, 'You can only invite under your own tree');

    // Check if position already occupied
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', parent_id)
      .eq('position', position)
      .maybeSingle();
    if (existing) return errorResponse(res, 'Position already occupied');

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await supabaseAdmin.from('invitation_tokens').insert({
      token,
      sponsor_id: req.user!.id,
      parent_id,
      position,
      expires_at: expiresAt.toISOString(),
    });

    const inviteWebUrl = `${process.env.BASE_URL}/invite?token=${token}`;
    const deepLink = `${process.env.FRONTEND_URL}?token=${token}`;
    successResponse(res, { invite_link: inviteWebUrl, deep_link: deepLink, token });
  } catch (err) {
    logger.error('Error in generateInvite:', err);
    errorResponse(res, 'Server error');
  }
};

export const getRoot = async (req: Request, res: Response) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, mobile_number, profile_pic_url, subscription_status, child_ids, level, total_downline')
      .eq('id', req.user!.id)
      .single();
    if (error || !user) return errorResponse(res, 'User not found');
    successResponse(res, user);
  } catch (err) {
    logger.error('Error in getRoot:', err);
    errorResponse(res, 'Server error');
  }
};

export const getChildren = async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  try {
    const { data: parent, error } = await supabaseAdmin
      .from('users')
      .select('child_ids')
      .eq('id', nodeId)
      .single();
    if (error || !parent) return errorResponse(res, 'Node not found');
    const childIds = parent.child_ids || [];
    if (childIds.length === 0) return successResponse(res, []);
    const { data: children } = await supabaseAdmin
      .from('users')
      .select('id, name, email, profile_pic_url, subscription_status, level, position')
      .in('id', childIds);
    successResponse(res, children);
  } catch (err) {
    logger.error('Error in getChildren:', err);
    errorResponse(res, 'Server error');
  }
};

// Search in downline (tree) by name or email
export const searchDownline = async (req: Request, res: Response) => {
  const { q, page = 1, limit = 20 } = req.query;
  const userId = req.user!.id;

  if (!q || typeof q !== 'string') {
    return errorResponse(res, 'Search query (q) is required');
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  try {
    // 1. Get all descendant IDs using RPC function
    const { data: descendantIds, error: rpcError } = await supabaseAdmin
      .rpc('get_descendants', { root_id: userId });

    if (rpcError) throw rpcError;
    if (!descendantIds || descendantIds.length === 0) {
      return successResponse(res, { users: [], total: 0, page: Number(page), limit: Number(limit) });
    }

    // 2. Search in users table where id IN descendantIds
    let query = supabaseAdmin
      .from('users')
      .select('id, name, email, profile_pic_url, level, subscription_status, total_downline', { count: 'exact' })
      .in('id', descendantIds.map((d: any) => d.id))
      .eq('is_deleted', false);

    // 3. Search by name or email (partial match)
    const searchTerm = `%${q}%`;
    query = query.or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`);

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) throw error;

    successResponse(res, {
      users: data,
      total: count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    logger.error('Error in searchDownline:', err);
    errorResponse(res, 'Failed to search downline');
  }
};