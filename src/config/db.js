import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: false,
});

pool.on('error', (err) => {
    console.error('PG Pool error:', err);
});
