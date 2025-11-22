import { Router } from 'express';
import * as ctrl from '../controllers/booking.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();
const EMPLEADO_ROLES = [
  'admin',
  'empleado_peluquero',
  'empleado_veterinario',
  'empleado_adiestrador',
];

r.get(
  '/admin/summary',
  requireAuth,
  requireRole('admin'),
  ctrl.getAdminSummary
);

r.get('/availability', ctrl.getAvailability);

r.post('/', requireAuth, ctrl.create);
r.get('/mine', requireAuth, ctrl.mine);

r.get('/all', requireAuth, requireRole(...EMPLEADO_ROLES), ctrl.listAll);

r.patch(
  '/:id/status',
  requireAuth,
  requireRole(...EMPLEADO_ROLES),
  ctrl.updateStatus
);

export default r;
