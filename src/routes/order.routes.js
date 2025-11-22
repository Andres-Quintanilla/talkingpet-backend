import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

r.get(
  '/admin/summary',
  requireAuth,
  requireRole('admin'),
  ctrl.getAdminSummary
);

r.get(
  '/',
  requireAuth,
  requireRole('admin'),
  ctrl.listAll
);

r.post('/checkout', requireAuth, ctrl.checkoutFromCart);
r.get('/mine', requireAuth, ctrl.myOrders);

r.get('/:id/track', requireAuth, ctrl.track);

r.get('/:id', requireAuth, ctrl.getById);

export default r;
