import { pool } from "../config/db.js";
import { sendEmail, sendWhatsApp } from "./notification.service.js";

/**
 * Sistema de Recordatorios Automáticos
 * Ejecuta tareas programadas (cron jobs) para enviar notificaciones
 * sobre vacunas, baños, restock de alimentos, cumpleaños, etc.
 */

// ========== RECORDATORIOS DE VACUNAS ==========

/**
 * Enviar recordatorios de vacunas próximas (7 días antes)
 */
export async function recordatoriosVacunas() {
  try {
    const query = `
      SELECT 
        v.id as vacuna_id,
        v.vacuna,
        v.proxima_dosis,
        m.id as mascota_id,
        m.nombre as mascota_nombre,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email,
        u.telefono
      FROM mascota_vacuna v
      JOIN mascota m ON v.mascota_id = m.id
      JOIN usuario u ON m.usuario_id = u.id
      WHERE v.proxima_dosis BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      AND v.recordatorio_enviado = FALSE
      AND u.activo = TRUE
    `;

    const { rows: vacunasPendientes } = await pool.query(query);

    console.log(`📅 Procesando ${vacunasPendientes.length} recordatorios de vacunas...`);

    let exitosos = 0;
    let fallidos = 0;

    for (const vacuna of vacunasPendientes) {
      try {
        const diasRestantes = Math.ceil(
          (new Date(vacuna.proxima_dosis) - new Date()) / (1000 * 60 * 60 * 24)
        );

        const asunto = `🐾 Recordatorio: Vacuna de ${vacuna.mascota_nombre}`;
        const mensaje = `
¡Hola ${vacuna.usuario_nombre}!

Te recordamos que ${vacuna.mascota_nombre} tiene una vacuna próxima:

💉 Vacuna: ${vacuna.vacuna}
📅 Fecha: ${new Date(vacuna.proxima_dosis).toLocaleDateString('es-ES')}
⏰ Faltan: ${diasRestantes} día(s)

¿Quieres agendar tu cita ahora? Responde a este mensaje o entra a nuestra app.

¡Te esperamos! 🐕💚
TalkingPet
        `.trim();

        // Enviar por email
        if (vacuna.email) {
          await sendEmail(vacuna.email, asunto, mensaje);
        }

        // Enviar por WhatsApp
        if (vacuna.telefono) {
          await sendWhatsApp(vacuna.telefono, mensaje);
        }

        // Marcar como enviado
        await pool.query(
          'UPDATE mascota_vacuna SET recordatorio_enviado = TRUE WHERE id = $1',
          [vacuna.vacuna_id]
        );

        // Registrar en log
        await registrarNotificacion({
          usuarioId: vacuna.usuario_id,
          mascotaId: vacuna.mascota_id,
          tipo: 'vacuna',
          medio: vacuna.email && vacuna.telefono ? 'email, whatsapp' : (vacuna.email ? 'email' : 'whatsapp'),
          destinatario: vacuna.email || vacuna.telefono,
          asunto,
          mensaje,
          estado: 'enviado'
        });

        exitosos++;
      } catch (error) {
        console.error(`Error enviando recordatorio vacuna ${vacuna.vacuna_id}:`, error);
        
        await registrarNotificacion({
          usuarioId: vacuna.usuario_id,
          mascotaId: vacuna.mascota_id,
          tipo: 'vacuna',
          medio: 'email',
          destinatario: vacuna.email || vacuna.telefono,
          asunto,
          mensaje,
          estado: 'fallido',
          error: error.message
        });

        fallidos++;
      }
    }

    console.log(`✅ Recordatorios vacunas: ${exitosos} exitosos, ${fallidos} fallidos`);
    return { exitosos, fallidos, total: vacunasPendientes.length };
  } catch (error) {
    console.error('Error en recordatorios de vacunas:', error);
    throw error;
  }
}

// ========== RECORDATORIOS DE BAÑO ==========

/**
 * Enviar recordatorios de baño (cada 21-30 días según tamaño)
 */
