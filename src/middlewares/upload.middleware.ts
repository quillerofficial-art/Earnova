import multer from 'multer'
import path from 'path'

const storage = multer.memoryStorage()

// ✅ FIX: Enhanced file filter
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'image/heic',
  'image/heif',
]

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WEBP are allowed.'))
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase()
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Invalid file extension'))
  }
  
  // Sanitize filename
  file.originalname = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '')
  
  cb(null, true)
}

const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 // Max 1 file
  },
  fileFilter,
})

export const uploadSingle = upload.single('profilePic')
export const uploadProductImage = upload.single('image')