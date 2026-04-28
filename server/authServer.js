import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ensureAuthSchema, pool } from './db.js';
import { uploadImageToBucket } from './s3Service.js';
import { sendError, sendSuccess } from './response.js';

const app = express();
const port = Number(process.env.AUTH_API_PORT || 3001);
const host = process.env.AUTH_API_HOST || '0.0.0.0';
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || 24);
const sessionCookieName = process.env.AUTH_COOKIE_NAME || 'appcampo_sid';
const appBaseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
const isProduction = process.env.NODE_ENV === 'production';
const maxUploadBytes = Number(process.env.AUTH_MAX_UPLOAD_BYTES || 1024 * 1024);
const jsonBodyLimit = process.env.AUTH_JSON_LIMIT || '3mb';
const loginRateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const loginRateLimitMaxAttempts = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 8);
const rawAllowedOrigins = String(process.env.AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const defaultAllowedOrigins = isProduction
    ? []
    : [
        'http://localhost',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://10.0.2.2:5173',
        'capacitor://localhost',
        'ionic://localhost',
    ];
const allowedOrigins = new Set([...defaultAllowedOrigins, ...rawAllowedOrigins, ...(appBaseUrl ? [appBaseUrl] : [])]);
const isLoopbackOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin);
const loginAttemptStore = new Map();

const osPayloadSchema = z.object({
    id: z.string().uuid(),
    responsavelMotiva: z.string().trim().min(1).max(100),
    responsavelContratada: z.string().trim().min(1).max(100),
    obraEquipamento: z.string().trim().min(1).max(200),
    horarioInicio: z.string().trim().min(1).max(10),
    horarioFim: z.string().trim().min(1).max(10),
    local: z.string().trim().max(120).optional().default(''),
    segurancaTrabalho: z.string().trim().max(4000).optional().default(''),
    descricao: z.string().trim().min(1).max(12000),
    ocorrencias: z.string().trim().max(4000).optional().default(''),
    status: z.string().trim().min(2).max(40),
    ownerUserId: z.string().uuid().nullable().optional(),
    ownerUsername: z.string().trim().max(64).optional().default(''),
    ownerName: z.string().trim().max(100).optional().default(''),
    createdAt: z.string().datetime(),
    statusSync: z.string().trim().max(40).optional(),
    photoIds: z.array(z.string().min(1).max(200)).max(40).optional().default([]),
    photosMeta: z.array(
        z.object({
            id: z.string().min(1).max(200),
            note: z.string().trim().max(500).optional().default(''),
            objectKey: z.string().trim().max(400).optional(),
            url: z.string().trim().url().max(1200).optional(),
            mimeType: z.string().trim().max(120).optional(),
            size: z.number().int().nonnegative().max(25 * 1024 * 1024).optional(),
        })
    ).max(40).optional().default([]),
});

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.has(origin) || isLoopbackOrigin(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    return next();
});

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');

    if (isProduction) {
        const connectSrc = ["'self'"];
        if (appBaseUrl) {
            connectSrc.push(appBaseUrl);
        }

        res.setHeader(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "base-uri 'self'",
                "frame-ancestors 'none'",
                "object-src 'none'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                `connect-src ${connectSrc.join(' ')} https:`,
                "form-action 'self'",
            ].join('; ')
        );
    }

    return next();
});

app.use(express.json({ limit: jsonBodyLimit }));
app.use(cookieParser());
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadBytes },
});

const loginSchema = z.object({
    username: z.string().trim().min(3).max(64),
    password: z.string().min(6).max(128),
});

const userBaseSchema = {
    name: z.string().trim().min(3).max(100),
    username: z
        .string()
        .trim()
        .min(3)
        .max(64)
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Usuario deve conter apenas letras, numeros, _, . ou -'),
    password: z.string().min(6).max(128),
    role: z.enum(['technician', 'admin']).default('technician'),
};

const adminCreateUserSchema = z.object(userBaseSchema);

