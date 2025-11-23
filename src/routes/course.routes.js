// src/routes/course.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const r = Router();

const EMPLEADO_ROLES = [
  'admin',
  'empleado',
  'empleado_peluquero',
  'empleado_veterinario',
  'empleado_adiestrador',
];

// ---------- PÚBLICO ----------
r.get('/', ctrl.listPublic);          // listado cursos publicados
r.get('/:id', ctrl.getById);          // detalle curso público

// ---------- ADMIN / EMPLEADO ----------

// listado completo para ADMIN (ya lo usabas)
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
