import { Request, Response } from 'express'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '../config/storage'
import { supabase, supabaseAdmin } from '../config/supabase'
import { v4 as uuidv4 } from 'uuid'
import { uploadToBackblaze } from '../utils/s3Upload'
import logger from '../utils/logger'

export const uploadProfilePic = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const publicUrl = await uploadToBackblaze(req.file, 'profile-pics');

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ profile_pic_url: publicUrl })
      .eq('id', req.user!.id);

    if (updateError) throw updateError;

    res.json({
      message: 'Profile picture uploaded successfully',
      url: publicUrl,
    });
  } catch (error) {
    logger.error('Error in uploadProfilePic:', { error, userId: req.user?.id });
    res.status(500).json({ message: 'Failed to upload profile picture' });
  }
};