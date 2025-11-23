import Stripe from 'stripe';
import QRCode from 'qrcode';
import { pool } from '../config/db.js';

const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-06-20' }) : null;

function stripeRequired(res) {
  return res.status(503).json({
    error: 'Stripe no está configurado. Define STRIPE_SECRET_KEY en el .env o usa /api/payments/simulate/qr.'
  });
}

// Función auxiliar para procesar inscripciones de cursos después del pago
async function processCourseEnrollments(client, orderId, userId) {
  try {
    // Obtener todos los items del pedido que son cursos
    const { rows: items } = await client.query(
      `SELECT pi.producto_id as curso_id, pi.nombre_producto, pi.precio_unitario
       FROM pedido_item pi
       WHERE pi.pedido_id = $1 AND pi.producto_id IS NOT NULL`,
      [orderId]
    );

    for (const item of items) {
      if (item.curso_id) {
        // Verificar si es un curso válido
        const { rows: cursoRows } = await client.query(
          'SELECT titulo, precio FROM curso WHERE id = $1',
          [item.curso_id]
        );

        if (cursoRows[0]) {
          const curso = cursoRows[0];
          
          // Inscribir al usuario en el curso
          await client.query(
            `INSERT INTO inscripcion_curso
               (usuario_id, curso_id, titulo_snapshot, precio_snapshot, progreso)
             VALUES ($1, $2, $3, $4, 0)
             ON CONFLICT (usuario_id, curso_id) DO NOTHING`,
            [userId, item.curso_id, curso.titulo, curso.precio]
          );
          
          console.log(`✅ Usuario ${userId} inscrito en curso ${item.curso_id}`);
        }
      }
    }
  } catch (err) {
    console.error('Error procesando inscripciones de cursos:', err);
    // No lanzamos el error para no afectar el flujo principal del pago
  }
}

export async function createStripeSession(req, res, next) {
  if (!stripe) return stripeRequired(res);
  try {
    const { order_id } = req.body;
    const { rows } = await pool.query('SELECT * FROM pedido WHERE id=$1 AND usuario_id=$2', [order_id, req.user.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'bob',
            unit_amount: Math.round(Number(order.total) * 100),
            product_data: { name: `Pedido #${order.id} - TalkingPet` }
          }
        }
      ],
      success_url: `${process.env.PUBLIC_BASE_URL}/pago/exitoso?pid=${order.id}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/pago/cancelado`,
      metadata: { order_id: String(order.id), user_id: String(req.user.id) }
    });

    res.json({ url: session.url });
  } catch (e) { next(e); }
}

export async function stripeWebhook(req, res) {
  if (!stripe) return stripeRequired(res);
  
  const client = await pool.connect();
  
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = Number(session.metadata.order_id);
      const userId = Number(session.metadata.user_id);
      const amount = session.amount_total / 100;

      await client.query('BEGIN');
      
      await client.query(
        `INSERT INTO pago (pedido_id, monto, metodo, estado, referencia) VALUES ($1,$2,'tarjeta','pagado',$3)`,
        [orderId, amount, session.id]
      );
      
      await client.query(`UPDATE pedido SET estado='pagado' WHERE id=$1`, [orderId]);
      
      // Procesar inscripciones de cursos
      await processCourseEnrollments(client, orderId, userId);
      
      await client.query('COMMIT');
      
      console.log(`✅ Pago confirmado para pedido #${orderId}`);
    }
    
    res.json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Webhook error', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  } finally {
    client.release();
  }
}

// Generar código QR para pago
export async function generateQrPayment(req, res, next) {
  try {
    const { order_id } = req.body;
    
    // Validar que el pedido existe y pertenece al usuario
    const { rows } = await pool.query(
      'SELECT * FROM pedido WHERE id=$1 AND usuario_id=$2',
      [order_id, req.user.id]
    );
    const order = rows[0];
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Verificar si ya existe un pago pendiente para este pedido
    const { rows: existingPayment } = await pool.query(
      'SELECT * FROM pago WHERE pedido_id=$1 AND estado IN ($2, $3)',
      [order_id, 'pendiente', 'pagado']
    );

    let paymentId;
    let referencia;

    if (existingPayment.length > 0) {
      // Ya existe un pago, usar ese
      paymentId = existingPayment[0].id;
      referencia = existingPayment[0].referencia;
    } else {
      // Crear nuevo registro de pago con estado pendiente
      referencia = `QR-${order_id}-${Date.now()}`;
      const { rows: newPayment } = await pool.query(
        `INSERT INTO pago (pedido_id, monto, metodo, estado, referencia)
         VALUES ($1, $2, 'qr', 'pendiente', $3)
         RETURNING id`,
        [order_id, order.total, referencia]
      );
      paymentId = newPayment[0].id;
    }

    // Datos para el QR (en producción, aquí iría la URL del banco o servicio de pagos)
    const qrData = JSON.stringify({
      referencia,
      pedido_id: order_id,
      monto: Number(order.total),
      moneda: 'BOB',
      comercio: 'TalkingPet',
      descripcion: `Pedido #${order_id}`,
    });

    // Generar código QR en base64
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    res.json({
      success: true,
      payment_id: paymentId,
      qr_image: qrImage,
      referencia,
      monto: order.total,
      order_id,
    });
  } catch (e) {
    next(e);
  }
}

// Verificar estado del pago QR
export async function checkQrPaymentStatus(req, res, next) {
  try {
    const { order_id } = req.params;

    const { rows } = await pool.query(
      `SELECT p.*, pe.estado as pedido_estado 
       FROM pago p
       JOIN pedido pe ON p.pedido_id = pe.id
       WHERE p.pedido_id=$1 AND pe.usuario_id=$2 AND p.metodo='qr'
       ORDER BY p.id DESC
       LIMIT 1`,
      [order_id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const payment = rows[0];
    res.json({
      payment_id: payment.id,
      estado: payment.estado,
      pedido_estado: payment.pedido_estado,
      monto: payment.monto,
      referencia: payment.referencia,
      fecha_pago: payment.fecha_pago,
    });
  } catch (e) {
    next(e);
  }
}

// Simular pago QR (solo para desarrollo/testing)
export async function simulateQrPayment(req, res, next) {
  const client = await pool.connect();
  
  try {
    const { order_id } = req.body;
    const { rows } = await client.query(
      'SELECT * FROM pedido WHERE id=$1 AND usuario_id=$2', 
      [order_id, req.user.id]
    );
    
    if (!rows[0]) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    await client.query('BEGIN');
    
    // Actualizar el pago existente a pagado
    await client.query(
      `UPDATE pago 
       SET estado='pagado', fecha_pago=NOW()
       WHERE pedido_id=$1 AND metodo='qr' AND estado='pendiente'`,
      [order_id]
    );
    
    // Actualizar el estado del pedido
    await client.query(`UPDATE pedido SET estado='pagado' WHERE id=$1`, [order_id]);
    
    // Procesar inscripciones de cursos
    await processCourseEnrollments(client, order_id, req.user.id);
    
    await client.query('COMMIT');

    console.log(`✅ Pago QR simulado exitoso para pedido #${order_id}`);
    res.json({ ok: true, message: 'Pago QR simulado exitoso' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}
