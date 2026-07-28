# Checklist de publicacao iOS

Este projeto ja possui a pasta `ios/` gerada pelo Capacitor.

## O que foi preparado

- Dependencia `@capacitor/ios` adicionada.
- Scripts adicionados:
  - `npm run ios:sync`
  - `npm run ios:open`
- Projeto Xcode criado em `ios/App`.
- Assets web copiados para `ios/App/App/public`.
- Permissoes adicionadas no `Info.plist`:
  - `NSCameraUsageDescription`
  - `NSPhotoLibraryUsageDescription`
  - `NSPhotoLibraryAddUsageDescription`

## Passos no Mac

No macOS com Xcode e CocoaPods instalados:

```bash
npm install
npm run build
npm run ios:sync
npm run ios:open
```

Depois disso, abrir o projeto no Xcode, configurar o time de assinatura da Apple, bundle/versionamento e gerar o archive para publicar.

## Observacao

No Windows, o comando `npx cap add ios` cria a pasta e copia os assets, mas falha em `pod install` porque CocoaPods nao esta disponivel. Isso e esperado; o `pod install` roda no Mac durante `npm run ios:sync`.
