import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  obtenerProductosDestacados,
  obtenerServicios,
  obtenerCursos,
  obtenerCarritoUsuario,
  obtenerPedidosUsuario,
  obtenerCitasUsuario,
  obtenerEstadisticasUsuario,
} from './chatbot-intelligence.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// URLs base para links
const FRONTEND_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';

/**
 * Sistema de contexto y herramientas para Gemini
 */
const SYSTEM_PROMPT = `Eres un asistente virtual inteligente de TalkingPet, una tienda de productos y servicios para mascotas en Santa Cruz, Bolivia.

INFORMACIÓN DE LA TIENDA:
- Nombre: TalkingPet
- Ubicación: Santa Cruz de la Sierra, Bolivia
- Horarios: Lunes a viernes 9:00-18:00, Sábados 9:00-14:00
- Teléfono: +591 700-00000
- Moneda: Bolivianos (Bs)

TUS CAPACIDADES:
1. Recomendar productos según tipo de mascota, raza, edad, tamaño
2. Explicar servicios disponibles (baño, peluquería, veterinaria, adiestramiento)
3. Ayudar a agendar citas
4. Mostrar cursos disponibles
5. Consultar estado de pedidos y citas
6. Agregar productos al carrito (devolviendo comandos especiales)
7. Generar links directos a páginas específicas

COMANDOS ESPECIALES QUE PUEDES USAR:
Cuando el usuario quiera hacer una acción específica, responde incluyendo estos comandos:

[ACTION:ADD_TO_CART:product_id:cantidad]
Ejemplo: [ACTION:ADD_TO_CART:5:2] - Agrega producto ID 5, cantidad 2

[LINK:/ruta]
Ejemplo: [LINK:/productos] - Link a productos
Ejemplo: [LINK:/servicios] - Link a servicios
Ejemplo: [LINK:/cursos] - Link a cursos
Ejemplo: [LINK:/carrito] - Link al carrito
Ejemplo: [LINK:/checkout] - Link al checkout
Ejemplo: [LINK:/productos/5] - Link a producto específico
Ejemplo: [LINK:/agendar] - Link para agendar cita

ESTILO DE COMUNICACIÓN:
- Amigable y profesional
- Usa emojis ocasionalmente 🐶🐱
- Sé específico con precios y detalles
- Si no tienes información, sé honesto
- Ofrece alternativas y links útiles
- Confirma acciones importantes

IMPORTANTE:
- Siempre menciona precios en Bolivianos (Bs)
- Para agendar citas, pide: tipo de servicio, mascota, fecha preferida
- Si el usuario quiere comprar, ofrece agregarlo al carrito
- Genera links cuando sea útil para facilitar la navegación`;

/**
 * Obtener contexto del usuario y catálogo
 */
async function obtenerContexto(userId) {
  try {
    const [productos, servicios, cursos, carrito, pedidos, citas, stats] = await Promise.all([
      obtenerProductosDestacados(10),
      obtenerServicios(),
      obtenerCursos(),
      userId ? obtenerCarritoUsuario(userId) : null,
      userId ? obtenerPedidosUsuario(userId, 5) : null,
      userId ? obtenerCitasUsuario(userId, 5) : null,
      userId ? obtenerEstadisticasUsuario(userId) : null,
    ]);

    let contexto = '\n\n=== CONTEXTO DISPONIBLE ===\n\n';

    // Productos
    if (productos?.length > 0) {
      contexto += '**PRODUCTOS DESTACADOS:**\n';
      productos.forEach(p => {
        contexto += `- ID: ${p.id}, Nombre: ${p.nombre}, Precio: Bs ${p.precio}, Stock: ${p.stock_disponible || 'N/A'}\n`;
      });
      contexto += '\n';
    }

    // Servicios
    if (servicios?.length > 0) {
      contexto += '**SERVICIOS DISPONIBLES:**\n';
      servicios.forEach(s => {
        contexto += `- ID: ${s.id}, Nombre: ${s.nombre}, Tipo: ${s.tipo}, Precio base: Bs ${s.precio_base}, Duración: ${s.duracion_minutos} min\n`;
      });
      contexto += '\n';
    }

    // Cursos
    if (cursos?.length > 0) {
      contexto += '**CURSOS DISPONIBLES:**\n';
      cursos.forEach(c => {
        contexto += `- ID: ${c.id}, Título: ${c.titulo}, Precio: Bs ${c.precio || 0}, Modalidad: ${c.modalidad}\n`;
      });
      contexto += '\n';
    }

    // Información del usuario (si está autenticado)
    if (userId && stats) {
      contexto += '**INFORMACIÓN DEL USUARIO:**\n';
      contexto += `- Total gastado: Bs ${stats.totalGastado}\n`;
      contexto += `- Pedidos completados: ${stats.pedidosCompletados}\n`;
      contexto += `- Cursos inscritos: ${stats.cursosInscritos}\n\n`;
    }

    // Carrito
    if (carrito?.items?.length > 0) {
      contexto += '**CARRITO ACTUAL:**\n';
      carrito.items.forEach(i => {
        contexto += `- ${i.producto_nombre} x${i.cantidad} - Bs ${i.subtotal}\n`;
      });
      contexto += `Total: Bs ${carrito.total}\n\n`;
    }

    // Pedidos recientes
    if (pedidos?.length > 0) {
      contexto += '**PEDIDOS RECIENTES:**\n';
      pedidos.forEach(p => {
        contexto += `- Pedido #${p.id}, Estado: ${p.estado}, Total: Bs ${p.total}, Fecha: ${p.fecha_pedido}\n`;
      });
      contexto += '\n';
    }

    // Citas recientes
    if (citas?.length > 0) {
      contexto += '**CITAS RECIENTES:**\n';
      citas.forEach(c => {
        contexto += `- ${c.fecha} ${c.hora}, Servicio: ${c.servicio_tipo || 'N/A'}, Estado: ${c.estado}\n`;
      });
      contexto += '\n';
    }

    return contexto;
  } catch (error) {
    console.error('Error obteniendo contexto:', error);
    return '';
  }
}