export async function recordatoriosBano() {
  try {
    // Obtener usuarios con su última cita de baño
    const query = `
      WITH ultima_cita AS (
        SELECT DISTINCT ON (m.id)
          m.id as mascota_id,
          m.nombre as mascota_nombre,
          m.especie,
          u.id as usuario_id,
          u.nombre as usuario_nombre,
          u.email,
          u.telefono,
          c.fecha as ultima_fecha,
          c.estado
        FROM mascota m
        JOIN usuario u ON m.usuario_id = u.id
        LEFT JOIN cita c ON c.mascota_id = m.id
        LEFT JOIN servicio s ON c.servicio_id = s.id
        WHERE s.tipo = 'baño' OR s.tipo IS NULL
        ORDER BY m.id, c.fecha DESC NULLS LAST
      )
      SELECT 
        *,
        CASE 
          WHEN ultima_fecha IS NULL THEN 60 -- Nunca ha tenido baño
          ELSE DATE_PART('day', CURRENT_DATE - ultima_fecha)::INT
        END as dias_sin_bano,
        CASE
          WHEN especie = 'perro' THEN 25 -- Perros cada 25 días
          WHEN especie = 'gato' THEN 45 -- Gatos cada 45 días
          ELSE 30
        END as frecuencia_recomendada
      FROM ultima_cita
      WHERE usuario_id IN (SELECT id FROM usuario WHERE activo = TRUE)
    `;

    const { rows: mascotas } = await pool.query(query);

    const mascotasNecesitanBano = mascotas.filter(m => 
      m.dias_sin_bano >= m.frecuencia_recomendada * 0.9 // 90% del tiempo
    );

    console.log(`🛁 Procesando ${mascotasNecesitanBano.length} recordatorios de baño...`);

    let exitosos = 0;
    let fallidos = 0;

    for (const mascota of mascotasNecesitanBano) {
      try {
        // Verificar si ya se envió recordatorio recientemente (últimos 7 días)
        const ultimoRecordatorio = await pool.query(`
          SELECT * FROM notificacion_log
          WHERE mascota_id = $1 
          AND tipo = 'baño'
          AND enviado_en > CURRENT_DATE - 7
          LIMIT 1
        `, [mascota.mascota_id]);

        if (ultimoRecordatorio.rows.length > 0) {
          continue; // Ya se envió hace poco
        }

        const urgencia = mascota.dias_sin_bano >= mascota.frecuencia_recomendada ? 
          '¡URGENTE!' : '';

        const asunto = `${urgencia} 🛁 ${mascota.mascota_nombre} necesita baño`;
        const mensaje = `
¡Hola ${mascota.usuario_nombre}!

${urgencia ? '⚠️ ' : ''}${mascota.mascota_nombre} necesita un baño:

🛁 Último baño: ${mascota.ultima_fecha ? 
  `Hace ${mascota.dias_sin_bano} días (${new Date(mascota.ultima_fecha).toLocaleDateString('es-ES')})` : 
  'Nunca registrado'}
📅 Frecuencia recomendada: Cada ${mascota.frecuencia_recomendada} días

¿Quieres agendar? Responde "Sí" y te ayudo o entra a la app.

¡${mascota.mascota_nombre} lo agradecerá! 🐾
TalkingPet
        `.trim();

        // Enviar notificaciones
        if (mascota.email) {
          await sendEmail(mascota.email, asunto, mensaje);
        }

        if (mascota.telefono) {
          await sendWhatsApp(mascota.telefono, mensaje);
        }

        // Registrar
        await registrarNotificacion({
          usuarioId: mascota.usuario_id,
          mascotaId: mascota.mascota_id,
          tipo: 'baño',
          medio: mascota.email && mascota.telefono ? 'email, whatsapp' : (mascota.email ? 'email' : 'whatsapp'),
          destinatario: mascota.email || mascota.telefono,
          asunto,
          mensaje,
          estado: 'enviado'
        });

        exitosos++;
      } catch (error) {
        console.error(`Error enviando recordatorio baño mascota ${mascota.mascota_id}:`, error);
        fallidos++;
      }
    }

    console.log(`✅ Recordatorios baño: ${exitosos} exitosos, ${fallidos} fallidos`);
    return { exitosos, fallidos, total: mascotasNecesitanBano.length };
  } catch (error) {
    console.error('Error en recordatorios de baño:', error);
    throw error;
  }
}

