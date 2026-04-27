import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada. Defina no ambiente antes de iniciar a API.');
}

const sslMode = process.env.PG_SSLMODE === 'require';

export const pool = new Pool({
    connectionString,
    ssl: sslMode ? { rejectUnauthorized: false } : false,
});

export const withClient = async (callback) => {
    const client = await pool.connect();
    try {
        return await callback(client);
    } finally {
        client.release();
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaSql = fs.readFileSync(path.join(__dirname, 'sql', '001_auth_schema.sql'), 'utf8');

export const ensureAuthSchema = async () => {
    await pool.query(schemaSql);
};
