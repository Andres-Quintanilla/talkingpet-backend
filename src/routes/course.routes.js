import { Router } from 'express';
import * as c from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

r.get('/', c.list); 

r.get('/mine', requireAuth, c.mine);                
r.post('/:id/inscribirme', requireAuth, c.enroll);     

r.get(
  '/admin/list',
  requireAuth,
  requireRole('admin'),
  c.adminList
);

r.get('/:id', c.getById);                              

r.post('/', requireAuth, requireRole('admin'), c.create);
r.put('/:id', requireAuth, requireRole('admin'), c.update);
r.delete('/:id', requireAuth, requireRole('admin'), c.remove);

export default r;
