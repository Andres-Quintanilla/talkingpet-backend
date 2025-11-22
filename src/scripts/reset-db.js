import { execSync } from 'node:child_process';
import 'dotenv/config';
const db = process.env.PGDATABASE;
execSync(`psql -d ${db} -f src/sql/schema.sql`, { stdio: 'inherit' });
execSync(`psql -d ${db} -f src/sql/seed.sql`, { stdio: 'inherit' });
console.log('DB reset OK');
