// src/routes/course.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

const EMPLEADO_ROLES = [
  'admin',
  'empleado',
];

// ---------- PÚBLICO ----------
// listado cursos publicados
r.get('/', ctrl.list);       
// detalle curso público (debe ir al final de las rutas específicas)
r.get('/:id', ctrl.getById);

// ---------- ADMIN / EMPLEADO ----------

// listado completo para ADMIN
r.get(
  '/admin/list',
  requireAuth,
  requireRole('admin'),
  ctrl.adminList
);

// listado completo para EMPLEADO (reusa adminList)
r.get(
  '/employee/list',
  requireAuth,
  requireRole(...EMPLEADO_ROLES),
  ctrl.adminList
);

// CRUD solo admin
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
