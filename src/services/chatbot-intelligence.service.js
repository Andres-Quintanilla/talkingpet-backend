import { pool } from "../config/db.js";

/**
 * Funciones de inteligencia para el chatbot
 * Accede a la BD y devuelve información contextual
 */

// ========== PRODUCTOS ==========

export async function buscarProductos(keywords = [], categoria = null) {
  try {
    let query = `
      SELECT id, nombre, descripcion, categoria, precio, stock, imagen_url
      FROM producto
      WHERE activo = true
    `;
    const params = [];

    // Filtrar por categoría si se especifica
    if (categoria) {
      params.push(categoria);
      query += ` AND LOWER(categoria) = LOWER($${params.length})`;
    }

    // Buscar por keywords en nombre o descripción
    if (keywords.length > 0) {
      const keywordConditions = keywords
        .map((kw, idx) => {
          params.push(`%${kw}%`);
          return `(LOWER(nombre) LIKE LOWER($${params.length}) OR LOWER(descripcion) LIKE LOWER($${params.length}))`;
        })
        .join(" OR ");
      query += ` AND (${keywordConditions})`;
    }

    query += ` ORDER BY precio ASC LIMIT 10`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error("Error buscando productos:", error);
    return [];
  }
}

export async function obtenerProductoPorId(productoId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, categoria, precio, stock, imagen_url
       FROM producto WHERE id = $1 AND activo = true`,
      [productoId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error obteniendo producto:", error);
    return null;
  }
}

export async function obtenerProductosDestacados(limit = 5) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, precio, categoria, imagen_url
       FROM producto 
       WHERE activo = true AND stock > 0
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo productos destacados:", error);
    return [];
  }
}

// ========== CURSOS ==========

export async function obtenerCursos() {
  try {
    const { rows } = await pool.query(
      `SELECT id, titulo, descripcion, precio, estado, fecha_publicacion
       FROM curso
       WHERE estado = 'publicado'
       ORDER BY fecha_publicacion DESC`
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo cursos:", error);
    return [];
  }
}

export async function obtenerCursoPorId(cursoId) {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.titulo, c.descripcion, c.precio, c.estado,
              u.nombre as instructor_nombre
       FROM curso c
       LEFT JOIN usuario u ON c.instructor_id = u.id
       WHERE c.id = $1 AND c.estado = 'publicado'`,
      [cursoId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error obteniendo curso:", error);
    return null;
  }
}

// ========== SERVICIOS ==========

export async function obtenerServicios() {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, tipo, descripcion, precio_base, duracion_minutos
       FROM servicio
       ORDER BY precio_base ASC`
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo servicios:", error);
    return [];
  }
}

export async function obtenerServicioPorTipo(tipo) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, tipo, descripcion, precio_base, duracion_minutos
       FROM servicio
       WHERE LOWER(tipo) = LOWER($1)`,
      [tipo]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error obteniendo servicio:", error);
    return null;
  }
}

// ========== CARRITO ==========

export async function obtenerCarritoUsuario(usuarioId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        ci.id,
        ci.cantidad,
        ci.precio_unitario,
        ci.subtotal,
        p.nombre as producto_nombre,
        p.categoria as producto_categoria,
        p.imagen_url as producto_imagen
       FROM carrito c
       JOIN carrito_item ci ON c.id = ci.carrito_id
       JOIN producto p ON ci.producto_id = p.id
       WHERE c.usuario_id = $1`,
      [usuarioId]
    );

    if (rows.length === 0) {
      return { items: [], total: 0, count: 0 };
    }

    const total = rows.reduce(
      (sum, item) => sum + parseFloat(item.subtotal),
      0
    );
    const count = rows.reduce((sum, item) => sum + item.cantidad, 0);

    return { items: rows, total, count };
  } catch (error) {
    console.error("Error obteniendo carrito:", error);
    return { items: [], total: 0, count: 0 };
  }
}

// ========== PEDIDOS ==========

export async function obtenerPedidosUsuario(usuarioId, limite = 5) {
  try {
    const { rows } = await pool.query(
      `SELECT id, total, estado, fecha_pedido, direccion_envio
       FROM pedido
       WHERE usuario_id = $1
       ORDER BY fecha_pedido DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo pedidos:", error);
    return [];
  }
}

export async function obtenerPedidoPorId(pedidoId, usuarioId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        p.id, 
        p.total, 
        p.estado, 
        p.fecha_pedido, 
        p.direccion_envio,
        pag.estado as estado_pago,
        pag.metodo as metodo_pago,
        e.estado as estado_envio,
        e.fecha_envio,
        e.fecha_entrega
       FROM pedido p
       LEFT JOIN pago pag ON p.id = pag.pedido_id
       LEFT JOIN envio e ON p.id = e.pedido_id
       WHERE p.id = $1 AND p.usuario_id = $2`,
      [pedidoId, usuarioId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error obteniendo pedido:", error);
    return null;
  }
}

// ========== CITAS ==========

export async function obtenerCitasUsuario(usuarioId, limite = 3) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        c.id, 
        c.fecha, 
        c.hora, 
        c.estado, 
        c.comentarios,
        s.tipo as servicio_tipo,
        s.precio_base as servicio_precio,
        m.nombre as mascota_nombre
       FROM cita c
       LEFT JOIN servicio s ON c.servicio_id = s.id
       LEFT JOIN mascota m ON c.mascota_id = m.id
       WHERE c.usuario_id = $1
       ORDER BY c.fecha DESC, c.hora DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo citas:", error);
    return [];
  }
}

export async function verificarDisponibilidad(fecha, hora, servicioId) {
  try {
    // Obtener duración del servicio
    const { rows: servicioRows } = await pool.query(
      `SELECT duracion_minutos FROM servicio WHERE id = $1`,
      [servicioId]
    );

    if (servicioRows.length === 0) return false;

    const duracionMinutos = servicioRows[0].duracion_minutos;

    // Verificar si hay citas que se solapen
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count
       FROM cita
       WHERE fecha = $1 
       AND estado IN ('pendiente', 'confirmada')
       AND (
         (hora <= $2::time AND (hora + INTERVAL '1 minute' * (
           SELECT duracion_minutos FROM servicio WHERE id = cita.servicio_id
         )) > $2::time)
         OR
         (hora < ($2::time + INTERVAL '1 minute' * $3) AND hora >= $2::time)
       )`,
      [fecha, hora, duracionMinutos]
    );

    return parseInt(rows[0].count) === 0;
  } catch (error) {
    console.error("Error verificando disponibilidad:", error);
    return false;
  }
}

