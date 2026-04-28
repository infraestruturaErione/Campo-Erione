# Erione Field

Aplicacao web e mobile para operacao de campo, relatorios tecnicos, fotos, sincronizacao offline e exportacao profissional em PDF/Excel.

## Stack

- Frontend: React + Vite
- Mobile: Capacitor Android
- Backend: Node.js + Express
- Banco: MariaDB
- Armazenamento de imagem: S3 compativel (Linode/Akamai ou equivalente)

## Principais recursos

- Login com sessao server-side
- Painel administrativo de usuarios
- Cadastro de OS com fotos e rascunho local
- Fila offline com sincronizacao posterior
- Exportacao PDF, Excel e compartilhamento por WhatsApp
- Build Android com nome `Erione Field`

## Variaveis de ambiente

Copie `.env.example` para `.env` em desenvolvimento e use `.env.production.example` como base para producao.

- `NODE_ENV`
- `DATABASE_URL`
- `AUTH_API_PORT`
- `AUTH_API_HOST`
- `AUTH_API_TARGET`
- `APP_BASE_URL`
- `VITE_API_BASE_URL`
- `AUTH_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS`
- `DB_SSLMODE`
- `AUTH_ALLOWED_ORIGINS`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `S3_FORCE_PATH_STYLE`

## Desenvolvimento local

1. `npm install`
2. Configurar MariaDB
3. Criar `.env`
4. Terminal 1: `npm run dev:api`
5. Terminal 2: `npm run dev:web`
6. Acessar `http://localhost:5173`

## Android / Capacitor

1. `npm run build`
2. `npm run cap:sync`
3. `npm run android:open`
4. Rodar via Android Studio ou gerar build

### Comandos uteis

- `npm run android:debug`
- `npm run android:bundle`
- `npm run android:devices`
- `npm run android:install:debug`

## Docker para producao

Arquivos incluidos:

- `Dockerfile.api`
- `Dockerfile.web`
- `docker-compose.prod.yml`
- `infra/nginx/default.conf`

Subida sugerida:

1. Criar arquivo `.env` de producao
2. Ajustar dominio em `APP_BASE_URL` e `AUTH_ALLOWED_ORIGINS`
3. Rodar:
   - `docker compose -f docker-compose.prod.yml up -d --build`

Servicos:

- `db`: MariaDB
- `api`: backend Express
- `web`: Nginx servindo o build e fazendo proxy de `/api`

## Publicacao mobile

Para Play Console, gerar `AAB` com:

- `npm run android:bundle`

Tambem e necessario:

- keystore real de producao
- `android/keystore.properties`
- revisao de ficha da Play Store
- politica de privacidade
- validacao de testes internos/fechados

## Seguranca aplicada

- `.env` ignorado no Git
- cookie de sessao com `httpOnly`
- cabecalhos de seguranca na API e no Nginx
- rate limit basico de login
- validacao de payload com Zod
- responses padronizadas da API
- URLs e credenciais sensiveis via ambiente

## Observacoes de producao

- Em producao, prefira `HTTPS`
- Defina `NODE_ENV=production`
- Use credenciais fortes para MariaDB e S3
- Revise CORS com o dominio final antes do deploy
- Gere `AAB` assinado para a Play Store