const adminUpdateUserSchema = z.object({
    name: z.string().trim().min(3).max(100).optional(),
    role: z.enum(['technician', 'admin']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).max(128).optional(),
});

const syncOperationSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('UPSERT'),
        osId: z.string().min(1).max(120),
        payload: osPayloadSchema,
    }),
    z.object({
        type: z.literal('DELETE'),
        osId: z.string().min(1).max(120),
        payload: z.object({ id: z.string().min(1).max(120) }).optional(),
    }),
]);

const statusUpdateSchema = z.object({
    status: z.string().trim().min(3).max(40),
});

const mediaUploadBase64Schema = z.object({
    osId: z.string().trim().min(1).max(120),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    base64: z.string().trim().min(16).max(maxUploadBytes * 2),
});

const toSafeUser = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
});

const normalizeOsPayload = (value) => {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') {
        return value;
    }
    return {};
};

const getClientIp = (req) => {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket?.remoteAddress || 'unknown';
};

const cleanupExpiredLoginAttempts = () => {
    const now = Date.now();
    for (const [key, entry] of loginAttemptStore.entries()) {
        if (entry.resetAt <= now) {
            loginAttemptStore.delete(key);
        }
    }
};

const consumeLoginAttempt = (key) => {
    cleanupExpiredLoginAttempts();
    const now = Date.now();
    const current = loginAttemptStore.get(key);

    if (!current || current.resetAt <= now) {
        const next = { attempts: 1, resetAt: now + loginRateLimitWindowMs };
        loginAttemptStore.set(key, next);
        return next;
    }

    current.attempts += 1;
    loginAttemptStore.set(key, current);
    return current;
};

const clearLoginAttempt = (key) => {
    loginAttemptStore.delete(key);
};

const toDbDateTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 19).replace('T', ' ');
};

const setSessionCookie = (res, sessionId, expiresAt) => {
    res.cookie(sessionCookieName, sessionId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
    });
};

const clearSessionCookie = (res) => {
    res.clearCookie(sessionCookieName, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
    });
};

const createSession = async (userId) => {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sessionId, userId, toDbDateTime(expiresAt)]
    );

    return { sessionId, expiresAt };
};

const resolveCurrentUser = async (req) => {
    const sessionId = req.cookies?.[sessionCookieName] || req.get('x-session-id');
    if (!sessionId) return null;

    await pool.query(`DELETE FROM auth_sessions WHERE expires_at <= NOW()`);
    const result = await pool.query(
        `SELECT u.id, u.name, u.username, u.role, u.is_active, u.created_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW() AND u.is_active = TRUE
         LIMIT 1`,
        [sessionId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    return result.rows[0];
};

const requireAuth = async (req, res, next) => {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) {
            clearSessionCookie(res);
            return sendError(res, 401, 'Sessao invalida');
        }
        req.user = user;
        return next();
    } catch (error) {
        console.error('Erro ao validar autenticacao', error);
        return sendError(res, 500, 'Falha ao validar autenticacao');
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) {
            clearSessionCookie(res);
            return sendError(res, 401, 'Sessao invalida');
        }
        if (user.role !== 'admin') {
            return sendError(res, 403, 'Acesso restrito para administradores');
        }
        req.user = user;
        return next();
    } catch (error) {
        console.error('Erro ao validar admin', error);
        return sendError(res, 500, 'Falha ao validar permissao');
    }
};

app.get('/api/health', (_req, res) => {
    return sendSuccess(res, { service: 'auth-api' });
});

app.post('/api/auth/register', (_req, res) => {
    return sendError(res, 403, 'Cadastro direto desabilitado. Solicite acesso ao administrador.');
});

