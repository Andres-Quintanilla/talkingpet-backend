// src/routes/course.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

const EMPLEADO_ROLES = ['admin', 'empleado'];

/**
 * IMPORTANTE:
 * Las rutas más específicas (como /mine, /admin/list, /:id/enroll)
 * SIEMPRE deben ir ANTES de la ruta genérica '/:id'
 */

// ---------- PÚBLICO ----------

// Lista de cursos publicados
r.get('/', ctrl.list);

// ---------- CLIENTE (AUTENTICADO) ----------

// Mis cursos (los que están en inscripcion_curso)
r.get('/mine', requireAuth, ctrl.mine);

// Inscripción manual a un curso (también la usa el autoEnroll del front)
r.post('/:id/enroll', requireAuth, ctrl.enroll);

// ---------- ADMIN / EMPLEADO ----------

r.get(
  '/admin/list',
  requireAuth,
  requireRole('admin'),
  ctrl.adminList
);

r.get(
  '/employee/list',
  requireAuth,
  requireRole(...EMPLEADO_ROLES),
  ctrl.adminList
);

// ---------- DETALLE DE CURSO (PÚBLICO) ----------
// ¡OJO! Esta va AL FINAL
r.get('/:id', ctrl.getById);

// ---------- CRUD ADMIN ----------

r.post(
  '/',
  requireAuth,
  requireRole('admin'),
  ctrl.create
);

r.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  ctrl.update
);

r.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  ctrl.remove
);

export default r;
