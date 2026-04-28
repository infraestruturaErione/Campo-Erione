import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada. Defina no ambiente antes de iniciar a API.');
}

const parsedUrl = new URL(connectionString);
if (!['mysql:', 'mariadb:'].includes(parsedUrl.protocol)) {
    throw new Error('DATABASE_URL deve usar mysql:// ou mariadb:// para a configuracao MariaDB.');
}

const sslMode = process.env.DB_SSLMODE === 'require';

const databaseConfig = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 3306),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.replace(/^\//, ''),
};

const normalizeSql = (sql) =>
    sql
        .replace(/\$(\d+)/g, '?')
        .replace(/::jsonb/g, '')
        .replace(/::json/g, '');

const wrapResult = (result) => {
    if (Array.isArray(result)) {
        return {
            rows: result,
            rowCount: result.length,
        };
    }

    return {
        rows: [],
        rowCount: Number(result.affectedRows || 0),
        insertId: result.insertId,
    };
};

const poolInstance = mysql.createPool({
    ...databaseConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslMode ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
    timezone: 'Z',
    typeCast: (field, next) => {
        if (field.type === 'JSON') {
            const value = field.string();
            return value ? JSON.parse(value) : null;
        }
        return next();
    },
});

const runQuery = async (executor, sql, params = []) => {
    const [result] = await executor.query(normalizeSql(sql), params);
    return wrapResult(result);
};

export const pool = {
    query: async (sql, params = []) => runQuery(poolInstance, sql, params),
    end: async () => poolInstance.end(),
};

export const withClient = async (callback) => {
    const connection = await poolInstance.getConnection();
    const client = {
        query: async (sql, params = []) => runQuery(connection, sql, params),
        release: () => connection.release(),
    };

    try {
        return await callback(client);
    } finally {
        connection.release();
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaSql = fs.readFileSync(path.join(__dirname, 'sql', '001_auth_schema.sql'), 'utf8');

export const ensureAuthSchema = async () => {
    await pool.query(schemaSql);
};
