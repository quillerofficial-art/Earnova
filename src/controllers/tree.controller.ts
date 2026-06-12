import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';
import { isDescendant } from '../utils/helpers';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

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

    const token = crypto.randomBytes(32).toString('hex');
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