// ========== RECORDATORIOS DE RESTOCK ALIMENTOS ==========

/**
 * Recordar recompra de alimentos (según historial de compras)
 */
export async function recordatoriosRestock() {
  try {
    const query = `
      WITH ultimas_compras AS (
        SELECT DISTINCT ON (u.id, p.id)
          u.id as usuario_id,
          u.nombre as usuario_nombre,
          u.email,
          u.telefono,
          p.id as producto_id,
          p.nombre as producto_nombre,
          p.precio,
          p.stock,
          pd.fecha_pedido as ultima_compra,
          i.cantidad,
          DATE_PART('day', CURRENT_DATE - pd.fecha_pedido)::INT as dias_sin_comprar
        FROM usuario u
        JOIN pedido pd ON pd.usuario_id = u.id
        JOIN item_pedido i ON i.pedido_id = pd.id
        JOIN producto p ON i.producto_id = p.id
        WHERE p.categoria = 'alimentos'
        AND pd.estado IN ('pagado', 'enviado', 'entregado')
        AND u.activo = TRUE
        ORDER BY u.id, p.id, pd.fecha_pedido DESC
      )
      SELECT *
      FROM ultimas_compras
      WHERE dias_sin_comprar >= 28 -- ~1 mes
      AND dias_sin_comprar <= 45 -- No más de 45 días (ya muy tarde)
    `;

    const { rows: productos } = await pool.query(query);

    console.log(`🍖 Procesando ${productos.length} recordatorios de restock...`);

    let exitosos = 0;
    let fallidos = 0;

    for (const producto of productos) {
      try {
        // Verificar si ya se envió recordatorio recientemente
        const ultimoRecordatorio = await pool.query(`
          SELECT * FROM notificacion_log
          WHERE usuario_id = $1 
          AND tipo = 'restock'
          AND mensaje LIKE $2
          AND enviado_en > CURRENT_DATE - 15
          LIMIT 1
        `, [producto.usuario_id, `%${producto.producto_nombre}%`]);

        if (ultimoRecordatorio.rows.length > 0) {
          continue;
        }

        const asunto = `🍖 ¿Ya se acabó ${producto.producto_nombre}?`;
        const mensaje = `
¡Hola ${producto.usuario_nombre}!

Notamos que hace ${producto.dias_sin_comprar} días compraste:

🍖 ${producto.producto_nombre}
💰 Precio actual: Bs. ${producto.precio}
📦 Stock: ${producto.stock > 0 ? `${producto.stock} disponibles` : 'Por encargo'}

${producto.stock > 0 ? '✨ ¡OFERTA! Usa el código RESTOCK10 para 10% OFF' : '📢 Lo podemos conseguir en 24-48 horas'}

¿Necesitas más? Compra ahora en la app.

¡Tu mascota te lo agradecerá! 🐾
TalkingPet
        `.trim();

        // Enviar
        if (producto.email) {
          await sendEmail(producto.email, asunto, mensaje);
        }

        if (producto.telefono) {
          await sendWhatsApp(producto.telefono, mensaje);
        }

        // Registrar
        await registrarNotificacion({
          usuarioId: producto.usuario_id,
          mascotaId: null,
          tipo: 'restock',
          medio: producto.email && producto.telefono ? 'email, whatsapp' : (producto.email ? 'email' : 'whatsapp'),
          destinatario: producto.email || producto.telefono,
          asunto,
          mensaje,
          estado: 'enviado'
        });

        exitosos++;
      } catch (error) {
        console.error(`Error enviando recordatorio restock usuario ${producto.usuario_id}:`, error);
        fallidos++;
      }
    }

    console.log(`✅ Recordatorios restock: ${exitosos} exitosos, ${fallidos} fallidos`);
    return { exitosos, fallidos, total: productos.length };
  } catch (error) {
    console.error('Error en recordatorios de restock:', error);
    throw error;
  }
}

// ========== RECORDATORIOS DE CUMPLEAÑOS ==========

/**
 * Felicitar cumpleaños de mascotas
 */
