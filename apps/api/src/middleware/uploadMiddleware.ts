import multer from 'multer';
import path from 'node:path';

// Files are held in memory, checked by their real content, then written to disk by the route.
// Vercel serverless request body limit is ~4.5 MB.
const memory = (maxMb: number, exts: string[], message: string) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(maxMb * 1024 * 1024), files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!exts.includes(ext)) return cb(Object.assign(new Error(message), { status: 400 }));
      cb(null, true);
    },
  });

export const uploadBackground = memory(4.5, ['.pdf', '.png', '.jpg', '.jpeg'], 'Certificates must be a PDF, PNG or JPG.');
export const uploadImage = memory(4.5, ['.png', '.jpg', '.jpeg'], 'Images must be PNG or JPG.');
export const uploadSpreadsheet = memory(4.5, ['.xlsx', '.xls', '.csv'], 'Lists must be an Excel (.xlsx, .xls) or CSV file.');
