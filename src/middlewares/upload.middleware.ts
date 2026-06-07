import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'
];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.avi', '.mpeg'];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only images and videos are allowed.'));
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Invalid file extension'));
  }
  file.originalname = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '');
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 }, // 30MB
  fileFilter,
});

// ✅ यहाँ हम एक middleware फ़ंक्शन बनाते हैं जो error को हैंडल करता है
export const uploadPostMedia = (req: Request, res: Response, next: NextFunction) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// अन्य exports (यदि आपके पास पहले से हैं)
export const uploadSingle = upload.single('profilePic');
export const uploadProductImage = upload.single('image');