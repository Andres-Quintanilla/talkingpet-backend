import { Router } from 'express';
import * as ctrl from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

r.get('/', ctrl.list);

r.get('/:id', ctrl.getById);

r.post('/', requireAuth, requireRole('admin'), ctrl.create);
r.put('/:id', requireAuth, requireRole('admin'), ctrl.update);
r.delete('/:id', requireAuth, requireRole('admin'), ctrl.remove);

export default r;
