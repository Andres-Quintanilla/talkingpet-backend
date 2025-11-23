import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { 
  createStripeSession, 
  stripeWebhook, 
  generateQrPayment,
  checkQrPaymentStatus,
  simulateQrPayment 
} from '../controllers/payment.controller.js';

const r = Router();

// Stripe
r.post('/stripe/create-session', requireAuth, createStripeSession);
r.post('/stripe/webhook', stripeWebhook); 

// QR
r.post('/qr/generate', requireAuth, generateQrPayment);
r.get('/qr/status/:order_id', requireAuth, checkQrPaymentStatus);
r.post('/qr/simulate', requireAuth, simulateQrPayment);

export default r;
