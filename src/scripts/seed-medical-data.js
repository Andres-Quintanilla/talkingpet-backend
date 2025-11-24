import 'dotenv/config';
import { pool } from '../config/db.js';

async function seedMedicalData() {
  try {
    console.log('🔍 Verificando mascotas existentes...');
    
    // Ver qué mascotas existen
    const { rows: mascotas } = await pool.query(`
      SELECT m.id, m.nombre, m.especie, u.email 
      FROM mascota m 
      JOIN usuario u ON m.usuario_id = u.id
      ORDER BY m.id
    `);
    
    console.log('Mascotas encontradas:', mascotas);
    
    if (mascotas.length === 0) {
      console.log('❌ No hay mascotas en la base de datos.');
      console.log('💡 Por favor, crea una mascota desde la interfaz primero.');
      return;
    }
    
    // Insertar datos para todas las mascotas que pertenecen a analia@gmail.com y la primera
    const mascotasParaDatos = mascotas.filter(m => m.email === 'analia@gmail.com' || m.id === 1);
    
    if (mascotasParaDatos.length === 0) {
      console.log('❌ No hay mascotas de analia@gmail.com ni mascota con ID 1.');
      return;
    }
    
    for (const mascota of mascotasParaDatos) {
      const mascotaId = mascota.id;
      console.log(`\n✅ Procesando mascota: ${mascota.nombre} (ID: ${mascotaId}) - ${mascota.email}`);
    
      // Insertar vacunas
      console.log('  📋 Insertando vacunas...');
      await pool.query(`
        INSERT INTO mascota_vacuna (mascota_id, vacuna, fecha_aplicacion, proxima_dosis, veterinario, observaciones)
        VALUES 
          ($1, 'Rabia', '2024-01-15', '2025-01-15', 'Dr. García', 'Primera dosis anual'),
          ($1, 'Parvovirus', '2024-02-10', '2025-02-10', 'Dra. López', 'Refuerzo anual'),
          ($1, 'Moquillo', '2024-03-05', '2025-03-05', 'Dr. García', 'Vacuna obligatoria'),
          ($1, 'Leptospirosis', '2024-04-12', '2025-04-12', 'Dr. García', 'Protección contra bacteria')
        ON CONFLICT DO NOTHING
      `, [mascotaId]);
      
      // Insertar consultas
      console.log('  📋 Insertando consultas...');
      await pool.query(`
        INSERT INTO mascota_consulta (mascota_id, fecha_consulta, motivo, diagnostico, tratamiento, veterinario)
        VALUES 
          ($1, '2024-06-20', 'Control de rutina', 'Mascota en excelente estado de salud', 'Ninguno requerido', 'Dr. García'),
          ($1, '2024-09-15', 'Dolor abdominal', 'Gastroenteritis leve', 'Dieta blanda por 3 días + probióticos', 'Dra. López'),
          ($1, '2024-11-10', 'Chequeo anual', 'Estado general bueno, ligero sobrepeso', 'Ajustar dieta y aumentar ejercicio', 'Dr. García')
        ON CONFLICT DO NOTHING
      `, [mascotaId]);
      
      // Insertar medicamentos
      console.log('  📋 Insertando medicamentos...');
      await pool.query(`
        INSERT INTO mascota_medicamento (mascota_id, medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, indicaciones)
        VALUES 
          ($1, 'Metronidazol', '250mg', 'Cada 12 horas', '2024-09-15', '2024-09-22', 'Tratamiento gastroenteritis'),
          ($1, 'Probióticos', '1 sobre', 'Diario', '2024-09-15', '2024-10-15', 'Restaurar flora intestinal'),
          ($1, 'Antiparasitario', '1 comprimido', 'Mensual', '2024-11-01', '2025-11-01', 'Prevención de parásitos')
        ON CONFLICT DO NOTHING
      `, [mascotaId]);
      
      // Insertar alergias
      console.log('  📋 Insertando alergias...');
      try {
        await pool.query(`
          INSERT INTO mascota_alergia (mascota_id, tipo, alergia, severidad, sintomas, observaciones)
          VALUES 
            ($1, 'ambiental', 'Polen de gramíneas', 'leve', 'Estornudos, picazón en ojos', 'Antihistamínico en primavera')
          ON CONFLICT DO NOTHING
        `, [mascotaId]);
      } catch (e) {
        console.log('  ⚠️  Error insertando alergias (continuando):', e.message);
      }
    }
    
    // Verificar totales
    console.log('\n✅ Datos insertados correctamente en todas las mascotas!');
    const { rows: stats } = await pool.query(`
      SELECT 'Vacunas' as tipo, COUNT(*) as total FROM mascota_vacuna WHERE mascota_id = ANY($1)
      UNION ALL
      SELECT 'Consultas', COUNT(*) FROM mascota_consulta WHERE mascota_id = ANY($1)
      UNION ALL
      SELECT 'Medicamentos', COUNT(*) FROM mascota_medicamento WHERE mascota_id = ANY($1)
      UNION ALL
      SELECT 'Alergias', COUNT(*) FROM mascota_alergia WHERE mascota_id = ANY($1)
    `, [mascotasParaDatos.map(m => m.id)]);
    
    console.log('\n📊 Resumen total:');
    stats.forEach(s => console.log(`  ${s.tipo}: ${s.total}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

seedMedicalData();
