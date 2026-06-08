import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg',
  'application/octet-stream'
];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.avi', '.mpeg'];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  if (file.mimetype === 'application/octet-stream') {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
      return;
    }
  }
  cb(new Error('Invalid file type. Only images and videos are allowed.'));
};

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter,
});

export const uploadPostMedia = (req: Request, res: Response, next: NextFunction) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

export const uploadSingle = upload.single('profilePic');
export const uploadProductImage = upload.single('image');