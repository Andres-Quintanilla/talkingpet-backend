// src/controllers/order.controller.js
import { pool } from '../config/db.js';

export async function createOrderFromPayload(req, res, next) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const {
      items = [],
      subtotal = 0, // ya no lo usamos como fuente de verdad
      shipping = 0,
      total = 0, // tampoco lo usamos como fuente de verdad
      metodo_pago = 'efectivo',
      direccion_envio = null,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay items en el pedido.' });
    }

    await client.query('BEGIN');

    // 1) Crear pedido con un total provisional (lo actualizaremos al final)
    const { rows: orderRows } = await client.query(
      `INSERT INTO pedido (usuario_id, total, estado, fecha_pedido, direccion_envio)
       VALUES ($1, $2, 'pagado', NOW(), $3)
       RETURNING id, total, estado`,
      [userId, Number(total) || 0, direccion_envio]
    );

    const pedido = orderRows[0];
    const pedidoId = pedido.id;

    // subtotal calculado en servidor
    let computedSubtotal = 0;

    // 2) Recorrer items
    for (const it of items) {
      const tipo = it.tipo_item || 'producto';
      const qty = Math.max(1, Number(it.qty || 1)); // cantidad mínima 1

      let productoId = null;
      let cursoId = null;
      let precioUnit = 0;
      let nombreSnapshot =
        it.nombre || (tipo === 'servicio' ? 'Servicio' : 'Item');

      // === PRODUCTO: validar stock, estado y usar precio real de BD ===
      if (tipo === 'producto') {
        productoId = it.producto_id || it.id;

        if (!productoId) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: 'Producto sin ID válido en el pedido.' });
        }

        // Bloquear fila para evitar carreras
        const { rows: prodRows } = await client.query(
          `SELECT id, nombre, stock, precio, estado
           FROM producto
           WHERE id = $1
           FOR UPDATE`,
          [productoId]
        );

        const prod = prodRows[0];

        if (!prod) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: `El producto (${productoId}) no existe.` });
        }

        // Solo vendemos productos publicados
        if (prod.estado !== 'publicado') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `El producto "${prod.nombre}" no está disponible para la venta.`,
          });
        }

        const stockActual = Number(prod.stock || 0);
        const nombreProd = nombreSnapshot || prod.nombre || 'producto';

        if (stockActual < qty) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Stock insuficiente para "${nombreProd}". Disponible: ${stockActual}, solicitado: ${qty}.`,
          });
        }

        // Usamos SIEMPRE el precio de BD
        precioUnit = Number(prod.precio || 0);
        nombreSnapshot = nombreProd;

        // Descontar stock
        await client.query(
          'UPDATE producto SET stock = stock - $1 WHERE id = $2',
          [qty, productoId]
        );
      }

      // === CURSO: validar que esté publicado y usar precio real ===
      else if (tipo === 'curso') {
        cursoId = it.curso_id || it.id;

        if (!cursoId) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: 'Curso sin ID válido en el pedido.' });
        }

        const { rows: cursoRows } = await client.query(
          `SELECT id, titulo, precio, estado
           FROM curso
           WHERE id = $1`,
          [cursoId]
        );

        const curso = cursoRows[0];

        if (!curso) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: `El curso (${cursoId}) no existe.` });
        }

        if (curso.estado !== 'publicado') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `El curso "${curso.titulo}" no está disponible para la venta.`,
          });
        }

        precioUnit = Number(curso.precio || 0);
        nombreSnapshot = nombreSnapshot || curso.titulo || 'Curso';
      }

      // === SERVICIO: usamos el precio que viene calculado desde frontend ===
      else if (tipo === 'servicio') {
        precioUnit = Number(it.precio || 0);
        // aquí asumes que el frontend ya calculó bien
      } else {
        // Cualquier tipo desconocido
        precioUnit = Number(it.precio || 0);
      }

      // Acumular subtotal calculado del lado servidor
      computedSubtotal += precioUnit * qty;

      // 2.1) Crear snapshot en pedido_item
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
          nombreSnapshot,
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
                 $4, 'confirmada',
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

      // 2.3) Si es CURSO → crear inscripción en inscripcion_curso (extra por seguridad)
      if (tipo === 'curso' && cursoId) {
        await client.query(
          `INSERT INTO inscripcion_curso
             (usuario_id, curso_id, titulo_snapshot, precio_snapshot)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, curso_id) DO NOTHING`,
          [
            userId,
            cursoId,
            nombreSnapshot || 'Curso',
            precioUnit,
          ]
        );
      }
    }

    // 3) Recalcular total en el servidor (subtotal + shipping que venga del body)
    const shippingNum = Number(shipping || 0);
    const computedTotal = computedSubtotal + shippingNum;

    // === SI EL MÉTODO DE PAGO ES "saldo" → descontar del usuario ===
    // === SI EL MÉTODO DE PAGO ES "saldo" → descontar del usuario ===
    if (metodo_pago === 'saldo') {
      console.log("Pagando con saldo..."); // <-- AÑÁDE ESTE LOG

      const { rows: userRows } = await client.query(
        `SELECT saldo FROM usuario WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      const saldoActual = Number(userRows[0]?.saldo || 0);

      console.log("Saldo actual:", saldoActual, "Total:", computedTotal); // <-- LOG

      if (saldoActual < computedTotal) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Saldo insuficiente. Tu saldo disponible es B/. ${saldoActual.toFixed(
            2
          )} y el total es B/. ${computedTotal.toFixed(2)}.`,
        });
      }

      // Descontar saldo
      await client.query(
        `UPDATE usuario SET saldo = saldo - $1 WHERE id = $2`,
        [computedTotal, userId]
      );

      console.log("Saldo descontado OK"); // <-- LOG
    }


    await client.query(
      `UPDATE pedido
       SET total = $1
       WHERE id = $2`,
      [computedTotal, pedidoId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      id: pedidoId,
      total: computedTotal,
      estado: pedido.estado,
      message:
        'Pedido creado correctamente. Las citas asociadas se han registrado como confirmadas.',
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
    // Pedidos totales
    const { rows: pedidosRows } = await pool.query(`
      SELECT 
        COUNT(*) AS total_pedidos
      FROM pedido;
    `);

    // Ingresos reales (solo pagos completados)
    const { rows: ingresosRows } = await pool.query(`
      SELECT 
        COALESCE(SUM(monto), 0) AS total_ingresos
      FROM pago
      WHERE estado = 'pagado';
    `);

    // Pedidos pagados (según pagos exitosos)
    const { rows: pedidosPagadosRows } = await pool.query(`
      SELECT 
        COUNT(DISTINCT pedido_id) AS pedidos_pagados
      FROM pago
      WHERE estado = 'pagado';
    `);

    // Últimos pedidos
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
      LIMIT 5;
    `);

    res.json({
      kpis: {
        total_pedidos: Number(pedidosRows[0].total_pedidos),
        pedidos_pagados: Number(pedidosPagadosRows[0].pedidos_pagados),
        total_ingresos: Number(ingresosRows[0].total_ingresos),
      },
      recientes,
    });
  } catch (err) {
    next(err);
  }
}

// Marca un pedido como pagado (cliente o admin)
export async function markAsPaid(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    // Si es admin puede marcar cualquier pedido
    // Si es cliente, solo sus propios pedidos
    const isAdmin = req.user.rol === 'admin';

    const { rows } = await pool.query(
      `UPDATE pedido
       SET estado = 'pagado'
       WHERE id = $1
         AND ($2 = TRUE OR usuario_id = $3)
       RETURNING *`,
      [id, isAdmin, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}
