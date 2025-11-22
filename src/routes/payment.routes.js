import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createStripeSession, stripeWebhook, simulateQrPayment } from '../controllers/payment.controller.js';

const r = Router();

r.post('/stripe/create-session', requireAuth, createStripeSession);
r.post('/stripe/webhook', stripeWebhook); 
r.post('/simulate/qr', requireAuth, simulateQrPayment);

export default r;