app.post('/api/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, 400, 'Dados invalidos');
    }

    const { username, password } = parsed.data;
    const loginAttemptKey = `${username.toLowerCase()}::${getClientIp(req)}`;
    const existingAttempt = loginAttemptStore.get(loginAttemptKey);
    if (existingAttempt && existingAttempt.attempts >= loginRateLimitMaxAttempts && existingAttempt.resetAt > Date.now()) {
        return sendError(res, 429, 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.');
    }

    try {
        const result = await pool.query(
            `SELECT id, name, username, role, password_hash, is_active, created_at
             FROM users
             WHERE LOWER(username) = $1
             LIMIT 1`,
            [username.toLowerCase()]
        );

        if (result.rowCount === 0) {
            consumeLoginAttempt(loginAttemptKey);
            return sendError(res, 401, 'Usuario ou senha invalidos');
        }

        const user = result.rows[0];
        if (!user.is_active) {
            return sendError(res, 403, 'Usuario inativo');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            consumeLoginAttempt(loginAttemptKey);
            return sendError(res, 401, 'Usuario ou senha invalidos');
        }

        clearLoginAttempt(loginAttemptKey);
        const session = await createSession(user.id);
        setSessionCookie(res, session.sessionId, session.expiresAt);

        return sendSuccess(res, {
            user: toSafeUser(user),
            sessionId: session.sessionId,
        });
    } catch (error) {
        console.error('Erro no login', error);
        return sendError(res, 500, 'Falha ao autenticar');
    }
});

app.get('/api/auth/session', async (req, res) => {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) {
            clearSessionCookie(res);
            return sendError(res, 401, 'Sessao invalida');
        }

        return sendSuccess(res, { user: toSafeUser(user) });
    } catch (error) {
        console.error('Erro ao validar sessao', error);
        return sendError(res, 500, 'Falha ao validar sessao');
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const sessionId = req.cookies?.[sessionCookieName] || req.get('x-session-id');
    clearSessionCookie(res);

    if (!sessionId) {
        return sendSuccess(res);
    }

    try {
        await pool.query(`DELETE FROM auth_sessions WHERE id = $1`, [sessionId]);
        return sendSuccess(res);
    } catch (error) {
        console.error('Erro no logout', error);
        return sendError(res, 500, 'Falha no logout');
    }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();

    try {
        const result = await pool.query(
            `SELECT id, name, username, role, is_active, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        const items = result.rows
            .map(toSafeUser)
            .filter((item) => {
                if (!search) return true;
                const haystack = `${item.name} ${item.username} ${item.role}`.toLowerCase();
                return haystack.includes(search);
            });

        return sendSuccess(res, { items });
    } catch (error) {
        console.error('Erro ao listar usuarios', error);
        return sendError(res, 500, 'Falha ao carregar usuarios');
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, 400, parsed.error.issues[0]?.message || 'Dados invalidos');
    }

    const { name, username, password, role } = parsed.data;
    const normalizedUsername = username.toLowerCase();

    try {
        const existing = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1`,
            [normalizedUsername]
        );

        if (existing.rowCount > 0) {
            return sendError(res, 409, 'Usuario ja cadastrado');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await pool.query(
            `INSERT INTO users (id, name, username, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)`,
            [randomUUID(), name, normalizedUsername, passwordHash, role]
        );

        return sendSuccess(res, {}, 201);
    } catch (error) {
        console.error('Erro ao criar usuario', error);
        return sendError(res, 500, 'Falha ao criar usuario');
    }
});

