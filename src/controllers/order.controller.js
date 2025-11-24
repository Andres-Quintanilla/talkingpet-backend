// src/controllers/order.controller.js
import { pool } from '../config/db.js';

/**
 * NUEVO FLUJO:
 * POST /api/orders
 *
 * Body esperado:
 * {
 *   items: [
 *     {
 *       id,
 *       tipo_item: 'producto' | 'servicio' | 'curso',
 *       producto_id?, servicio_id?, curso_id?,
 *       nombre,
 *       precio,
 *       qty,
 *       detalle_servicio?: {
 *         servicio: { id, nombre, tipo },
 *         mascotas: [ { id, nombre, especie }, ... ],
 *         modalidad: 'local' | 'domicilio' | 'retiro_entrega',
 *         fecha: 'YYYY-MM-DD',
 *         hora: 'HH:MM',
 *         comentarios,
 *         direccion: {
 *           referencia,
 *           numero_casa?,
 *           manzano?,
 *           lat?,
 *           lng?
 *         }
 *       }
 *     }
 *   ],
 *   subtotal,
 *   shipping,
 *   total,
 *   metodo_pago,
 *   direccion_envio
 * }
 */
export async function createOrderFromPayload(req, res, next) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const {
      items = [],
      subtotal = 0,
      shipping = 0,
      total = 0,
      metodo_pago = 'efectivo',
      direccion_envio = null,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay items en el pedido.' });
    }

    await client.query('BEGIN');

    // 1) Crear pedido
    const { rows: orderRows } = await client.query(
      `INSERT INTO pedido (usuario_id, total, estado, fecha_pedido, direccion_envio)
       VALUES ($1, $2, 'pendiente', NOW(), $3)
       RETURNING id, total, estado`,
      [userId, total, direccion_envio]
    );
    const pedido = orderRows[0];
    const pedidoId = pedido.id;

    // 2) Recorrer items
    for (const it of items) {
      const tipo = it.tipo_item || 'producto';
      const qty = Number(it.qty || 1);
      const precioUnit = Number(it.precio || 0);

      // decidir ids según tipo
      const productoId =
        tipo === 'producto' ? (it.producto_id || it.id) : null;
      const cursoId =
        tipo === 'curso' ? (it.curso_id || it.id) : null;

      // 2.1) Crear snapshot en pedido_item (ahora con curso_id)
      await client.query(
        `INSERT INTO pedido_item (
           pedido_id,
           producto_id,
           curso_id,
           nombre_producto,
           precio_unitario,
           cantidad
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          pedidoId,
          productoId,
          cursoId,
          it.nombre || (tipo === 'servicio' ? 'Servicio' : 'Item'),
          precioUnit,
          qty,
        ]
      );

      // 2.2) Si es SERVICIO → crear citas reales en la tabla "cita"
      if (tipo === 'servicio' && it.detalle_servicio) {
        const det = it.detalle_servicio;

        const servicioId = det.servicio?.id || it.servicio_id;
        const modalidad = det.modalidad || 'local';
        const fecha = det.fecha; // YYYY-MM-DD
        const hora = det.hora;   // HH:MM
        const comentarios = det.comentarios || '';

        const dir = det.direccion || {};
        const direccionRef = dir.referencia || null;
        const lat = dir.lat ?? dir.latitud ?? null;
        const lng = dir.lng ?? dir.longitud ?? null;

        if (!servicioId || !fecha || !hora || !Array.isArray(det.mascotas)) {
          console.warn(
            'Item de servicio con datos incompletos para crear cita:',
            it
          );
        } else {
          for (const m of det.mascotas) {
            const mascotaId = m.id;
            if (!mascotaId) continue;

            const comentariosFinales = [
              comentarios,
              direccionRef ? `Dirección: ${direccionRef}` : null,
            ]
              .filter(Boolean)
              .join(' | ');

            await client.query(
              `INSERT INTO cita (
                 usuario_id,
                 mascota_id,
                 servicio_id,
                 empleado_id,
                 modalidad,
                 estado,
                 fecha,
                 hora,
                 comentarios,
                 pedido_id,
                 direccion_referencia,
                 latitud,
                 longitud
               )
               VALUES (
                 $1, $2, $3, NULL,
                 $4, 'pendiente',
                 $5, $6, $7,
                 $8,
                 $9, $10, $11
               )`,
              [
                userId,
                mascotaId,
                servicioId,
                modalidad,
                fecha,
                hora,
                comentariosFinales || null,
                pedidoId,
                direccionRef,
                lat,
                lng,
              ]
            );
          }
        }
      }

      // 2.3) Si es CURSO → crear inscripción en inscripcion_curso
      if (tipo === 'curso' && cursoId) {
        await client.query(
          `INSERT INTO inscripcion_curso
             (usuario_id, curso_id, titulo_snapshot, precio_snapshot)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, curso_id) DO NOTHING`,
          [
            userId,
            cursoId,
            it.nombre || 'Curso',
            precioUnit,
          ]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: pedidoId,
      total: pedido.total,
      estado: pedido.estado,
      message:
        'Pedido creado correctamente. Las citas asociadas se han registrado como pendientes.',
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('createOrderFromPayload error:', e);
    next(e);
  } finally {
    client.release();
  }
}

/**
 * === FLUJO ANTIGUO: checkout usando la tabla carrito ===
 * POST /api/orders/checkout
 */
export async function checkoutFromCart(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cart = await client.query(
      'SELECT id FROM carrito WHERE usuario_id=$1',
      [req.user.id]
    );
    if (!cart.rows[0]) throw new Error('Carrito inexistente');

    const items = await client.query(
      `SELECT ci.*, p.nombre 
       FROM carrito_item ci 
       INNER JOIN producto p ON p.id=ci.producto_id 
       WHERE carrito_id=$1`,
      [cart.rows[0].id]
    );
    if (!items.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Carrito vacío' });
    }

    const total = items.rows.reduce((t, it) => t + Number(it.subtotal), 0);

    const { rows: orderRows } = await client.query(
      `INSERT INTO pedido (usuario_id, total, estado, direccion_envio)
       VALUES ($1,$2,'pendiente',$3)
       RETURNING id, total, estado`,
      [req.user.id, total, req.body.direccion_envio || null]
    );
    const order = orderRows[0];

    await client.query('COMMIT');
    res.status(201).json({ order });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

export async function myOrders(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pedido WHERE usuario_id=$1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM pedido WHERE id=$1 AND (usuario_id=$2 OR $3=TRUE)',
      [id, req.user.id, req.user.rol === 'admin']
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function listAll(_req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pedido ORDER BY id DESC'
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function track(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT e.estado, e.lat, e.lng, e.fecha_envio, e.fecha_entrega
       FROM envio e 
       JOIN pedido p ON p.id=e.pedido_id
       WHERE p.id=$1 AND p.usuario_id=$2 LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Sin tracking' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function getAdminSummary(req, res, next) {
  try {
    const { rows: kpiRows } = await pool.query(`
      SELECT
        COUNT(*)                                        AS total_pedidos,
        COUNT(*) FILTER (WHERE estado = 'pagado')       AS pedidos_pagados,
        COALESCE(SUM(total) FILTER (WHERE estado = 'pagado'), 0) AS total_ingresos
      FROM pedido
    `);

    const { rows: recientes } = await pool.query(`
      SELECT
        p.id,
        p.total,
        p.estado,
        p.fecha_pedido,
        u.nombre AS cliente
      FROM pedido p
      LEFT JOIN usuario u ON u.id = p.usuario_id
      ORDER BY p.fecha_pedido DESC
      LIMIT 5
    `);

    res.json({
      kpis: kpiRows[0],
      recientes,
    });
  } catch (err) {
    next(err);
  }
}
