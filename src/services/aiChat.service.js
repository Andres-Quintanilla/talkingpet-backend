import {
  obtenerProductosDestacados,
  obtenerServicios,
  obtenerCursos,
  obtenerCarritoUsuario,
  obtenerPedidosUsuario,
  obtenerCitasUsuario,
  obtenerEstadisticasUsuario,
  formatearPrecio,
  formatearFecha,
  formatearEstadoPedido,
  formatearEstadoCita,
} from "./chatbot-intelligence.service.js";

/**
 * IA sencilla basada en reglas + datos reales de la BD.
 *
 * Retorna siempre:
 *  {
 *    reply: string,
 *    action?: string,         // ej. "OPEN_PRODUCTS"
 *    actionParams?: any
 *  }
 */

export async function getSmartChatResponse(
  message,
  history = [],
  userId = null
) {
  const text = message.toLowerCase().trim();

  // ========== 1) PRODUCTOS ==========
  if (text.includes("producto")) {
    const productos = await obtenerProductosDestacados(5);

    if (!productos || productos.length === 0) {
      return {
        reply:
          "Por el momento no tengo productos cargados en el sistema. 😅\n\nPuedes visitar la sección *Productos* para más información.",
        action: "OPEN_PRODUCTS",
      };
    }

    const lines = productos.map(
      (p) => `• ${p.nombre} – ${formatearPrecio(p.precio)}`
    );

    return {
      reply:
        "Estos son algunos de nuestros productos destacados:\n\n" +
        lines.join("\n") +
        "\n\nPuedo llevarte a la sección de productos para ver más 👉",
      action: "OPEN_PRODUCTS",
    };
  }

  // ========== 2) SERVICIOS / BAÑO / PELUQUERÍA / VETERINARIA ==========
  if (
    text.includes("servicio") ||
    text.includes("baño") ||
    text.includes("peluquer") ||
    text.includes("veterinaria") ||
    text.includes("veterinario") ||
    text.includes("adiestramiento")
  ) {
    const servicios = await obtenerServicios();

    if (!servicios || servicios.length === 0) {
      return {
        reply:
          "Aún no tengo servicios configurados en la base de datos. 🐶\n\nPuedes revisar la sección *Servicios* para más detalles.",
        action: "OPEN_SERVICES",
      };
    }

    const lines = servicios.map(
      (s) =>
        `• ${s.nombre} (${s.tipo}) – desde ${formatearPrecio(
          s.precio_base
        )} · ${s.duracion_minutos} min`
    );

    return {
      reply:
        "Estos son los servicios que ofrecemos actualmente:\n\n" +
        lines.join("\n") +
        "\n\nTe puedo llevar a la sección de servicios para que agendes una cita. 😉",
      action: "OPEN_SERVICES",
    };
  }

  // ========== 3) CITAS / AGENDAR ==========
  if (
    text.includes("cita") ||
    text.includes("agendar") ||
    text.includes("agenda")
  ) {
    if (!userId) {
      return {
        reply:
          "Para agendar una cita necesito que inicies sesión primero. 🙏\n\nLuego entra a *Servicios* y selecciona el servicio que quieras.",
        action: "OPEN_LOGIN_OR_SERVICES",
      };
    }

    const citas = await obtenerCitasUsuario(userId, 3);

    if (citas.length === 0) {
      return {
        reply:
          "Todavía no tienes citas registradas. 😊\n\nPuedes agendar una cita desde la sección *Servicios*.",
        action: "OPEN_SERVICES",
      };
    }

    const lines = citas.map(
      (c) =>
        `• ${formatearFecha(c.fecha)} a las ${c.hora} – ${
          c.servicio_tipo ?? "Servicio"
        } – ${formatearEstadoCita(c.estado)}`
    );

    return {
      reply:
        "Estas son tus últimas citas:\n\n" +
        lines.join("\n") +
        "\n\nSi quieres agendar una nueva, entra a la sección *Servicios*.",
      action: "OPEN_SERVICES",
    };
  }

  // ========== 4) CURSOS ==========
  if (text.includes("curso") || text.includes("cursos")) {
    const cursos = await obtenerCursos();

    if (!cursos || cursos.length === 0) {
      return {
        reply:
          "Por ahora no tengo cursos publicados en el sistema. 📚\n\nMás adelante verás aquí los cursos disponibles.",
        action: "OPEN_COURSES",
      };
    }

    const lines = cursos.slice(0, 5).map((c) => {
      const precio = c.precio ? formatearPrecio(c.precio) : "Gratis";
      return `• ${c.titulo} – ${precio}`;
    });

    return {
      reply:
        "Estos son algunos cursos disponibles:\n\n" +
        lines.join("\n") +
        "\n\nTe puedo llevar a la sección de *Cursos* para ver más detalles.",
      action: "OPEN_COURSES",
    };
  }

  // ========== 5) CARRITO ==========
  if (text.includes("carrito")) {
    if (!userId) {
      return {
        reply:
          "Para ver tu carrito necesitas iniciar sesión. 😊\n\nLuego podrás revisar y completar tus compras.",
        action: "OPEN_LOGIN_OR_CART",
      };
    }

    const carrito = await obtenerCarritoUsuario(userId);

    if (!carrito.items.length) {
      return {
        reply:
          "Tu carrito está vacío por ahora. 🛒\n\nPuedes añadir productos desde la sección *Productos*.",
        action: "OPEN_PRODUCTS",
      };
    }

    const lines = carrito.items.map(
      (i) =>
        `• ${i.producto_nombre} x${i.cantidad} – ${formatearPrecio(
          i.subtotal
        )}`
    );

    return {
      reply:
        "Este es el resumen de tu carrito:\n\n" +
        lines.join("\n") +
        `\n\nTotal: *${formatearPrecio(
          carrito.total
        )}*\n\n¿Te llevo al carrito para finalizar la compra?`,
      action: "OPEN_CART",
    };
  }

  // ========== 6) PEDIDOS / COMPRAS ==========
  if (
    text.includes("pedido") ||
    text.includes("pedidos") ||
    text.includes("compra") ||
    text.includes("orden")
  ) {
    if (!userId) {
      return {
        reply:
          "Para ver tus pedidos necesito que inicies sesión. 🙏\n\nDespués podrás revisar el estado de tus compras.",
        action: "OPEN_LOGIN_OR_ORDERS",
      };
    }

    const pedidos = await obtenerPedidosUsuario(userId, 5);

    if (!pedidos.length) {
      return {
        reply:
          "Aún no tienes pedidos registrados. 🛍️\n\nCuando compres algo podrás ver el estado aquí.",
        action: "OPEN_PRODUCTS",
      };
    }

    const lines = pedidos.map(
      (p) =>
        `• Pedido #${p.id} – ${formatearEstadoPedido(
          p.estado
        )} – ${formatearPrecio(p.total)} – ${formatearFecha(p.fecha_pedido)}`
    );

    return {
      reply:
        "Estos son tus últimos pedidos:\n\n" +
        lines.join("\n") +
        "\n\nPuedes ver más detalles en la sección de *Mis pedidos*.",
      action: "OPEN_ORDERS",
    };
  }

  // ========== 7) RESUMEN DEL CLIENTE ==========
  if (
    text.includes("resumen") ||
    text.includes("mi cuenta") ||
    text.includes("estadística") ||
    text.includes("estadisticas")
  ) {
    if (!userId) {
      return {
        reply:
          "Si inicias sesión puedo mostrarte un resumen de tu actividad: total gastado, pedidos y cursos inscritos. 😉",
        action: "OPEN_LOGIN",
      };
    }

    const stats = await obtenerEstadisticasUsuario(userId);

    return {
      reply:
        "Este es un pequeño resumen de tu actividad en TalkingPet:\n\n" +
        `• Total gastado: *${formatearPrecio(stats.totalGastado)}*\n` +
        `• Pedidos completados: *${stats.pedidosCompletados}*\n` +
        `• Cursos inscritos: *${stats.cursosInscritos}*\n\n` +
        "¿Te gustaría que te lleve a *Productos*, *Servicios* o *Cursos*?",
      action: null,
    };
  }

  // ========== 8) PREGUNTAS DE HORARIOS / UBICACIÓN ==========
  if (
    text.includes("horario") ||
    text.includes("hora") ||
    text.includes("abren") ||
    text.includes("cierran") ||
    text.includes("ubicación") ||
    text.includes("ubicacion") ||
    text.includes("dónde están") ||
    text.includes("donde estan")
  ) {
    return {
      reply:
        "Nuestros horarios de atención son:\n\n" +
        "• Lunes a viernes: 9:00 a 18:00\n" +
        "• Sábado: 9:00 a 14:00\n\n" +
        "Estamos en *Santa Cruz de la Sierra*. 🐾",
      action: null,
    };
  }

  // ========== 9) RESPUESTA POR DEFECTO ==========
  const helpText =
    "Puedo ayudarte con cosas como:\n\n" +
    "• Ver productos y servicios disponibles 🛍️\n" +
    "• Ver tu carrito y pedidos 🛒\n" +
    "• Información sobre cursos 📚\n" +
    "• Agendar o ver tus citas 📅\n" +
    "• Horarios y ubicación 📍\n\n" +
    "Prueba escribiendo algo como:\n" +
    "• *\"Qué productos tienes\"*\n" +
    "• *\"Quiero agendar una cita\"*\n" +
    "• *\"Ver mis pedidos\"*";

  return {
    reply:
      "Lo siento, no estoy seguro de haber entendido tu pregunta. 🤔\n\n" +
      helpText,
    action: null,
  };
}