export async function obtenerHorariosDisponibles(fecha, servicioId) {
  try {
    // Horarios de trabajo: 9:00 AM - 7:00 PM
    const horariosBase = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];

    const disponibles = [];

    for (const hora of horariosBase) {
      const disponible = await verificarDisponibilidad(fecha, hora, servicioId);
      if (disponible) {
        disponibles.push(hora);
      }
    }

    return disponibles;
  } catch (error) {
    console.error("Error obteniendo horarios disponibles:", error);
    return [];
  }
}

export async function crearCita(
  usuarioId,
  servicioId,
  mascotaId,
  fecha,
  hora,
  comentarios = null,
  modalidad = "local"
) {
  try {
    // Verificar disponibilidad antes de crear
    const disponible = await verificarDisponibilidad(fecha, hora, servicioId);

    if (!disponible) {
      return { success: false, error: "Horario no disponible" };
    }

    const { rows } = await pool.query(
      `INSERT INTO cita (usuario_id, servicio_id, mascota_id, fecha, hora, comentarios, modalidad, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
       RETURNING id, fecha, hora, estado`,
      [usuarioId, servicioId, mascotaId, fecha, hora, comentarios, modalidad]
    );

    return { success: true, cita: rows[0] };
  } catch (error) {
    console.error("Error creando cita:", error);
    return { success: false, error: error.message };
  }
}

export async function cancelarCita(citaId, usuarioId) {
  try {
    const { rows } = await pool.query(
      `UPDATE cita 
       SET estado = 'cancelada'
       WHERE id = $1 AND usuario_id = $2 AND estado IN ('pendiente', 'confirmada')
       RETURNING id, estado`,
      [citaId, usuarioId]
    );

    if (rows.length === 0) {
      return { success: false, error: "Cita no encontrada o no se puede cancelar" };
    }

    return { success: true, cita: rows[0] };
  } catch (error) {
    console.error("Error cancelando cita:", error);
    return { success: false, error: error.message };
  }
}

export async function obtenerMascotasUsuario(usuarioId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, especie, raza, edad
       FROM mascota
       WHERE usuario_id = $1
       ORDER BY nombre ASC`,
      [usuarioId]
    );
    return rows;
  } catch (error) {
    console.error("Error obteniendo mascotas:", error);
    return [];
  }
}

// ========== ESTADÍSTICAS ==========

export async function obtenerEstadisticasUsuario(usuarioId) {
  try {
    const stats = {};

    // Total gastado
    const { rows: gastoRows } = await pool.query(
      `SELECT COALESCE(SUM(total), 0) as total_gastado
       FROM pedido
       WHERE usuario_id = $1 AND estado IN ('pagado', 'en_proceso', 'enviado', 'entregado')`,
      [usuarioId]
    );
    stats.totalGastado = parseFloat(gastoRows[0].total_gastado);

    // Pedidos completados
    const { rows: pedidosRows } = await pool.query(
      `SELECT COUNT(*) as total_pedidos
       FROM pedido
       WHERE usuario_id = $1 AND estado = 'entregado'`,
      [usuarioId]
    );
    stats.pedidosCompletados = parseInt(pedidosRows[0].total_pedidos);

    // Cursos inscritos
    const { rows: cursosRows } = await pool.query(
      `SELECT COUNT(*) as total_cursos
       FROM inscripcion_curso
       WHERE usuario_id = $1`,
      [usuarioId]
    );
    stats.cursosInscritos = parseInt(cursosRows[0].total_cursos);

    return stats;
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    return { totalGastado: 0, pedidosCompletados: 0, cursosInscritos: 0 };
  }
}

// ========== FORMATEADORES ==========

export function formatearPrecio(precio) {
  return `Bs. ${parseFloat(precio).toFixed(2)}`;
}

export function formatearFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatearEstadoPedido(estado) {
  const estados = {
    pendiente: "⏳ Pendiente",
    pagado: "✅ Pagado",
    en_proceso: "📦 En proceso",
    enviado: "🚚 Enviado",
    entregado: "✅ Entregado",
    cancelado: "❌ Cancelado",
  };
  return estados[estado] || estado;
}

export function formatearEstadoCita(estado) {
  const estados = {
    pendiente: "⏳ Pendiente",
    confirmada: "✅ Confirmada",
    cancelada: "❌ Cancelada",
    realizada: "✅ Realizada",
    no_asistio: "❌ No asistió",
  };
  return estados[estado] || estado;
}
