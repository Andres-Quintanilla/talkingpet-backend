import { pool } from "../config/db.js";

/**
 * Servicio completo para el Historial Médico Digital de Mascotas
 * Incluye: vacunas, consultas, medicamentos, peso, alergias, documentos y alertas
 */

// ========== VACUNAS ==========

/**
 * Obtener todas las vacunas de una mascota
 */
export async function obtenerVacunasMascota(mascotaId) {
  try {
    const query = `
      SELECT 
        v.*,
        CASE 
          WHEN v.proxima_dosis IS NOT NULL AND v.proxima_dosis < CURRENT_DATE 
          THEN 'vencida'
          WHEN v.proxima_dosis IS NOT NULL AND v.proxima_dosis BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 
          THEN 'proxima'
          ELSE 'vigente'
        END as estado
      FROM mascota_vacuna v
      WHERE v.mascota_id = $1
      ORDER BY v.fecha_aplicacion DESC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo vacunas:', error);
    throw error;
  }
}

/**
 * Registrar nueva vacuna
 */
export async function registrarVacuna(datos) {
  const {
    mascotaId,
    vacuna,
    fechaAplicacion,
    proximaDosis,
    veterinario,
    clinica,
    lote,
    observaciones,
    creadoPor
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_vacuna (
        mascota_id, vacuna, fecha_aplicacion, proxima_dosis,
        veterinario, clinica, lote, observaciones, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, vacuna, fechaAplicacion, proximaDosis,
      veterinario, clinica, lote, observaciones, creadoPor
    ]);

    // Crear alerta automática si hay próxima dosis
    if (proximaDosis) {
      await crearAlerta({
        mascotaId,
        tipo: 'vacuna',
        titulo: `Próxima dosis: ${vacuna}`,
        descripcion: `Es momento de aplicar la siguiente dosis de ${vacuna}`,
        fechaAlerta: proximaDosis,
        prioridad: 'alta'
      });
    }

    return { exito: true, vacuna: rows[0] };
  } catch (error) {
    console.error('Error registrando vacuna:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Actualizar vacuna existente
 */
export async function actualizarVacuna(vacunaId, datos) {
  const {
    vacuna,
    fechaAplicacion,
    proximaDosis,
    veterinario,
    clinica,
    lote,
    observaciones
  } = datos;

  try {
    const query = `
      UPDATE mascota_vacuna 
      SET 
        vacuna = COALESCE($1, vacuna),
        fecha_aplicacion = COALESCE($2, fecha_aplicacion),
        proxima_dosis = COALESCE($3, proxima_dosis),
        veterinario = COALESCE($4, veterinario),
        clinica = COALESCE($5, clinica),
        lote = COALESCE($6, lote),
        observaciones = COALESCE($7, observaciones),
        actualizado_en = NOW()
      WHERE id = $8
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      vacuna, fechaAplicacion, proximaDosis, veterinario, 
      clinica, lote, observaciones, vacunaId
    ]);

    return { exito: true, vacuna: rows[0] };
  } catch (error) {
    console.error('Error actualizando vacuna:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Eliminar vacuna
 */
export async function eliminarVacuna(vacunaId) {
  try {
    await pool.query('DELETE FROM mascota_vacuna WHERE id = $1', [vacunaId]);
    return { exito: true };
  } catch (error) {
    console.error('Error eliminando vacuna:', error);
    return { exito: false, error: error.message };
  }
}

// ========== CONSULTAS VETERINARIAS ==========

/**
 * Obtener consultas de una mascota
 */
export async function obtenerConsultasMascota(mascotaId) {
  try {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM mascota_medicamento 
         WHERE consulta_id = c.id AND activo = true) as medicamentos_activos
      FROM mascota_consulta c
      WHERE c.mascota_id = $1
      ORDER BY c.fecha_consulta DESC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo consultas:', error);
    throw error;
  }
}

/**
 * Registrar consulta veterinaria
 */
export async function registrarConsulta(datos) {
  const {
    mascotaId,
    citaId,
    veterinario,
    clinica,
    fechaConsulta,
    motivo,
    diagnostico,
    tratamiento,
    pesoKg,
    temperaturaCelsius,
    frecuenciaCardiaca,
    observaciones,
    proximaConsulta,
    creadoPor
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_consulta (
        mascota_id, cita_id, veterinario, clinica, fecha_consulta,
        motivo, diagnostico, tratamiento, peso_kg, temperatura_celsius,
        frecuencia_cardiaca, observaciones, proxima_consulta, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, citaId, veterinario, clinica, fechaConsulta,
      motivo, diagnostico, tratamiento, pesoKg, temperaturaCelsius,
      frecuenciaCardiaca, observaciones, proximaConsulta, creadoPor
    ]);

    // Registrar peso si se proporcionó
    if (pesoKg) {
      await registrarPeso({
        mascotaId,
        pesoKg,
        fechaMedicion: fechaConsulta,
        observaciones: `Consulta: ${motivo}`,
        registradoPor: creadoPor
      });
    }

    // Crear alerta para próxima consulta
    if (proximaConsulta) {
      await crearAlerta({
        mascotaId,
        tipo: 'control',
        titulo: 'Control veterinario',
        descripcion: `Control de seguimiento con ${veterinario}`,
        fechaAlerta: proximaConsulta,
        prioridad: 'media'
      });
    }

    return { exito: true, consulta: rows[0] };
  } catch (error) {
    console.error('Error registrando consulta:', error);
    return { exito: false, error: error.message };
  }
}

