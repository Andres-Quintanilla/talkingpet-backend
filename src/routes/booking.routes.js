// src/routes/booking.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/booking.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

// Roles que pueden ver/gestionar citas en el panel
const EMP_ROLES = ['admin', 'empleado'];

// Resumen para dashboard ADMIN
r.get(
  '/admin/summary',
  requireAuth,
  requireRole('admin'),
  ctrl.getAdminSummary
);

// Disponibilidad pública (para el formulario de agendar)
r.get('/availability', ctrl.getAvailability);

// Crear cita como cliente
r.post('/', requireAuth, ctrl.create);

// Citas del cliente logueado (Mis servicios)
r.get('/mine', requireAuth, ctrl.mine);

// Lista completa de citas para panel empleado/admin
r.get(
  '/all',
  requireAuth,
  requireRole(...EMP_ROLES),
  ctrl.listAll
);

// Cambiar estado de una cita (empleado + admin)
r.patch(
  '/:id/status',
  requireAuth,
  requireRole(...EMP_ROLES),
  ctrl.updateStatus
);

export default r;
