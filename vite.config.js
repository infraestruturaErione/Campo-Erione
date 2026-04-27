import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

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

const ensureProgressFile = (logPath) => {
    if (fs.existsSync(logPath)) {
        return
    }

    const header = [
        'Erione Field - Progress Stream',
        '===============================',
        '# Formato: [timestamp] RALPH_LOOP | cycle=0001 | phase=ACT | action=... | details=...',
        '',
    ].join('\n')

    fs.writeFileSync(logPath, header)
}

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom'],
                    pdf: ['jspdf', 'jspdf-autotable', 'html2canvas'],
                    excel: ['exceljs'],
                    capacitor: ['@capacitor/core', '@capacitor/filesystem', '@capacitor/share'],
                },
            },
        },
    },
    server: {
        proxy: {
            '/api/auth': {
                target: process.env.AUTH_API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/sync': {
                target: process.env.AUTH_API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/admin': {
                target: process.env.AUTH_API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/media': {
                target: process.env.AUTH_API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    plugins: [
        react(),
        {
            name: 'progress-log-api',
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    const pathname = req.url ? req.url.split('?')[0] : ''
                    const logPath = path.resolve(__dirname, 'progress.txt')
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

                    next()
                });
            }
        }
    ],
})
