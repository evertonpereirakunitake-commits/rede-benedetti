# App nativo Android — Rede Benedetti Motorista

App Android nativo (Kotlin) que embrulha o site do motorista numa `WebView`
e adiciona **rastreamento de localização em segundo plano de verdade**
(funciona com o celular travado ou o app minimizado) — algo que um PWA
comum não consegue fazer.

## Como funciona

- `MainActivity.kt` — abre a `WebView` em `motorista-app.html`, pede as
  permissões de localização (incluindo a de segundo plano) e expõe a ponte
  `AndroidTracking` pro JavaScript da página.
- `LocationTrackingService.kt` — um *foreground service* (serviço em
  primeiro plano, com notificação fixa) que continua rodando mesmo com a
  tela apagada. A cada 1 minuto (ou 30m de deslocamento), manda a posição
  direto pra Edge Function `minhas-cargas` (ação `atualizar_posicao`) no
  Supabase.
- No lado do site, `app/motorista.html` detecta `window.AndroidTracking` e,
  se existir, usa o serviço nativo em vez do rastreio via navegador
  (`watchPosition` + heartbeat).

## Chave de assinatura (NÃO está no repositório)

O arquivo `.jks` e as senhas ficam fora do Git de propósito (repositório é
público). Pra recompilar:

1. Copie `keystore.properties.example` pra `../keystore/keystore.properties`
   (fora da pasta do projeto) e preencha com as senhas reais
2. **Guarde o arquivo `.jks` em local seguro** (ex: backup na nuvem privada) —
   se perder, não dá mais pra publicar atualizações do mesmo app; os
   usuários teriam que desinstalar e instalar um app "novo"

## Como recompilar depois de uma mudança

Precisa ter instalado: JDK 17, Android SDK (platform-tools, platforms;android-34,
build-tools;34.0.0) e Gradle 8.7.

```bash
gradle assembleRelease --no-daemon
```

O APK sai em `app/build/outputs/apk/release/app-release.apk`.

## Se quiser gerar o mesmo app pro gerente

A estrutura é idêntica — só trocar `MainActivity.URL_INICIAL` pra
`gerente-app.html` e o `applicationId`. O gerente não precisa de
rastreamento (só o motorista manda posição), então não é obrigatório, mas
dá pra fazer se quiser um ícone próprio também.
