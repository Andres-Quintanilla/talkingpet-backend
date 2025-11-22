import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

export async function getMyProfile(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, email, telefono, rol, activo, fecha_registro, saldo, tema
       FROM usuario WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function listAllUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const q = (req.query.q || '').trim();

    let where = '';
    const params = [limit, offset];

    if (q) {
      where = 'WHERE nombre ILIKE $3 OR email ILIKE $3';
      params.push(`%${q}%`);
    }

    const { rows } = await pool.query(
      `SELECT id, nombre, email, telefono, rol, activo, fecha_registro, saldo
       FROM usuario
       ${where}
       ORDER BY id DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ page, limit, items: rows });
  } catch (e) {
    next(e);
  }
}

export async function updateTheme(req, res, next) {
  try {
    const { tema } = req.body;
    if (!['light', 'dark', 'system'].includes(tema)) {
      return res.status(400).json({ error: 'Tema inválido' });
    }
    const { rows } = await pool.query(
      'UPDATE usuario SET tema = $1 WHERE id = $2 RETURNING id, tema',
      [tema, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function createUser(req, res, next) {
  try {
    const { nombre, email, telefono, rol, activo, saldo } = req.body;

    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son obligatorios.' });
    }

    const allowedRoles = [
      'cliente',
      'admin',
      'empleado_peluquero',
      'empleado_veterinario',
      'empleado_adiestrador',
    ];

    const finalRol = rol || 'cliente';
    if (!allowedRoles.includes(finalRol)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }

    const exists = await pool.query(
      'SELECT 1 FROM usuario WHERE lower(email)=lower($1) OR lower(nombre)=lower($2)',
      [email, nombre]
    );
    if (exists.rowCount) {
      return res.status(409).json({ error: 'Email o usuario ya existe.' });
    }

    const defaultPassword = '123456';
    const hash = await bcrypt.hash(defaultPassword, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuario (nombre, email, telefono, contrasena, rol, activo, saldo)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, TRUE),COALESCE($7,0))
       RETURNING id, nombre, email, telefono, rol, activo, fecha_registro, saldo, tema`,
      [
        nombre,
        email,
        telefono || null,
        hash,
        finalRol,
        typeof activo === 'boolean' ? activo : null,
        typeof saldo === 'number' ? saldo : null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function updateUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { nombre, email, telefono, rol, activo, saldo } = req.body;

    const allowedRoles = [
      'cliente',
      'admin',
      'empleado_peluquero',
      'empleado_veterinario',
      'empleado_adiestrador',
    ];

    if (rol && !allowedRoles.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    if (req.user.id === id) {
      if (rol && rol !== 'admin') {
        return res
          .status(400)
          .json({ error: 'No puedes cambiar tu propio rol de administrador.' });
      }
      if (typeof activo === 'boolean' && !activo) {
        return res
          .status(400)
          .json({ error: 'No puedes desactivar tu propia cuenta.' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE usuario
       SET
         nombre   = COALESCE($1, nombre),
         email    = COALESCE($2, email),
         telefono = COALESCE($3, telefono),
         rol      = COALESCE($4, rol),
         activo   = COALESCE($5, activo),
         saldo    = COALESCE($6, saldo)
       WHERE id = $7
       RETURNING id, nombre, email, telefono, rol, activo, fecha_registro, saldo, tema`,
      [
        nombre ?? null,
        email ?? null,
        telefono ?? null,
        rol ?? null,
        typeof activo === 'boolean' ? activo : null,
        typeof saldo === 'number' ? saldo : null,
        id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    if (req.user.id === id) {
      return res
        .status(400)
        .json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    const { rows } = await pool.query(
      'DELETE FROM usuario WHERE id = $1 RETURNING id',
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
