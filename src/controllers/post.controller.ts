import { Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { s3Client } from '../config/storage'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { successResponse, errorResponse } from '../utils/response'
import logger from '../utils/logger'
import { uploadToBackblaze } from '../utils/s3Upload'

export const createPost = async (req: Request, res: Response) => {
  const { description, affiliateLink } = req.body;
  const bannerFile = req.file || (req.files && !Array.isArray(req.files) && 'image' in req.files ? req.files['image'][0] : null);

  if (!description || !affiliateLink || !bannerFile) {
    return errorResponse(res, 'Missing required fields or banner file');
  }

  try {
    // Use helper instead of raw S3
    const bannerUrl = await uploadToBackblaze(bannerFile, 'posts');

    const { data, error } = await supabase
      .from('admin_posts')
      .insert({
        banner_url: bannerUrl,
        description,
        affiliate_link: affiliateLink,
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (error) throw error;

    successResponse(res, { message: 'Post created', post: data });
  } catch (err) {
    logger.error('Error in createPost:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Failed to create post');
  }
};

export const updatePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, affiliateLink } = req.body;
  const bannerFile = req.file;

  try {
    let bannerUrl: string | undefined;

    if (bannerFile) {
      // Use helper
      bannerUrl = await uploadToBackblaze(bannerFile, 'posts');
    }

    const updates: any = {};
    if (description) updates.description = description;
    if (affiliateLink) updates.affiliate_link = affiliateLink;
    if (bannerUrl) updates.banner_url = bannerUrl;

    const { data, error } = await supabase
      .from('admin_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    successResponse(res, { message: 'Post updated', post: data });
  } catch (err) {
    logger.error('Error in updatePost:', { error: err, userId: req.user?.id });
    errorResponse(res, 'Failed to update post');
  }
};

export const deletePost = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const { error } = await supabase
      .from('admin_posts')
      .delete()
      .eq('id', id)

    if (error) throw error

    successResponse(res, { message: 'Post deleted' })
  } catch (err) {
    logger.error('Error in deletePost:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Failed to delete post')
  }
}

export const getAllPosts = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('admin_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    successResponse(res, data)
  } catch (err) {
    logger.error('Error in getAllPosts:', { error: err, userId: req.user?.id })
    errorResponse(res, 'Failed to fetch posts')
  }
}