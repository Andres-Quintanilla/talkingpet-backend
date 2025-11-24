// src/routes/order.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

/**
 * =====================================================
 *     NUEVO CHECKOUT (PRODUCTOS + SERVICIOS + CURSOS)
 * =====================================================
 *
 *  POST /api/orders
 *  Crea un pedido con:
 *   - pedido
 *   - pedido_item
 *   - cita(s) si hay servicios
 *
 *  NOTA: La inscripción a cursos se hace al confirmar pago.
 */
r.post('/', requireAuth, ctrl.createOrderFromPayload);


/**
 * =====================================================
 *                     ADMIN
 * =====================================================
 */

// KPIs de administración
r.get(
  '/admin/summary',
  requireAuth,
  requireRole('admin'),
  ctrl.getAdminSummary
);

// Listar todos los pedidos (admin)
r.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  ctrl.listAll
);


/**
 * =====================================================
 *              CHECKOUT ANTIGUO (CARRO)
 * =====================================================
 *  Esto es opcional, se mantiene por compatibilidad
 *  POST /api/orders/checkout
 */
r.post('/checkout', requireAuth, ctrl.checkoutFromCart);


/**
 * =====================================================
 *               PEDIDOS DEL USUARIO (CLIENTE)
 * =====================================================
 */

// Lista todos los pedidos del cliente actual
// GET /api/orders/mine
r.get('/mine', requireAuth, ctrl.myOrders);


/**
 * =====================================================
 *                   TRACKING DE ENVÍO
 * =====================================================
 */
r.get('/:id/track', requireAuth, ctrl.track);


/**
 * =====================================================
 *           DETALLE DE UN PEDIDO (CLIENTE / ADMIN)
 * =====================================================
 */
r.get('/:id', requireAuth, ctrl.getById);


export default r;
