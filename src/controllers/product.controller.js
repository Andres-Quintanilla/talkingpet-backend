import { pool } from '../config/db.js';

export async function list(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE nombre ILIKE $${params.length}`;
    }

    const totalQuery = `SELECT COUNT(*) FROM producto ${where}`;
    const totalResult = await pool.query(totalQuery, params);
    const total = Number(totalResult.rows[0]?.count || 0);

    params.push(limit, offset);

    const itemsQuery = `
      SELECT
        id,
        nombre,
        descripcion,
        precio,
        stock,
        categoria,
        estado,
        es_destacado,
        imagen_url
      FROM producto
      ${where}
      ORDER BY id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(itemsQuery, params);

    res.set('Cache-Control', 'no-store');

    res.json({
      page,
      limit,
      total,
      items: rows,
    });
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         nombre,
         descripcion,
         precio,
         stock,
         categoria,
         estado,
         es_destacado,
         imagen_url
       FROM producto
       WHERE id = $1`,
      [id]
    );

    const producto = rows[0];
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.set('Cache-Control', 'no-store');
    res.json(producto);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const {
      nombre,
      descripcion = null,
      precio,
      stock,
      categoria = null,
      estado = 'borrador',
      es_destacado = false,
      imagen_url = null,
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const precioNum =
      precio !== undefined && precio !== null ? Number(precio) : null;
    const stockNum =
      stock !== undefined && stock !== null ? Number(stock) : 0;

    if (precioNum === null || Number.isNaN(precioNum) || precioNum < 0) {
      return res
        .status(400)
        .json({ error: 'El precio debe ser un número mayor o igual a 0' });
    }
    if (Number.isNaN(stockNum) || stockNum < 0) {
      return res
        .status(400)
        .json({ error: 'El stock debe ser un número mayor o igual a 0' });
    }

    const { rows } = await pool.query(
      `INSERT INTO producto
        (nombre, descripcion, precio, stock, categoria, estado, es_destacado, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         id,
         nombre,
         descripcion,
         precio,
         stock,
         categoria,
         estado,
         es_destacado,
         imagen_url`,
      [
        nombre.trim(),
        descripcion || null,
        precioNum,
        stockNum,
        categoria || null,
        estado || 'borrador',
        Boolean(es_destacado),
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
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const {
      nombre,
      descripcion,
      precio,
      stock,
      categoria,
      estado,
      es_destacado,
      imagen_url,
    } = req.body;

    const precioNum =
      precio !== undefined && precio !== null ? Number(precio) : null;
    const stockNum =
      stock !== undefined && stock !== null ? Number(stock) : null;

    if (precioNum !== null && (Number.isNaN(precioNum) || precioNum < 0)) {
      return res
        .status(400)
        .json({ error: 'El precio debe ser un número mayor o igual a 0' });
    }
    if (stockNum !== null && (Number.isNaN(stockNum) || stockNum < 0)) {
      return res
        .status(400)
        .json({ error: 'El stock debe ser un número mayor o igual a 0' });
    }

    const { rows } = await pool.query(
      `UPDATE producto
       SET
         nombre       = COALESCE($2, nombre),
         descripcion  = COALESCE($3, descripcion),
         precio       = COALESCE($4, precio),
         stock        = COALESCE($5, stock),
         categoria    = COALESCE($6, categoria),
         estado       = COALESCE($7, estado),
         es_destacado = COALESCE($8, es_destacado),
         imagen_url   = COALESCE($9, imagen_url)
       WHERE id = $1
       RETURNING
         id,
         nombre,
         descripcion,
         precio,
         stock,
         categoria,
         estado,
         es_destacado,
         imagen_url`,
      [
        id,
        nombre ? nombre.trim() : null,
        descripcion ?? null,
        precioNum,
        stockNum,
        categoria ?? null,
        estado ?? null,
        es_destacado ?? null,
        imagen_url ?? null,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM producto WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
