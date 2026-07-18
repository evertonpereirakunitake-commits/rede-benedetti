# App nativo Android — Rede Benedetti Gerente

App Android nativo (Kotlin) exclusivo pro gerente de posto — só uma
`WebView` travada em `gerente-app.html`. Mais simples que o do motorista:
não precisa de permissão de localização nem serviço em segundo plano,
porque o gerente só acompanha, não manda posição.

## Isolamento (importante)

`MainActivity.kt` intercepta toda navegação (`shouldOverrideUrlLoading`) e só
deixa abrir `gerente-app.html`, `painel_gerente.html` e `login.html?tipo=gerente`.
Qualquer outro link — inclusive o botão "Sair", que tecnicamente aponta pro
portal geral (`index.html`) — é bloqueado e redirecionado de volta pro início
do app. Isso garante que esse APK nunca mostra o dashboard, cadastros ou
telas do motorista, mesmo que alguém tente navegar manualmente.

## Chave de assinatura

Usa a **mesma chave** do app do motorista (`../keystore/rede-benedetti.jks`)
— apps diferentes podem compartilhar a mesma chave sem problema, já que os
`applicationId` são diferentes (`com.redebenedetti.gerente` vs
`com.redebenedetti.motorista`). Ver `keystore.properties.example` pro formato.

## Recompilar

```bash
gradle assembleRelease --no-daemon
```

APK sai em `app/build/outputs/apk/release/app-release.apk`.
