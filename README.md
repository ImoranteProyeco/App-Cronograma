# Generador de Cronogramas v0.1.7

Aplicacion de escritorio Electron para crear, guardar y exportar cronogramas.

## Desarrollo

```bash
pnpm install
pnpm electron:dev
```

## Compilar

Windows x64 portable:

```bash
pnpm electron:build:win
```

macOS Universal (Intel + Apple Silicon), desde macOS:

```bash
pnpm electron:build:mac
```

Si no tienes un Mac, el proyecto incluye GitHub Actions para generar automaticamente Windows y macOS. Consulta `COMPILAR_WINDOWS_Y_MAC.md`.

> La compilacion macOS incluida no esta firmada ni notarizada. Para distribucion profesional sin advertencias de Gatekeeper hace falta Apple Developer, firma y notarizacion.
