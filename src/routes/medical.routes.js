import { Router } from 'express';
import * as ctrl from '../controllers/medical.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { uploader } from '../utils/upload.js';
import { pool } from '../config/db.js'; 

const r = Router();
const CLIENTE_VET_ROLES = ['cliente', 'admin', 'empleado_veterinario'];
const VET_ROLES = ['admin', 'empleado_veterinario'];

r.get('/mis-mascotas', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, especie, raza, edad, genero 
       FROM mascota 
       WHERE usuario_id = $1 
       ORDER BY nombre ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.post('/mascotas', requireAuth, async (req, res, next) => {
  try {
    const { nombre, especie, raza, edad, genero } = req.body;

    if (!nombre || !especie || !genero) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, especie y género son requeridos',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO mascota (nombre, especie, raza, edad, genero, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, especie, raza, edad, genero`,
      [
        nombre,
        especie,
        raza || null,
        typeof edad === 'number' ? edad : (edad ? Number(edad) : null),
        genero,
        req.user.id,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

r.get('/pet/:id/expediente', requireAuth, ctrl.getExpedienteCompleto);
r.post(
  '/pet/:id/expediente',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.createExpedienteInicial
);

r.get('/pet/:id/vacunas', requireAuth, ctrl.getVacunas);
r.post(
  '/pet/:id/vacuna',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.addVacuna
);
r.put(
  '/vacuna/:vacunaId',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.updateVacuna
);
r.delete(
  '/vacuna/:vacunaId',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.deleteVacuna
);

r.get('/pet/:id/consultas', requireAuth, ctrl.getConsultas);
r.post(
  '/pet/:id/consulta',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.addConsulta
);

r.get('/pet/:id/medicamentos', requireAuth, ctrl.getMedicamentos);
r.post(
  '/pet/:id/medicamento',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.addMedicamento
);
r.put(
  '/medicamento/:medicamentoId',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.updateMedicamento
);

r.get('/pet/:id/peso', requireAuth, ctrl.getPeso);
r.post(
  '/pet/:id/peso',
  requireAuth,
  requireRole(...CLIENTE_VET_ROLES), 
  ctrl.addPeso
);

r.get('/pet/:id/alergias', requireAuth, ctrl.getAlergias);
r.post(
  '/pet/:id/alergia',
  requireAuth,
  requireRole(...VET_ROLES),
  ctrl.addAlergia
);

r.get('/pet/:id/documentos', requireAuth, ctrl.getDocumentos);
r.post(
  '/pet/:id/documento',
  requireAuth,
  requireRole(...CLIENTE_VET_ROLES), 
  uploader.single('file'),
  ctrl.addDocumento
);

r.get('/pet/:id/alertas', requireAuth, ctrl.getAlertas);
r.post(
  '/pet/:id/alerta',
  requireAuth,
  requireRole(...CLIENTE_VET_ROLES),
  ctrl.addAlerta
);
r.put(
  '/alerta/:alertaId/completar',
  requireAuth,
  requireRole(...CLIENTE_VET_ROLES),
  ctrl.completeAlerta
);

export default r;
