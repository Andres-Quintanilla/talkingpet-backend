import { pool } from '../config/db.js';

export async function list(_req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         nombre,
         tipo,
         descripcion,
         precio_base,
         duracion_minutos,
         imagen_url
       FROM servicio
       ORDER BY id DESC`
    );

    res.set('Cache-Control', 'no-store');

    return res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const {
      nombre,
      tipo,
      descripcion,
      precio_base,
      duracion_minutos,
      imagen_url,
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!tipo) {
      return res.status(400).json({ error: 'El tipo de servicio es obligatorio' });
    }

    const precioNum = Number(precio_base);
    const duracionNum =
      duracion_minutos !== undefined && duracion_minutos !== null
        ? Number(duracion_minutos)
        : 60;

    if (Number.isNaN(precioNum) || precioNum <= 0) {
      return res
        .status(400)
        .json({ error: 'El precio base debe ser un número mayor a 0' });
    }

    if (Number.isNaN(duracionNum) || duracionNum <= 0) {
      return res
        .status(400)
        .json({ error: 'La duración debe ser un número mayor a 0' });
    }

    const { rows } = await pool.query(
      `INSERT INTO servicio
        (nombre, tipo, descripcion, precio_base, duracion_minutos, imagen_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING
         id,
         nombre,
         tipo,
         descripcion,
         precio_base,
         duracion_minutos,
         imagen_url`,
      [
        nombre.trim(),
        tipo,
        descripcion || null,
        precioNum,
        duracionNum,
        imagen_url || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const idNum = Number(id);
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const {
      nombre,
      tipo,
      descripcion,
      precio_base,
      duracion_minutos,
      imagen_url,
    } = req.body;

    const precioNum =
      precio_base !== undefined && precio_base !== null
        ? Number(precio_base)
        : null;
    const duracionNum =
      duracion_minutos !== undefined && duracion_minutos !== null
        ? Number(duracion_minutos)
        : null;

    if (precioNum !== null && (Number.isNaN(precioNum) || precioNum <= 0)) {
      return res
        .status(400)
        .json({ error: 'El precio base debe ser un número mayor a 0' });
    }
    if (duracionNum !== null && (Number.isNaN(duracionNum) || duracionNum <= 0)) {
      return res
        .status(400)
        .json({ error: 'La duración debe ser un número mayor a 0' });
    }

    const { rows } = await pool.query(
      `UPDATE servicio 
       SET 
         nombre           = COALESCE($2, nombre),
         tipo             = COALESCE($3, tipo),
         descripcion      = COALESCE($4, descripcion),
         precio_base      = COALESCE($5, precio_base),
         duracion_minutos = COALESCE($6, duracion_minutos),
         imagen_url       = COALESCE($7, imagen_url)
       WHERE id = $1
       RETURNING
         id,
         nombre,
         tipo,
         descripcion,
         precio_base,
         duracion_minutos,
         imagen_url`,
      [
        idNum,
        nombre ? nombre.trim() : null,
        tipo ?? null,
        descripcion ?? null,
        precioNum,
        duracionNum,
        imagen_url ?? null,
      ]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const idNum = Number(id);
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM servicio WHERE id = $1',
      [idNum]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
