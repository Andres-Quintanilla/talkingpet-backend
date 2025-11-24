// src/utils/upload.js
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta absoluta compartida por TODO el backend
export const uploadDir =
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Carpeta de uploads creada en:', uploadDir);
} else {
  console.log('📁 Carpeta de uploads usada:', uploadDir);
}

// Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.\-_]/g, '-');

    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const uploader = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 200, // 200 MB
  },
});
