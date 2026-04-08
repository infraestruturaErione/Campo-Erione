import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ensureAuthSchema, pool } from './db.js';
import { uploadImageToBucket } from './s3Service.js';

const app = express();
const port = Number(process.env.AUTH_API_PORT || 3001);
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || 24);
const sessionCookieName = process.env.AUTH_COOKIE_NAME || 'appcampo_sid';

const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
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

const syncOperationSchema = z.object({
    type: z.enum(['UPSERT', 'DELETE']),
    osId: z.string().min(1).max(120),
    payload: z.any().optional(),
});

const statusUpdateSchema = z.object({
    status: z.string().trim().min(3).max(40),
});

const toSafeUser = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
});

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
        sameSite: 'lax',
        path: '/',
    });
};

const createSession = async (userId) => {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [sessionId, userId, expiresAt.toISOString()]
    );

    return { sessionId, expiresAt };
};

const resolveCurrentUser = async (req) => {
    const sessionId = req.cookies?.[sessionCookieName];
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
            return res.status(401).json({ error: 'Sessao invalida' });
        }
        req.user = user;
        return next();
    } catch (error) {
        console.error('Erro ao validar autenticacao', error);
        return res.status(500).json({ error: 'Falha ao validar autenticacao' });
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) {
            clearSessionCookie(res);
            return res.status(401).json({ error: 'Sessao invalida' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso restrito para administradores' });
        }
        req.user = user;
        return next();
    } catch (error) {
        console.error('Erro ao validar admin', error);
        return res.status(500).json({ error: 'Falha ao validar permissao' });
    }
};

app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

app.post('/api/auth/register', (_req, res) => {
    return res.status(403).json({ error: 'Cadastro direto desabilitado. Solicite acesso ao administrador.' });
});

app.post('/api/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Dados invalidos' });
    }

    const { username, password } = parsed.data;

    try {
        const result = await pool.query(
            `SELECT id, name, username, role, password_hash, is_active, created_at
             FROM users
             WHERE LOWER(username) = $1
             LIMIT 1`,
            [username.toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: 'Usuario ou senha invalidos' });
        }

        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Usuario inativo' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Usuario ou senha invalidos' });
        }

        const session = await createSession(user.id);
        setSessionCookie(res, session.sessionId, session.expiresAt);

        return res.status(200).json({
            user: toSafeUser(user),
        });
    } catch (error) {
        console.error('Erro no login', error);
        return res.status(500).json({ error: 'Falha ao autenticar' });
    }
});

app.get('/api/auth/session', async (req, res) => {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) {
            clearSessionCookie(res);
            return res.status(401).json({ error: 'Sessao invalida' });
        }

        return res.status(200).json({ user: toSafeUser(user) });
    } catch (error) {
        console.error('Erro ao validar sessao', error);
        return res.status(500).json({ error: 'Falha ao validar sessao' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const sessionId = req.cookies?.[sessionCookieName];
    clearSessionCookie(res);

    if (!sessionId) {
        return res.status(200).json({ ok: true });
    }

    try {
        await pool.query(`DELETE FROM auth_sessions WHERE id = $1`, [sessionId]);
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro no logout', error);
        return res.status(500).json({ error: 'Falha no logout' });
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

        return res.status(200).json({ items });
    } catch (error) {
        console.error('Erro ao listar usuarios', error);
        return res.status(500).json({ error: 'Falha ao carregar usuarios' });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados invalidos' });
    }

    const { name, username, password, role } = parsed.data;
    const normalizedUsername = username.toLowerCase();

    try {
        const existing = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1`,
            [normalizedUsername]
        );

        if (existing.rowCount > 0) {
            return res.status(409).json({ error: 'Usuario ja cadastrado' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await pool.query(
            `INSERT INTO users (id, name, username, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)`,
            [randomUUID(), name, normalizedUsername, passwordHash, role]
        );

        return res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Erro ao criar usuario', error);
        return res.status(500).json({ error: 'Falha ao criar usuario' });
    }
});

app.patch('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    const userId = String(req.params.userId || '');
    const parsed = adminUpdateUserSchema.safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: 'Atualizacao invalida' });
    }

    try {
        const existing = await pool.query(
            `SELECT id FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );

        if (existing.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario nao encontrado' });
        }

        if (req.user.id === userId && parsed.data.isActive === false) {
            return res.status(400).json({ error: 'Nao e permitido desativar o proprio usuario admin' });
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

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao atualizar usuario', error);
        return res.status(500).json({ error: 'Falha ao atualizar usuario' });
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
            return res.status(404).json({ error: 'Usuario nao encontrado' });
        }

        if (req.user.id === userId) {
            return res.status(400).json({ error: 'Nao e permitido excluir o proprio usuario admin' });
        }

        await pool.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao excluir usuario', error);
        return res.status(500).json({ error: 'Falha ao excluir usuario' });
    }
});

