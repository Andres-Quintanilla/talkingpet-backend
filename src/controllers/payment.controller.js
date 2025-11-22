import Stripe from 'stripe';
import { pool } from '../config/db.js';

const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-06-20' }) : null;

function stripeRequired(res) {
  return res.status(503).json({
    error: 'Stripe no está configurado. Define STRIPE_SECRET_KEY en el .env o usa /api/payments/simulate/qr.'
  });
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
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = Number(session.metadata.order_id);
      const amount = session.amount_total / 100;

      await pool.query('BEGIN');
      await pool.query(
        `INSERT INTO pago (pedido_id, monto, metodo, estado, referencia) VALUES ($1,$2,'tarjeta','pagado',$3)`,
        [orderId, amount, session.id]
      );
      await pool.query(`UPDATE pedido SET estado='pagado' WHERE id=$1`, [orderId]);
      await pool.query('COMMIT');
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

export async function simulateQrPayment(req, res, next) {
  try {
    const { order_id } = req.body;
    const { rows } = await pool.query('SELECT * FROM pedido WHERE id=$1 AND usuario_id=$2', [order_id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

    await pool.query('BEGIN');
    await pool.query(
      `INSERT INTO pago (pedido_id, monto, metodo, estado, referencia)
       SELECT id, total, 'qr', 'pagado', 'QR-MOCK-'||id FROM pedido WHERE id=$1`,
      [order_id]
    );
    await pool.query(`UPDATE pedido SET estado='pagado' WHERE id=$1`, [order_id]);
    await pool.query('COMMIT');

    res.json({ ok: true, message: 'Pago QR simulado exitoso' });
  } catch (e) {
    await pool.query('ROLLBACK');
    next(e);
  }
}
