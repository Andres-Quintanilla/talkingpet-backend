// src/routes/order.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

/**
 * Nuevo: checkout basado en los items que manda el front
 * (productos + servicios + cursos) -> crea pedido + pedido_item + cita(s)
 * POST /api/orders
 */
r.post('/', requireAuth, ctrl.createOrderFromPayload);

// Admin: KPIs y últimos pedidos
r.get(
  '/admin/summary',
  requireAuth,
  requireRole('admin'),
  ctrl.getAdminSummary
);

// Admin: listar todos los pedidos
r.get(
  '/',
  requireAuth,
  requireRole('admin'),
  ctrl.listAll
);

// Checkout antiguo, basado en la tabla carrito/carrito_item
// (lo mantenemos por compatibilidad, pero el front nuevo usará POST /api/orders)
r.post('/checkout', requireAuth, ctrl.checkoutFromCart);

// Pedidos del usuario logueado
r.get('/mine', requireAuth, ctrl.myOrders);

// Tracking de envío
r.get('/:id/track', requireAuth, ctrl.track);

// Detalle de un pedido (cliente o admin)
r.get('/:id', requireAuth, ctrl.getById);

export default r;
