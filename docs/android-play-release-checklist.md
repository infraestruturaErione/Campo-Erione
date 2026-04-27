# Android: teste no celular e caminho para Play Store

## 1) Teste rápido no celular (USB)

1. Ative `Opções do desenvolvedor` e `Depuração USB` no Android.
2. Conecte o celular por cabo e aceite a chave RSA na tela do aparelho.
3. Na raiz do projeto:
   - `npm run build`
   - `npm run cap:sync`
   - `npm run android:devices` (precisa aparecer em `device`)
   - `npm run android:install:debug`
4. Abra o app no celular e valide login, sync e upload de foto.

## 2) Teste pela Play (Internal testing)

1. Gere o bundle:
   - `npm run build`
   - `npm run cap:sync`
   - `npm run android:bundle`
2. Envie o `.aab` em `android/app/build/outputs/bundle/release/`.
3. No Play Console, use `Testing > Internal testing` e adicione testadores.

## 3) Assinatura para release (obrigatório)

1. Crie um keystore de upload (uma vez):
   - `keytool -genkeypair -v -keystore android/keystore/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Crie `android/keystore.properties` a partir de `android/keystore.properties.example`.
3. Preencha:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`

Observação: `android/keystore.properties` e `android/keystore/` estão no `.gitignore`.

## 4) Checklist de publicação

1. Subir `versionCode` e `versionName` em `android/app/build.gradle`.
2. Confirmar `appId` final (não mudar depois de publicar).
3. Validar política de dados:
   - página de privacidade publicada (URL real)
   - formulário de Data safety no Play Console
4. Configurar Play App Signing e chave de upload.
5. Completar ficha da loja (nome, descrição, ícone, screenshots, categoria, contato).
6. Rodar teste interno e corrigir crashes/ANRs antes de produção.

## 5) Requisitos Play confirmados (em 17/04/2026)

- Novos apps e updates devem mirar Android 15+ (API 35+) para Play.
- Publicação de app novo é via Android App Bundle (`.aab`).
- Internal testing suporta até 100 testadores.
- Contas pessoais novas (após 13/11/2023) precisam cumprir requisito de teste fechado (12 testers por 14 dias) antes de produção.

Fontes:
- https://developer.android.com/google/play/requirements/target-sdk
- https://developer.android.com/guide/app-bundle
- https://support.google.com/googleplay/android-developer/answer/9845334
- https://support.google.com/googleplay/android-developer/answer/14151465
