import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔧 Iniciando migración de tablas médicas...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../sql/migration-medical-tables.sql'),
      'utf-8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Migración completada exitosamente!');
    console.log('📋 Tablas creadas:');
    console.log('   - mascota_vacuna');
    console.log('   - mascota_consulta');
    console.log('   - mascota_medicamento');
    console.log('   - mascota_peso');
    console.log('   - mascota_alergia');
    console.log('   - mascota_documento');
    console.log('   - mascota_alerta');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();