export async function recordatoriosCumpleanos() {
  try {
    const query = `
      SELECT 
        m.id as mascota_id,
        m.nombre as mascota_nombre,
        m.fecha_nacimiento,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, m.fecha_nacimiento))::INT as edad,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email,
        u.telefono
      FROM mascota m
      JOIN usuario u ON m.usuario_id = u.id
      WHERE EXTRACT(MONTH FROM m.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM m.fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
      AND m.fecha_nacimiento IS NOT NULL
      AND u.activo = TRUE
    `;

    const { rows: cumpleanos } = await pool.query(query);

    console.log(`🎉 Procesando ${cumpleanos.length} cumpleaños de mascotas...`);

    let exitosos = 0;

    for (const cumple of cumpleanos) {
      try {
        const codigoDescuento = `CUMPLE${cumple.mascota_nombre.toUpperCase().substring(0, 5)}`;

        const asunto = `🎉🎂 ¡Feliz Cumpleaños ${cumple.mascota_nombre}!`;
        const mensaje = `
¡Feliz Cumpleaños ${cumple.mascota_nombre}! 🎂🎉

Hoy ${cumple.mascota_nombre} cumple ${cumple.edad} año${cumple.edad !== 1 ? 's' : ''}! 

🎁 Celebra con 20% OFF en toda la tienda
Usa el código: ${codigoDescuento}
Válido por 7 días

¿Qué tal un regalo especial? 🐾
• Juguetes nuevos
• Snacks premium
• Cama nueva

¡Feliz cumpleaños desde TalkingPet! 🐶🐱
        `.trim();

        // Enviar
        if (cumple.email) {
          await sendEmail(cumple.email, asunto, mensaje);
        }

        if (cumple.telefono) {
          await sendWhatsApp(cumple.telefono, mensaje);
        }

        // Registrar
        await registrarNotificacion({
          usuarioId: cumple.usuario_id,
          mascotaId: cumple.mascota_id,
          tipo: 'cumpleaños',
          medio: cumple.email && cumple.telefono ? 'email, whatsapp' : (cumple.email ? 'email' : 'whatsapp'),
          destinatario: cumple.email || cumple.telefono,
          asunto,
          mensaje,
          estado: 'enviado'
        });

        // TODO: Agregar código de descuento temporal a la BD o sistema de cupones

        exitosos++;
      } catch (error) {
        console.error(`Error enviando cumpleaños mascota ${cumple.mascota_id}:`, error);
      }
    }

    console.log(`✅ Cumpleaños enviados: ${exitosos}`);
    return { exitosos, total: cumpleanos.length };
  } catch (error) {
    console.error('Error en recordatorios de cumpleaños:', error);
    throw error;
  }
}

// ========== RECORDATORIOS DE CITAS (24H ANTES) ==========

/**
 * Recordar citas del día siguiente
 */
export async function recordatoriosCitas() {
  try {
    const query = `
      SELECT 
        c.id as cita_id,
        c.fecha,
        c.hora,
        c.comentarios,
        s.tipo as servicio,
        s.descripcion as servicio_desc,
        m.nombre as mascota_nombre,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email,
        u.telefono
      FROM cita c
      JOIN servicio s ON c.servicio_id = s.id
      JOIN mascota m ON c.mascota_id = m.id
      JOIN usuario u ON m.usuario_id = u.id
      WHERE c.fecha = CURRENT_DATE + 1
      AND c.estado = 'confirmada'
      AND u.activo = TRUE
    `;

    const { rows: citas } = await pool.query(query);

    console.log(`📅 Procesando ${citas.length} recordatorios de citas...`);

    let exitosos = 0;

    for (const cita of citas) {
      try {
        const asunto = `🐾 Recordatorio: Cita mañana de ${cita.mascota_nombre}`;
        const mensaje = `
¡Hola ${cita.usuario_nombre}!

Te recordamos que mañana ${cita.mascota_nombre} tiene cita:

📅 Fecha: ${new Date(cita.fecha).toLocaleDateString('es-ES')}
⏰ Hora: ${cita.hora.substring(0, 5)}
🐾 Servicio: ${cita.servicio}

¿Todo listo? Responde:
• "Confirmar" para confirmar
• "Cancelar" para cancelar (con 24h de anticipación)

¡Nos vemos mañana! 🏥
TalkingPet
        `.trim();

        // Enviar
        if (cita.email) {
          await sendEmail(cita.email, asunto, mensaje);
        }

        if (cita.telefono) {
          await sendWhatsApp(cita.telefono, mensaje);
        }

        // Registrar
        await registrarNotificacion({
          usuarioId: cita.usuario_id,
          mascotaId: null,
          tipo: 'cita',
          medio: cita.email && cita.telefono ? 'email, whatsapp' : (cita.email ? 'email' : 'whatsapp'),
          destinatario: cita.email || cita.telefono,
          asunto,
          mensaje,
          estado: 'enviado'
        });

        exitosos++;
      } catch (error) {
        console.error(`Error enviando recordatorio cita ${cita.cita_id}:`, error);
      }
    }

    console.log(`✅ Recordatorios citas: ${exitosos}`);
    return { exitosos, total: citas.length };
  } catch (error) {
    console.error('Error en recordatorios de citas:', error);
    throw error;
  }
}

