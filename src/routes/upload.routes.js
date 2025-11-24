// src/routes/upload.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadOne } from '../controllers/upload.controller.js';
import { uploader } from '../utils/upload.js';

const r = Router();

// Sube UN archivo en el campo "file"
r.post('/', requireAuth, uploader.single('file'), uploadOne);

export default r;
