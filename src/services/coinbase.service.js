import pkg from 'coinbase-commerce-node';
const { Client, resources } = pkg;

const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
const client = apiKey ? Client.init(apiKey) : null;

/**
 * Crear pago con criptomonedas (Bitcoin, USDT, Ethereum, etc.)
 * @param {number} orderId - ID del pedido
 * @param {number} amount - Monto en USD
 * @param {string} description - Descripción del pago
 * @param {string} customerEmail - Email del cliente
 * @returns {Promise<Object>} - Datos del pago creado
 */
export async function createCryptoPayment(orderId, amount, description, customerEmail) {
  if (!client) {
    throw new Error('Coinbase Commerce no está configurado. Define COINBASE_COMMERCE_API_KEY en .env');
  }

  try {
    const chargeData = {
      name: `Pedido #${orderId} - TalkingPet`,
      description: description || `Compra en TalkingPet - Pedido #${orderId}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amount.toFixed(2),
        currency: 'USD' // Coinbase auto-convierte a BTC, ETH, etc.
      },
      metadata: {
        order_id: orderId.toString(),
        customer_email: customerEmail
      },
      redirect_url: `${process.env.PUBLIC_BASE_URL}/pedidos/${orderId}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/carrito`
    };

    const charge = await resources.Charge.create(chargeData);

    return {
      success: true,
      chargeId: charge.id,
      hostedUrl: charge.hosted_url, // URL donde el cliente paga
      addresses: charge.addresses, // Direcciones de pago (BTC, ETH, USDC, USDT)
      expiresAt: charge.expires_at,
      pricing: charge.pricing,
      code: charge.code
    };
  } catch (error) {
    console.error('Error creando pago crypto:', error);
    throw new Error(`Error al crear pago: ${error.message}`);
  }
}

/**
 * Verificar estado de un pago
 * @param {string} chargeId - ID del charge de Coinbase
 * @returns {Promise<Object>} - Estado del pago
 */
export async function checkCryptoPaymentStatus(chargeId) {
  if (!client) {
    throw new Error('Coinbase Commerce no configurado');
  }

  try {
    const charge = await resources.Charge.retrieve(chargeId);
    
    // Obtener el último evento del timeline
    const lastEvent = charge.timeline[charge.timeline.length - 1];

    return {
      status: lastEvent.status,
      // Posibles status: 'NEW', 'PENDING', 'COMPLETED', 'EXPIRED', 'UNRESOLVED', 'RESOLVED'
      payments: charge.payments,
      confirmedAt: charge.confirmed_at,
      timeline: charge.timeline,
      expiresAt: charge.expires_at,
      addresses: charge.addresses,
      pricing: charge.pricing
    };
  } catch (error) {
    console.error('Error verificando pago:', error);
    throw new Error(`Error al verificar pago: ${error.message}`);
  }
}

/**
 * Procesar webhook de Coinbase Commerce
 * @param {string} rawBody - Body sin procesar (string)
 * @param {string} signature - Header X-CC-Webhook-Signature
 * @returns {Object} - Evento validado o error
 */
export function processCoinbaseWebhook(rawBody, signature) {
  const Webhook = resources.Webhook;
  
  try {
    const event = Webhook.verifySigHeader(
      rawBody,
      signature,
      process.env.COINBASE_WEBHOOK_SECRET
    );

    return {
      valid: true,
      event: event,
      type: event.type,
      data: event.data
    };
  } catch (error) {
    console.error('Webhook signature inválida:', error);
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Listar todas las transacciones
 * @returns {Promise<Array>} - Lista de charges
 */
export async function listCharges() {
  if (!client) {
    throw new Error('Coinbase Commerce no configurado');
  }

  try {
    const charges = await resources.Charge.list();
    return charges;
  } catch (error) {
    console.error('Error listando charges:', error);
    throw error;
  }
}

/**
 * Cancelar un pago (solo si está en estado NEW o PENDING)
 * @param {string} chargeId - ID del charge
 * @returns {Promise<Object>}
 */
export async function cancelCharge(chargeId) {
  if (!client) {
    throw new Error('Coinbase Commerce no configurado');
  }

  try {
    const charge = await resources.Charge.retrieve(chargeId);
    
    // Solo se pueden cancelar charges que no han sido pagados
    const lastStatus = charge.timeline[charge.timeline.length - 1].status;
    
    if (lastStatus === 'COMPLETED') {
      throw new Error('No se puede cancelar un pago completado');
    }

    // Nota: Coinbase no tiene método directo de cancelar, pero expira automáticamente
    return {
      success: true,
      message: 'El pago expirará automáticamente si no se completa'
    };
  } catch (error) {
    console.error('Error cancelando charge:', error);
    throw error;
  }
}

export default {
  createCryptoPayment,
  checkCryptoPaymentStatus,
  processCoinbaseWebhook,
  listCharges,
  cancelCharge
};
