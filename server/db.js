import { Pool } from 'pg';

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

export const ensureAuthSchema = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'technician',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
        ON auth_sessions(expires_at);
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS os_records (
            os_id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
            last_operation TEXT NOT NULL,
            deleted_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_os_records_updated_at
        ON os_records(updated_at DESC);
    `);
};