app.patch('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    const userId = String(req.params.userId || '');
    const parsed = adminUpdateUserSchema.safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return sendError(res, 400, 'Atualizacao invalida');
    }

    try {
        const existing = await pool.query(
            `SELECT id FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );

        if (existing.rowCount === 0) {
            return sendError(res, 404, 'Usuario nao encontrado');
        }

        if (req.user.id === userId && parsed.data.isActive === false) {
            return sendError(res, 400, 'Nao e permitido desativar o proprio usuario admin');
        }

        const updates = [];
        const values = [];

        if (parsed.data.name) {
            values.push(parsed.data.name);
            updates.push(`name = $${values.length}`);
        }

        if (parsed.data.role) {
            values.push(parsed.data.role);
            updates.push(`role = $${values.length}`);
        }

        if (typeof parsed.data.isActive === 'boolean') {
            values.push(parsed.data.isActive);
            updates.push(`is_active = $${values.length}`);
        }

        if (parsed.data.password) {
            const hash = await bcrypt.hash(parsed.data.password, 12);
            values.push(hash);
            updates.push(`password_hash = $${values.length}`);
        }

        values.push(userId);

        await pool.query(
            `UPDATE users
             SET ${updates.join(', ')},
                 updated_at = NOW()
             WHERE id = $${values.length}`,
            values
        );

        return sendSuccess(res);
    } catch (error) {
        console.error('Erro ao atualizar usuario', error);
        return sendError(res, 500, 'Falha ao atualizar usuario');
    }
});

app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    const userId = String(req.params.userId || '');

    try {
        const existing = await pool.query(
            `SELECT id FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );

        if (existing.rowCount === 0) {
            return sendError(res, 404, 'Usuario nao encontrado');
        }

        if (req.user.id === userId) {
            return sendError(res, 400, 'Nao e permitido excluir o proprio usuario admin');
        }

        await pool.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

        return sendSuccess(res);
    } catch (error) {
        console.error('Erro ao excluir usuario', error);
        return sendError(res, 500, 'Falha ao excluir usuario');
    }
});

app.post('/api/sync/os', requireAuth, async (req, res) => {
    const parsed = syncOperationSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, 400, 'Operacao de sync invalida');
    }

    const operation = parsed.data;

    try {
        if (operation.type === 'UPSERT') {
            await pool.query(
                `INSERT INTO os_records (os_id, payload, submitted_by, last_operation, deleted_at, created_at, updated_at)
                 VALUES ($1, $2, $3, 'UPSERT', NULL, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE payload = VALUES(payload),
                                         submitted_by = VALUES(submitted_by),
                                         last_operation = 'UPSERT',
                                         deleted_at = NULL,
                                         updated_at = NOW()`,
                [operation.osId, JSON.stringify(operation.payload || {}), req.user.id]
            );
        } else {
            await pool.query(
                `INSERT INTO os_records (os_id, payload, submitted_by, last_operation, deleted_at, created_at, updated_at)
                 VALUES ($1, '{}', $2, 'DELETE', NOW(), NOW(), NOW())
                 ON DUPLICATE KEY UPDATE payload = VALUES(payload),
                                         submitted_by = VALUES(submitted_by),
                                         last_operation = 'DELETE',
                                         deleted_at = NOW(),
                                         updated_at = NOW()`,
                [operation.osId, req.user.id]
            );
        }

        return sendSuccess(res);
    } catch (error) {
        console.error('Erro no sync de OS', error);
        return sendError(res, 500, 'Falha ao sincronizar OS');
    }
});

app.post('/api/media/upload', requireAuth, upload.single('file'), async (req, res) => {
    const file = req.file;
    const osId = String(req.body?.osId || '');

    if (!file) {
        return sendError(res, 400, 'Arquivo de imagem obrigatorio');
    }

    if (!String(file.mimetype || '').startsWith('image/')) {
        return sendError(res, 400, 'Somente imagem pode ser enviada');
    }

    try {
        const uploaded = await uploadImageToBucket({
            buffer: file.buffer,
            mimeType: file.mimetype,
            originalName: file.originalname,
            osId,
        });

        return sendSuccess(res, {
            objectKey: uploaded.objectKey,
            url: uploaded.url,
            mimeType: file.mimetype,
            size: file.size,
        }, 201);
    } catch (error) {
        console.error('Erro ao enviar imagem para bucket', error);
        return sendError(res, 500, 'Falha ao enviar imagem');
    }
});

