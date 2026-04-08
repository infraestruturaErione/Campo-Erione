# AppCampo - Sistema de Relatorios de Obra

App web para uso de tecnico em campo: cadastro de OS, fotos, historico e exportacao profissional em PDF/Excel.

## Funcionalidades atuais

- Login e sessao com backend dedicado + PostgreSQL (cookie HttpOnly).
- Cadastro publico removido da tela de login.
- Painel administrativo interno (aba `Admin`) para gerenciar usuarios cadastrados.
- Modo campo no formulario (wizard em etapas) com barra de acao fixa.
- Upload de foto sempre visivel (camera + galeria) em qualquer etapa.
- Autosave offline de rascunho da OS no navegador.
- Historico de OS com exportacao PDF/Excel e botao de apagar com confirmacao.
- Exclusao completa da OS (registro + fotos relacionadas no IndexedDB).
- Navbar com `logo-erione.png`.
- Fila offline de sincronizacao: registra tudo localmente e sincroniza quando houver internet.

### Como funciona o botao Sync

- O indicador no topo mostra quantos itens estao pendentes de sincronizacao (`X pend.`).
- Quando o app esta sem internet, aparece `Offline`.
- O botao `Sync` tenta enviar toda a fila pendente para o endpoint configurado.
- A sincronizacao tambem tenta rodar automaticamente quando a internet volta.
- Cada OS no historico mostra `Sync: PENDENTE_SYNC` ou `Sync: SINCRONIZADO`.

## Exportacao

- PDF com cabecalho, secoes tecnicas, relatorio fotografico, rodape com pagina e data.
- PDF com tratamento de imagem para fotos de celular (conversao quando formato nao e compativel).
- Excel com layout padronizado, logo, secoes tecnicas e fotos.

## Stack

- React + Vite + Lucide React
- IndexedDB (`idb`) para fotos
- LocalStorage para metadados e rascunho
- ExcelJS + jsPDF

## Como rodar

1. `npm install`
2. Subir PostgreSQL 18 (local ou remoto).
3. Criar `.env` a partir de `.env.example`.
4. Em um terminal: `npm run dev:api`
5. Em outro terminal: `npm run dev:web`
6. Abrir `http://localhost:5173`

### Variaveis de ambiente (auth + PostgreSQL)

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appcampo`
- `AUTH_API_PORT=3001`
- `AUTH_API_TARGET=http://localhost:3001`
- `AUTH_COOKIE_NAME=appcampo_sid`
- `SESSION_TTL_HOURS=24`
- `PG_SSLMODE=disable`

### Schema de autenticacao

- Arquivo base: `server/sql/001_auth_schema.sql`
- A API tambem garante criacao automatica de `users`, `auth_sessions` e `os_records` no startup.

### Promover usuario para admin

- Para um usuario ja existente:
  - `npm run admin:promote -- <username>`
- Novos usuarios devem ser criados pelo modulo Admin do sistema.

## Build para WebView mobile

Projeto ja configurado com **Capacitor + Android**.

1. Gerar build web: `npm run build`
2. Sincronizar com Android: `npm run cap:sync`
3. Abrir projeto nativo: `npm run android:open`
4. No Android Studio: executar em emulador/dispositivo ou gerar APK.

### Modo URL (WebView remoto no Android)

Se quiser que o app abra direto uma URL (em vez dos arquivos locais do `dist`):

1. No PowerShell, definir URL:
   - `$env:CAP_SERVER_URL = "https://seu-dominio.com"`
2. Sincronizar:
   - `npm run cap:sync`
3. Abrir Android Studio:
   - `npm run android:open`

Para voltar ao modo local (`dist`), remova a variavel da sessao:
- `Remove-Item Env:CAP_SERVER_URL`

### Endpoint de sincronizacao (fila offline)

- Defina o backend real para sync com:
  - `$env:VITE_SYNC_ENDPOINT = "https://seu-backend.com/api/sync/os"`
- Sem essa variavel, em desenvolvimento usa `/api/sync/os` (middleware local do Vite).

### Requisitos Android

- Java 11+ (ideal Java 17)
- Android Studio com SDK configurado

## APK debug gerado

- `android/app/build/outputs/apk/debug/app-debug.apk`

## Notas de seguranca para fase com banco

- Em producao, habilitar HTTPS e `NODE_ENV=production` para cookie `Secure`.
- Adicionar rate limit em `/api/auth/login` e lock temporario por tentativas.
- Implementar validacao server-side de todos os campos de OS.
- Implementar controle de permissao por perfil (ex: tecnico, admin).
- Adicionar auditoria de auth (login, falha, logout, cadastro).
