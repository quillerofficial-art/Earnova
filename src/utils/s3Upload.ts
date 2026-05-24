import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from '../config/storage'
import { v4 as uuidv4 } from 'uuid'

export const uploadToBackblaze = async (
  file: Express.Multer.File,
  folder: string
): Promise<string> => {
  const fileExt = file.originalname.split('.').pop()
  const fileName = `${folder}/${uuidv4()}.${fileExt}`

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,               // ← R2_BUCKET_NAME
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  })

  await s3Client.send(command)

  // R2 public URL format
  return `${process.env.R2_PUBLIC_URL}/${fileName}`;
}