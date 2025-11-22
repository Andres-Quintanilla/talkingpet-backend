import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import * as ctrl from '../controllers/user.controller.js';

const r = Router();

r.get('/me', requireAuth, ctrl.getMyProfile);
r.patch('/theme', requireAuth, ctrl.updateTheme);

r.get('/', requireAuth, requireRole('admin'), ctrl.listAllUsers);
r.post('/', requireAuth, requireRole('admin'), ctrl.createUser);
r.patch('/:id', requireAuth, requireRole('admin'), ctrl.updateUser);
r.delete('/:id', requireAuth, requireRole('admin'), ctrl.deleteUser);

export default r;
