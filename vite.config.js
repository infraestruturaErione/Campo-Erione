import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const sessions = new Map()
const AUTH_USERS = [
    { username: 'admin', password: 'motiva123', name: 'Administrador' },
    { username: 'caio', password: 'motiva123', name: 'Caio' },
]

const parseBody = async (req) => new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
        body += chunk
    })
    req.on('end', () => {
        try {
            resolve(body ? JSON.parse(body) : {})
        } catch {
            resolve({})
        }
    })
})

const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
}

const getBearerToken = (req) => {
    const raw = req.headers.authorization || ''
    if (!raw.startsWith('Bearer ')) {
        return null
    }
    return raw.slice('Bearer '.length)
}

const ensureProgressFile = (logPath) => {
    if (fs.existsSync(logPath)) {
        return
    }

    const header = [
        'AppCampo - Ralph Loop Stream',
        '============================',
        '# Formato: [timestamp] RALPH_LOOP | cycle=0001 | phase=ACT | action=... | details=...',
        '',
    ].join('\n')

    fs.writeFileSync(logPath, header)
}

const ensureSyncMirrorFile = (syncMirrorPath) => {
    if (fs.existsSync(syncMirrorPath)) {
        return
    }

    fs.writeFileSync(syncMirrorPath, JSON.stringify({ operations: [] }, null, 2))
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'progress-log-api',
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    const pathname = req.url ? req.url.split('?')[0] : ''
                    const logPath = path.resolve(__dirname, 'progress.txt')
                    const syncMirrorPath = path.resolve(__dirname, 'sync-mirror.json')

                    if (pathname === '/api/log' && req.method === 'POST') {
                        ensureProgressFile(logPath)
                        const { log } = await parseBody(req)
                        if (!log) {
                            return sendJson(res, 400, { error: 'Campo log eh obrigatorio' })
                        }
                        fs.appendFileSync(logPath, `${log}\n`)
                        return sendJson(res, 200, { ok: true })
                    }

                    if (pathname === '/api/log' && req.method === 'GET') {
                        ensureProgressFile(logPath)
                        res.statusCode = 200
                        return res.end(fs.readFileSync(logPath))
                    }

                    if (pathname === '/api/auth/login' && req.method === 'POST') {
                        const { username, password } = await parseBody(req)
                        const user = AUTH_USERS.find((item) => item.username === username && item.password === password)

                        if (!user) {
                            return sendJson(res, 401, { error: 'Usuario ou senha invalidos' })
                        }

                        const token = randomUUID()
                        sessions.set(token, { username: user.username, name: user.name, createdAt: Date.now() })
                        return sendJson(res, 200, {
                            token,
                            user: { username: user.username, name: user.name },
                        })
                    }

                    if (pathname === '/api/auth/session' && req.method === 'GET') {
                        const token = getBearerToken(req)
                        const session = token ? sessions.get(token) : null

                        if (!session) {
                            return sendJson(res, 401, { error: 'Sessao invalida' })
                        }

                        return sendJson(res, 200, {
                            user: { username: session.username, name: session.name },
                        })
                    }

                    if (pathname === '/api/auth/logout' && req.method === 'POST') {
                        const token = getBearerToken(req)
                        if (token) {
                            sessions.delete(token)
                        }
                        return sendJson(res, 200, { ok: true })
                    }

                    if (pathname === '/api/sync/os' && req.method === 'POST') {
                        const operation = await parseBody(req)
                        ensureSyncMirrorFile(syncMirrorPath)

                        const data = JSON.parse(fs.readFileSync(syncMirrorPath))
                        data.operations.push({
                            ...operation,
                            receivedAt: new Date().toISOString(),
                        })
                        fs.writeFileSync(syncMirrorPath, JSON.stringify(data, null, 2))
                        return sendJson(res, 200, { ok: true })
                    }

                    next()
                });
            }
        }
    ],
})
