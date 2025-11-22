import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { uploader } from '../utils/upload.js';
import * as ctrl from '../controllers/upload.controller.js';

const r = Router();
r.post('/', requireAuth, requireRole('admin'), uploader.single('file'), ctrl.uploadOne);
export default r;
