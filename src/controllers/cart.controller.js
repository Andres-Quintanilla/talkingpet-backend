import { pool } from '../config/db.js';

async function ensureCart(userId) {
  const find = await pool.query(
    'SELECT id FROM carrito WHERE usuario_id = $1',
    [userId]
  );
  if (find.rows[0]) return find.rows[0].id;

  const ins = await pool.query(
    'INSERT INTO carrito (usuario_id) VALUES ($1) RETURNING id',
    [userId]
  );
  return ins.rows[0].id;
}

export async function getMyCart(req, res, next) {
  try {
    const cartId = await ensureCart(req.user.id);

    const { rows } = await pool.query(
      `SELECT
         ci.id,
         ci.producto_id,
         ci.curso_id,
         ci.tipo_item,
         COALESCE(p.nombre, c.titulo)       AS nombre,
         COALESCE(p.imagen_url, c.portada_url) AS imagen_url,
         ci.cantidad,
         ci.precio_unitario,
         ci.subtotal
       FROM carrito_item ci
       LEFT JOIN producto p ON p.id = ci.producto_id
       LEFT JOIN curso    c ON c.id = ci.curso_id
       WHERE ci.carrito_id = $1
       ORDER BY ci.id DESC`,
      [cartId]
    );

    const total = rows.reduce((t, it) => t + Number(it.subtotal), 0);
    res.json({ items: rows, total });
  } catch (e) {
    next(e);
  }
}

export async function addItem(req, res, next) {
  try {
    const { producto_id, curso_id, cantidad = 1 } = req.body;
    const cartId = await ensureCart(req.user.id);

    if (producto_id) {
      const p = await pool.query(
        'SELECT id, precio FROM producto WHERE id = $1',
        [producto_id]
      );
      if (!p.rows[0]) {
        return res.status(404).json({ error: 'Producto no existe' });
      }

      await pool.query(
        `INSERT INTO carrito_item
           (carrito_id, producto_id, curso_id, tipo_item, cantidad, precio_unitario)
         VALUES ($1, $2, NULL, 'producto', $3, $4)
         ON CONFLICT (carrito_id, producto_id)
         DO UPDATE
           SET cantidad = carrito_item.cantidad + EXCLUDED.cantidad`,
        [cartId, producto_id, cantidad, p.rows[0].precio]
      );

      return getMyCart(req, res, next);
    }

    if (curso_id) {
      const c = await pool.query(
        'SELECT id, precio FROM curso WHERE id = $1 AND estado = $2',
        [curso_id, 'publicado']
      );
      if (!c.rows[0]) {
        return res.status(404).json({ error: 'Curso no existe o no está publicado' });
      }

      const precio = c.rows[0].precio ?? 0;


      await pool.query(
        `INSERT INTO carrito_item
           (carrito_id, producto_id, curso_id, tipo_item, cantidad, precio_unitario)
         VALUES ($1, NULL, $2, 'curso', 1, $3)`,
        [cartId, curso_id, precio]
      );

      return getMyCart(req, res, next);
    }

    return res
      .status(400)
      .json({ error: 'Debes enviar producto_id o curso_id' });
  } catch (e) {
    next(e);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { producto_id, cantidad } = req.body;
    const cartId = await ensureCart(req.user.id);

    await pool.query(
      `UPDATE carrito_item
       SET cantidad = $1
       WHERE carrito_id = $2 AND producto_id = $3`,
      [cantidad, cartId, producto_id]
    );

    return getMyCart(req, res, next);
  } catch (e) {
    next(e);
  }
}

export async function removeItem(req, res, next) {
  try {
    const { producto_id, curso_id } = req.body;
    const cartId = await ensureCart(req.user.id);

    if (producto_id) {
      await pool.query(
        `DELETE FROM carrito_item
         WHERE carrito_id = $1 AND producto_id = $2`,
        [cartId, producto_id]
      );
    } else if (curso_id) {
      await pool.query(
        `DELETE FROM carrito_item
         WHERE carrito_id = $1 AND curso_id = $2`,
        [cartId, curso_id]
      );
    }

    return getMyCart(req, res, next);
  } catch (e) {
    next(e);
  }
}

export async function clearCart(req, res, next) {
  try {
    const cartId = await ensureCart(req.user.id);
    await pool.query(`DELETE FROM carrito_item WHERE carrito_id = $1`, [
      cartId,
    ]);
    return getMyCart(req, res, next);
  } catch (e) {
    next(e);
  }
}