app.post('/api/media/upload-base64', requireAuth, async (req, res) => {
    const parsed = mediaUploadBase64Schema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, 400, parsed.error.issues[0]?.message || 'Payload de imagem invalido');
    }

    const { osId, fileName, mimeType, base64 } = parsed.data;
    if (!mimeType.startsWith('image/')) {
        return sendError(res, 400, 'Somente imagem pode ser enviada');
    }

    try {
        const normalizedBase64 = base64.includes(',') ? base64.split(',').pop() : base64;
        const buffer = Buffer.from(normalizedBase64 || '', 'base64');
        if (!buffer.length) {
            return sendError(res, 400, 'Imagem vazia ou invalida');
        }

        if (buffer.length > maxUploadBytes) {
            return sendError(res, 413, 'Imagem excede o limite de 1 MB');
        }

        const uploaded = await uploadImageToBucket({
            buffer,
            mimeType,
            filename: fileName,
            osId,
            uploadedBy: req.user.id,
        });

        return sendSuccess(res, uploaded, 201);
    } catch (error) {
        console.error('Erro no upload base64', error);
        return sendError(res, 500, 'Falha ao enviar imagem');
    }
});

app.get('/api/admin/os', requireAdmin, async (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim();

    try {
        const result = await pool.query(
            `SELECT o.os_id, o.payload, o.last_operation, o.deleted_at, o.updated_at, o.created_at,
                    u.username AS submitted_by_username, u.name AS submitted_by_name
             FROM os_records o
             LEFT JOIN users u ON u.id = o.submitted_by
             WHERE o.deleted_at IS NULL
             ORDER BY o.updated_at DESC`
        );

        const normalized = result.rows
            .map((row) => {
                const payload = normalizeOsPayload(row.payload);
                return {
                    osId: row.os_id,
                    payload,
                    status: payload.status || '-',
                    obraEquipamento: payload.obraEquipamento || '-',
                    responsavelContratada: payload.responsavelContratada || '-',
                    createdAt: payload.createdAt || row.created_at,
                    updatedAt: row.updated_at,
                    submittedBy: row.submitted_by_name || row.submitted_by_username || payload.ownerName || payload.ownerUsername || '-',
                };
            })
            .filter((item) => {
                if (status && item.status !== status) return false;
                if (!search) return true;
                const haystack = `${item.osId} ${item.obraEquipamento} ${item.responsavelContratada} ${item.submittedBy}`.toLowerCase();
                return haystack.includes(search);
            });

        return sendSuccess(res, { items: normalized });
    } catch (error) {
        console.error('Erro ao listar OS para admin', error);
        return sendError(res, 500, 'Falha ao carregar OS');
    }
});

app.patch('/api/admin/os/:osId/status', requireAdmin, async (req, res) => {
    const osId = String(req.params.osId || '');
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, 400, 'Status invalido');
    }

    try {
        const selected = await pool.query(
            `SELECT payload FROM os_records WHERE os_id = $1 AND deleted_at IS NULL LIMIT 1`,
            [osId]
        );

        if (selected.rowCount === 0) {
            return sendError(res, 404, 'OS nao encontrada');
        }

        const payload = selected.rows[0].payload || {};
        const normalizedPayload = normalizeOsPayload(payload);
        normalizedPayload.status = parsed.data.status;

        await pool.query(
            `UPDATE os_records
             SET payload = $2,
                 updated_at = NOW()
             WHERE os_id = $1`,
            [osId, JSON.stringify(normalizedPayload)]
        );

        return sendSuccess(res);
    } catch (error) {
        console.error('Erro ao atualizar status da OS', error);
        return sendError(res, 500, 'Falha ao atualizar status');
    }
});

app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') {
        return sendError(res, 413, 'Payload excede o limite permitido para sincronizacao');
    }

    if (error?.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 413, 'Imagem excede o limite de 1 MB');
    }

    if (error instanceof SyntaxError && 'body' in error) {
        return sendError(res, 400, 'JSON invalido na requisicao');
    }

    if (error instanceof multer.MulterError) {
        return sendError(res, 400, 'Falha no upload do arquivo');
    }

    console.error('Erro nao tratado na API', error);
    return sendError(res, 500, 'Erro interno do servidor');
});

const start = async () => {
    await ensureAuthSchema();
    app.listen(port, host, () => {
        console.log(`[auth-api] running on http://${host}:${port}`);
    });
};

start().catch((error) => {
    console.error('Falha ao iniciar auth API', error);
    process.exit(1);
});