// ========== FUNCIÓN PRINCIPAL ==========

/**
 * Ejecutar todos los recordatorios automáticos
 * Esta función debe ser llamada por un cron job diario
 */
export async function ejecutarRecordatoriosAutomaticos() {
  console.log('\n🤖 ========== INICIANDO RECORDATORIOS AUTOMÁTICOS ==========');
  console.log(`📅 Fecha: ${new Date().toLocaleString('es-ES')}\n`);

  try {
    const resultados = {
      vacunas: await recordatoriosVacunas(),
      bano: await recordatoriosBano(),
      restock: await recordatoriosRestock(),
      cumpleanos: await recordatoriosCumpleanos(),
      citas: await recordatoriosCitas()
    };

    const totalEnviados = Object.values(resultados)
      .reduce((sum, r) => sum + (r.exitosos || 0), 0);

    console.log('\n📊 ========== RESUMEN ==========');
    console.log(`💉 Vacunas: ${resultados.vacunas.exitosos}/${resultados.vacunas.total}`);
    console.log(`🛁 Baños: ${resultados.bano.exitosos}/${resultados.bano.total}`);
    console.log(`🍖 Restock: ${resultados.restock.exitosos}/${resultados.restock.total}`);
    console.log(`🎉 Cumpleaños: ${resultados.cumpleanos.exitosos}/${resultados.cumpleanos.total}`);
    console.log(`📅 Citas: ${resultados.citas.exitosos}/${resultados.citas.total}`);
    console.log(`\n✅ TOTAL ENVIADOS: ${totalEnviados}`);
    console.log('========================================\n');

    return resultados;
  } catch (error) {
    console.error('❌ Error ejecutando recordatorios automáticos:', error);
    throw error;
  }
}

// ========== HELPERS ==========

/**
 * Registrar notificación enviada en log
 */
async function registrarNotificacion(datos) {
  const {
    usuarioId,
    mascotaId,
    tipo,
    medio,
    destinatario,
    asunto,
    mensaje,
    estado,
    error
  } = datos;

  try {
    const query = `
      INSERT INTO notificacion_log (
        usuario_id, mascota_id, tipo, medio, destinatario,
        asunto, mensaje, estado, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await pool.query(query, [
      usuarioId, mascotaId, tipo, medio, destinatario,
      asunto, mensaje, estado, error
    ]);
  } catch (err) {
    console.error('Error registrando notificación en log:', err);
  }
}

/**
 * Limpiar notificaciones antiguas (> 90 días)
 */
export async function limpiarNotificacionesAntiguas() {
  try {
    const resultado = await pool.query(`
      DELETE FROM notificacion_log
      WHERE enviado_en < CURRENT_DATE - 90
    `);

    console.log(`🗑️ Notificaciones antiguas eliminadas: ${resultado.rowCount}`);
    return resultado.rowCount;
  } catch (error) {
    console.error('Error limpiando notificaciones antiguas:', error);
    throw error;
  }
}
