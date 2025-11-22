import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import * as cryptoController from '../controllers/crypto-payment.controller.js';

const router = Router();

/**
 * POST /api/payments/crypto/create
 * Crear pago con criptomonedas (Bitcoin, USDT, Ethereum, etc.)
 * Requiere autenticación
 */
router.post('/create', requireAuth, cryptoController.createCryptoPayment);

/**
 * GET /api/payments/crypto/status/:chargeId
 * Verificar estado de un pago
 * Requiere autenticación
 */
router.get('/status/:chargeId', requireAuth, cryptoController.checkPaymentStatus);

/**
 * GET /api/payments/crypto/list
 * Listar todos los pagos crypto (solo admin)
 */
router.get('/list', requireAuth, isAdmin, cryptoController.listCryptoPayments);

/**
 * POST /api/payments/crypto/webhook
 * Webhook de Coinbase Commerce
 * NO requiere autenticación (Coinbase envía eventos aquí)
 * IMPORTANTE: Debe tener rawBody middleware
 */
router.post('/webhook', cryptoController.coinbaseWebhook);

export default router;