// ========== MEDICAMENTOS ==========

/**
 * Obtener medicamentos activos de una mascota
 */
export async function obtenerMedicamentosActivos(mascotaId) {
  try {
    const query = `
      SELECT m.*, c.veterinario, c.clinica
      FROM mascota_medicamento m
      LEFT JOIN mascota_consulta c ON m.consulta_id = c.id
      WHERE m.mascota_id = $1 
      AND m.activo = true
      AND (m.fecha_fin IS NULL OR m.fecha_fin >= CURRENT_DATE)
      ORDER BY m.fecha_inicio DESC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo medicamentos:', error);
    throw error;
  }
}

/**
 * Registrar medicamento
 */
export async function registrarMedicamento(datos) {
  const {
    mascotaId,
    consultaId,
    medicamento,
    dosis,
    frecuencia,
    fechaInicio,
    fechaFin,
    viaAdministracion,
    indicaciones,
    recordatorio
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_medicamento (
        mascota_id, consulta_id, medicamento, dosis, frecuencia,
        fecha_inicio, fecha_fin, via_administracion, indicaciones, recordatorio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, consultaId, medicamento, dosis, frecuencia,
      fechaInicio, fechaFin, viaAdministracion, indicaciones, recordatorio
    ]);

    // Crear alerta si tiene recordatorio
    if (recordatorio && fechaFin) {
      await crearAlerta({
        mascotaId,
        tipo: 'medicamento',
        titulo: `Fin de tratamiento: ${medicamento}`,
        descripcion: `El tratamiento de ${medicamento} finaliza hoy`,
        fechaAlerta: fechaFin,
        prioridad: 'media'
      });
    }

    return { exito: true, medicamento: rows[0] };
  } catch (error) {
    console.error('Error registrando medicamento:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Actualizar medicamento
 */
export async function actualizarMedicamento(medicamentoId, datos) {
  const {
    medicamento,
    dosis,
    frecuencia,
    fechaInicio,
    fechaFin,
    viaAdministracion,
    indicaciones,
    recordatorio,
    activo
  } = datos;

  try {
    const query = `
      UPDATE mascota_medicamento 
      SET 
        medicamento = COALESCE($1, medicamento),
        dosis = COALESCE($2, dosis),
        frecuencia = COALESCE($3, frecuencia),
        fecha_inicio = COALESCE($4, fecha_inicio),
        fecha_fin = COALESCE($5, fecha_fin),
        via_administracion = COALESCE($6, via_administracion),
        indicaciones = COALESCE($7, indicaciones),
        recordatorio = COALESCE($8, recordatorio),
        activo = COALESCE($9, activo),
        actualizado_en = NOW()
      WHERE id = $10
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      medicamento, dosis, frecuencia, fechaInicio, fechaFin,
      viaAdministracion, indicaciones, recordatorio, activo, medicamentoId
    ]);

    return { exito: true, medicamento: rows[0] };
  } catch (error) {
    console.error('Error actualizando medicamento:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Desactivar medicamento (terminar tratamiento)
 */
export async function desactivarMedicamento(medicamentoId) {
  try {
    const query = `
      UPDATE mascota_medicamento 
      SET activo = false, actualizado_en = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await pool.query(query, [medicamentoId]);
    return { exito: true, medicamento: rows[0] };
  } catch (error) {
    console.error('Error desactivando medicamento:', error);
    return { exito: false, error: error.message };
  }
}

// ========== PESO ==========

/**
 * Obtener historial de peso
 */
export async function obtenerHistorialPeso(mascotaId) {
  try {
    const query = `
      SELECT * FROM mascota_peso
      WHERE mascota_id = $1
      ORDER BY fecha_medicion DESC
      LIMIT 50
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo historial de peso:', error);
    throw error;
  }
}

/**
 * Registrar peso
 */
export async function registrarPeso(datos) {
  const { mascotaId, pesoKg, fechaMedicion, observaciones, registradoPor } = datos;

  try {
    const query = `
      INSERT INTO mascota_peso (
        mascota_id, peso_kg, fecha_medicion, observaciones, registrado_por
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, pesoKg, fechaMedicion || new Date(), observaciones, registradoPor
    ]);

    return { exito: true, peso: rows[0] };
  } catch (error) {
    console.error('Error registrando peso:', error);
    return { exito: false, error: error.message };
  }
}

// ========== ALERGIAS ==========

/**
 * Obtener alergias activas
 */
export async function obtenerAlergiasMascota(mascotaId) {
  try {
    const query = `
      SELECT * FROM mascota_alergia
      WHERE mascota_id = $1 AND activa = true
      ORDER BY severidad DESC, fecha_diagnostico DESC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo alergias:', error);
    throw error;
  }
}

/**
 * Registrar alergia
 */
export async function registrarAlergia(datos) {
  const {
    mascotaId,
    tipo,
    alergia,
    severidad,
    sintomas,
    fechaDiagnostico,
    observaciones
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_alergia (
        mascota_id, tipo, alergia, severidad, sintomas,
        fecha_diagnostico, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, tipo, alergia, severidad, sintomas,
      fechaDiagnostico, observaciones
    ]);

    return { exito: true, alergia: rows[0] };
  } catch (error) {
    console.error('Error registrando alergia:', error);
    return { exito: false, error: error.message };
  }
}

// ========== DOCUMENTOS ==========

/**
 * Obtener documentos de una mascota
 */
export async function obtenerDocumentosMascota(mascotaId) {
  try {
    const query = `
      SELECT d.*, c.veterinario, c.fecha_consulta
      FROM mascota_documento d
      LEFT JOIN mascota_consulta c ON d.consulta_id = c.id
      WHERE d.mascota_id = $1
      ORDER BY d.fecha_documento DESC, d.creado_en DESC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    throw error;
  }
}

/**
 * Subir documento
 */
export async function subirDocumento(datos) {
  const {
    mascotaId,
    consultaId,
    tipo,
    titulo,
    descripcion,
    archivoUrl,
    archivoTipo,
    fechaDocumento,
    subidoPor
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_documento (
        mascota_id, consulta_id, tipo, titulo, descripcion,
        archivo_url, archivo_tipo, fecha_documento, subido_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, consultaId, tipo, titulo, descripcion,
      archivoUrl, archivoTipo, fechaDocumento, subidoPor
    ]);

    return { exito: true, documento: rows[0] };
  } catch (error) {
    console.error('Error subiendo documento:', error);
    return { exito: false, error: error.message };
  }
}

// ========== ALERTAS ==========

/**
 * Obtener alertas pendientes de una mascota
 */
export async function obtenerAlertasPendientes(mascotaId) {
  try {
    const query = `
      SELECT * FROM mascota_alerta
      WHERE mascota_id = $1 
      AND estado = 'pendiente'
      AND fecha_alerta >= CURRENT_DATE
      ORDER BY prioridad DESC, fecha_alerta ASC
    `;
    
    const { rows } = await pool.query(query, [mascotaId]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    throw error;
  }
}

/**
 * Crear alerta
 */
export async function crearAlerta(datos) {
  const {
    mascotaId,
    tipo,
    titulo,
    descripcion,
    fechaAlerta,
    fechaVencimiento,
    prioridad
  } = datos;

  try {
    const query = `
      INSERT INTO mascota_alerta (
        mascota_id, tipo, titulo, descripcion, fecha_alerta,
        fecha_vencimiento, prioridad
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      mascotaId, tipo, titulo, descripcion, fechaAlerta,
      fechaVencimiento, prioridad || 'media'
    ]);

    return { exito: true, alerta: rows[0] };
  } catch (error) {
    console.error('Error creando alerta:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Marcar alerta como completada
 */
export async function completarAlerta(alertaId) {
  try {
    const query = `
      UPDATE mascota_alerta 
      SET estado = 'completada', actualizado_en = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await pool.query(query, [alertaId]);
    return { exito: true, alerta: rows[0] };
  } catch (error) {
    console.error('Error completando alerta:', error);
    return { exito: false, error: error.message };
  }
}

// ========== EXPEDIENTE COMPLETO ==========

/**
 * Obtener expediente médico completo de una mascota
 */
export async function obtenerExpedienteCompleto(mascotaId) {
  try {
    // Información básica de la mascota
    const mascotaQuery = `
      SELECT m.*, u.nombre as dueno, u.email, u.telefono
      FROM mascota m
      JOIN usuario u ON m.usuario_id = u.id
      WHERE m.id = $1
    `;
    const { rows: [mascota] } = await pool.query(mascotaQuery, [mascotaId]);

    if (!mascota) {
      return { exito: false, error: 'Mascota no encontrada' };
    }

    // Obtener todos los componentes del expediente
    const [
      vacunas,
      consultas,
      medicamentos,
      historialPeso,
      alergias,
      documentos,
      alertas
    ] = await Promise.all([
      obtenerVacunasMascota(mascotaId),
      obtenerConsultasMascota(mascotaId),
      obtenerMedicamentosActivos(mascotaId),
      obtenerHistorialPeso(mascotaId),
      obtenerAlergiasMascota(mascotaId),
      obtenerDocumentosMascota(mascotaId),
      obtenerAlertasPendientes(mascotaId)
    ]);

    // Estadísticas
    const estadisticas = {
      totalVacunas: vacunas.length,
      vacunasVencidas: vacunas.filter(v => v.estado === 'vencida').length,
      totalConsultas: consultas.length,
      medicamentosActivos: medicamentos.length,
      pesoActual: historialPeso[0]?.peso_kg || null,
      alertasPendientes: alertas.length,
      alertasUrgentes: alertas.filter(a => a.prioridad === 'urgente' || a.prioridad === 'alta').length
    };

    return {
      exito: true,
      expediente: {
        mascota,
        vacunas,
        consultas,
        medicamentos,
        historialPeso,
        alergias,
        documentos,
        alertas,
        estadisticas
      }
    };
  } catch (error) {
    console.error('Error obteniendo expediente completo:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Crear expediente inicial (si no existe)
 */
export async function crearExpedienteInicial(mascotaId, creadoPor) {
  try {
    // Verificar si ya existe expediente
    const expediente = await obtenerExpedienteCompleto(mascotaId);
    
    if (expediente.exito) {
      // Ya existe, no hacer nada
      return { exito: true, mensaje: 'Expediente ya existe', expediente: expediente.expediente };
    }

    // Crear alertas iniciales básicas
    await crearAlerta({
      mascotaId,
      tipo: 'control',
      titulo: 'Chequeo veterinario anual',
      descripcion: 'Es recomendable hacer un chequeo veterinario anual',
      fechaAlerta: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 año
      prioridad: 'media'
    });

    await crearAlerta({
      mascotaId,
      tipo: 'desparasitacion',
      titulo: 'Desparasitación',
      descripcion: 'Recordatorio de desparasitación trimestral',
      fechaAlerta: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +3 meses
      prioridad: 'media'
    });

    return { 
      exito: true, 
      mensaje: 'Expediente inicial creado',
      expediente: await obtenerExpedienteCompleto(mascotaId)
    };
  } catch (error) {
    console.error('Error creando expediente inicial:', error);
    return { exito: false, error: error.message };
  }
}