/**
 * Procesar comandos especiales en la respuesta
 */
function procesarRespuesta(texto) {
  const acciones = [];
  let textoLimpio = texto;

  // Extraer comandos ADD_TO_CART
  const addToCartRegex = /\[ACTION:ADD_TO_CART:(\d+):(\d+)\]/g;
  let match;
  while ((match = addToCartRegex.exec(texto)) !== null) {
    acciones.push({
      type: 'ADD_TO_CART',
      productId: parseInt(match[1]),
      quantity: parseInt(match[2]),
    });
  }
  textoLimpio = textoLimpio.replace(addToCartRegex, '').trim();

  // Extraer links
  const linkRegex = /\[LINK:(\/[^\]]+)\]/g;
  const links = [];
  while ((match = linkRegex.exec(texto)) !== null) {
    links.push({
      url: `${FRONTEND_URL}${match[1]}`,
      path: match[1],
    });
  }
  textoLimpio = textoLimpio.replace(linkRegex, '').trim();

  return {
    reply: textoLimpio,
    actions: acciones.length > 0 ? acciones : null,
    links: links.length > 0 ? links : null,
  };
}

/**
 * Obtener respuesta inteligente con Gemini
 */
export async function getGeminiChatResponse(message, history = [], userId = null) {
  try {
    // Verificar que la API key esté configurada
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY no está configurada');
      return {
        reply: 'Lo siento, el sistema de IA no está configurado correctamente. Por favor contacta al administrador.',
        actions: null,
        links: null,
      };
    }

    // Obtener contexto actualizado
    const contexto = await obtenerContexto(userId);

    // Preparar el modelo - usar gemini-1.5-flash (más compatible)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
    });

    // Convertir historial al formato de Gemini
    let chatHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Validar que el historial empiece con 'user', si no, remover mensajes iniciales incorrectos
    while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
      chatHistory.shift();
    }

    // Validar que no haya dos mensajes consecutivos del mismo rol
    const validatedHistory = [];
    for (let i = 0; i < chatHistory.length; i++) {
      if (i === 0 || chatHistory[i].role !== chatHistory[i - 1].role) {
        validatedHistory.push(chatHistory[i]);
      }
    }
    chatHistory = validatedHistory;

    // Si el historial está vacío, inicializar con system prompt
    if (chatHistory.length === 0) {
      // Para la primera conversación, incluir el contexto en el mensaje
      const enrichedMessage = `${SYSTEM_PROMPT}\n\n${contexto}\n\n---\n\nUsuario: ${message}`;
      
      // Crear sesión de chat vacía
      const chat = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(enrichedMessage);
      const response = result.response;
      const text = response.text();

      // Procesar comandos especiales
      return procesarRespuesta(text);
    }

    // Si hay historial, usarlo normalmente
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    // Procesar comandos especiales
    const procesado = procesarRespuesta(text);

    return procesado;
  } catch (error) {
    console.error('Error en Gemini Chat:', error);
    
    // Fallback a respuesta genérica
    return {
      reply: 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo? 🙏',
      actions: null,
      links: null,
    };
  }
}