app.post('/api/sync/os', requireAuth, async (req, res) => {
    const parsed = syncOperationSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Operacao de sync invalida' });
    }

    const operation = parsed.data;

    try {
        if (operation.type === 'UPSERT') {
            await pool.query(
                `INSERT INTO os_records (os_id, payload, submitted_by, last_operation, deleted_at, created_at, updated_at)
                 VALUES ($1, $2::jsonb, $3, 'UPSERT', NULL, NOW(), NOW())
                 ON CONFLICT (os_id)
                 DO UPDATE SET payload = EXCLUDED.payload,
                               submitted_by = EXCLUDED.submitted_by,
                               last_operation = 'UPSERT',
                               deleted_at = NULL,
                               updated_at = NOW()`,
                [operation.osId, JSON.stringify(operation.payload || {}), req.user.id]
            );
        } else {
            await pool.query(
                `INSERT INTO os_records (os_id, payload, submitted_by, last_operation, deleted_at, created_at, updated_at)
                 VALUES ($1, '{}'::jsonb, $2, 'DELETE', NOW(), NOW(), NOW())
                 ON CONFLICT (os_id)
                 DO UPDATE SET last_operation = 'DELETE',
                               deleted_at = NOW(),
                               updated_at = NOW()`,
                [operation.osId, req.user.id]
            );
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro no sync de OS', error);
        return res.status(500).json({ error: 'Falha ao sincronizar OS' });
    }
});

app.post('/api/media/upload', requireAuth, upload.single('file'), async (req, res) => {
    const file = req.file;
    const osId = String(req.body?.osId || '');

    if (!file) {
        return res.status(400).json({ error: 'Arquivo de imagem obrigatorio' });
    }

    if (!String(file.mimetype || '').startsWith('image/')) {
        return res.status(400).json({ error: 'Somente imagem pode ser enviada' });
    }

    try {
        const uploaded = await uploadImageToBucket({
            buffer: file.buffer,
            mimeType: file.mimetype,
            originalName: file.originalname,
            osId,
        });

        return res.status(201).json({
            objectKey: uploaded.objectKey,
            url: uploaded.url,
            mimeType: file.mimetype,
            size: file.size,
        });
    } catch (error) {
        console.error('Erro ao enviar imagem para bucket', error);
        return res.status(500).json({ error: 'Falha ao enviar imagem' });
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
                const payload = row.payload || {};
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

        return res.status(200).json({ items: normalized });
    } catch (error) {
        console.error('Erro ao listar OS para admin', error);
        return res.status(500).json({ error: 'Falha ao carregar OS' });
    }
});

app.patch('/api/admin/os/:osId/status', requireAdmin, async (req, res) => {
    const osId = String(req.params.osId || '');
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Status invalido' });
    }

    try {
        const selected = await pool.query(
            `SELECT payload FROM os_records WHERE os_id = $1 AND deleted_at IS NULL LIMIT 1`,
            [osId]
        );

        if (selected.rowCount === 0) {
            return res.status(404).json({ error: 'OS nao encontrada' });
        }

        const payload = selected.rows[0].payload || {};
        payload.status = parsed.data.status;

        await pool.query(
            `UPDATE os_records
             SET payload = $2::jsonb,
                 updated_at = NOW()
             WHERE os_id = $1`,
            [osId, JSON.stringify(payload)]
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao atualizar status da OS', error);
        return res.status(500).json({ error: 'Falha ao atualizar status' });
    }
});

const start = async () => {
    await ensureAuthSchema();
    await pool.query(`UPDATE users SET role = 'technician' WHERE role NOT IN ('admin', 'technician')`);
    app.listen(port, () => {
        console.log(`[auth-api] running on http://localhost:${port}`);
    });
};

start().catch((error) => {
    console.error('Falha ao iniciar auth API', error);
    process.exit(1);
});
