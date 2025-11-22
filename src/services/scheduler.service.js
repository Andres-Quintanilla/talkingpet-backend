import cron from 'node-cron';
import {
  ejecutarRecordatoriosAutomaticos,
  limpiarNotificacionesAntiguas,
  recordatoriosCitas, // Importamos las funciones específicas
} from './automated-reminders.service.js';

let tareasActivas = [];

/**
 * Iniciar todos los cron jobs
 */
export function iniciarScheduler() {
  console.log('🕐 Iniciando sistema de tareas programadas...\n');

  // ========== RECORDATORIOS DIARIOS (9:00 AM) ==========
  const recordatoriosDiarios = cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ Ejecutando recordatorios automáticos...');
      try {
        await ejecutarRecordatoriosAutomaticos();
      } catch (error) {
        console.error('❌ Error en recordatorios automáticos:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'America/La_Paz', // Ajusta según tu zona horaria
    }
  );

  tareasActivas.push({
    nombre: 'Recordatorios Diarios',
    cron: '0 9 * * *',
    descripcion: 'Envía recordatorios de vacunas, baños, restock y cumpleaños',
    tarea: recordatoriosDiarios,
  });

  console.log('✅ Recordatorios diarios (9:00 AM)');

  // ========== RECORDATORIOS DE CITAS (8:00 PM día anterior) ==========
  const recordatoriosCitasJob = cron.schedule(
    '0 20 * * *',
    async () => {
      console.log('⏰ Ejecutando recordatorios de citas...');
      try {
        await recordatoriosCitas(); // Llama a la función importada
      } catch (error) {
        console.error('❌ Error en recordatorios de citas:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'America/La_Paz',
    }
  );

  tareasActivas.push({
    nombre: 'Recordatorios de Citas',
    cron: '0 20 * * *',
    descripcion: 'Recuerda citas del día siguiente (24h antes)',
    tarea: recordatoriosCitasJob,
  });

  console.log('✅ Recordatorios de citas (8:00 PM)');

  // ========== LIMPIEZA DE LOGS ANTIGUOS (Domingo 2:00 AM) ==========
  const limpiezaLogs = cron.schedule(
    '0 2 * * 0',
    async () => {
      console.log('🗑️ Ejecutando limpieza de logs antiguos...');
      try {
        await limpiarNotificacionesAntiguas();
      } catch (error) {
        console.error('❌ Error en limpieza de logs:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'America/La_Paz',
    }
  );

  tareasActivas.push({
    nombre: 'Limpieza de Logs',
    cron: '0 2 * * 0',
    descripcion: 'Elimina notificaciones antiguas (>90 días) cada domingo',
    tarea: limpiezaLogs,
  });

  console.log('✅ Limpieza de logs (Domingo 2:00 AM)');

  // (Quitamos las alertas médicas y de medicamentos de aquí para simplificar)
  
  console.log(
    `\n🚀 Sistema de tareas programadas iniciado con ${tareasActivas.length} tareas\n`
  );
}

/**
 * Detener todos los cron jobs
 */
export function detenerScheduler() {
  console.log('🛑 Deteniendo tareas programadas...');

  tareasActivas.forEach(({ nombre, tarea }) => {
    tarea.stop();
    console.log(` 	✅ ${nombre} detenida`);
  });

  tareasActivas = [];
  console.log('✅ Todas las tareas programadas detenidas\n');
}

/**
 * Obtener estado de tareas activas
 */
export function obtenerEstadoTareas() {
  return tareasActivas.map(({ nombre, cron, descripcion }) => ({
    nombre,
    cron,
    descripcion,
    activa: true,
  }));
}

/**
 * Ejecutar manualmente todos los recordatorios (para testing)
 */
export async function ejecutarManualmente() {
  console.log('🔧 Ejecutando recordatorios manualmente (modo testing)...\n');
  try {
    const resultados = await ejecutarRecordatoriosAutomaticos();
    console.log('✅ Ejecución manual completada\n');
    return resultados;
  } catch (error) {
    console.error('❌ Error en ejecución manual:', error);
    throw error;
  }
}

export default {
  iniciarScheduler,
  detenerScheduler,
  obtenerEstadoTareas,
  ejecutarManualmente,
};