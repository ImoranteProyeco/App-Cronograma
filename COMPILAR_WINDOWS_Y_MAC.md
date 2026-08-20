# Generador de Cronogramas v0.1.7 - Windows y macOS

Esta version mantiene la compilacion portable de Windows y agrega macOS Universal (Intel x64 + Apple Silicon arm64).

## Windows

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
pnpm electron:dev
```

Para generar el ejecutable portable:

```powershell
pnpm electron:build:win
```

El resultado queda en `release/`.

> Si tu equipo Windows vuelve a mostrar errores por rutas largas, compila desde una ruta corta (por ejemplo `C:\Users\TU_USUARIO\Cronograma-App`).

## macOS en un Mac

Instala Node.js y pnpm, abre Terminal dentro del proyecto y ejecuta:

```bash
pnpm install
pnpm electron:dev
```

Para crear un unico paquete Universal compatible con Intel y Apple Silicon:

```bash
pnpm electron:build:mac
```

Tambien hay comandos separados para diagnostico:

```bash
pnpm electron:build:mac:x64
pnpm electron:build:mac:arm64
```

Los archivos `.dmg` y `.zip` quedan en `release/`.

## Compilar macOS sin tener un Mac: GitHub Actions

El proyecto incluye `.github/workflows/build-desktop.yml`.

1. Crea un repositorio en GitHub y sube el proyecto completo (sin `node_modules` ni `release`).
2. En GitHub abre la pestana **Actions**.
3. Selecciona **Compilar Windows y macOS**.
4. Pulsa **Run workflow**.
5. Al terminar, abre la ejecucion y descarga los artefactos del final de la pagina:
   - `Generador-Cronogramas-Windows-x64`
   - `Generador-Cronogramas-macOS-Universal`

Tambien se ejecuta automaticamente cuando subes una etiqueta que empiece por `v`, por ejemplo `v0.1.7`.

## Importante sobre macOS

El DMG generado por GitHub Actions queda sin firma ni notarizacion mientras no configures un certificado de Apple Developer. El programa es el mismo, pero Gatekeeper puede advertir al usuario al abrirlo por primera vez.

Para distribucion profesional sin esas advertencias, el siguiente paso es configurar:

- Apple Developer Program.
- Certificado **Developer ID Application**.
- Firma de la aplicacion.
- Notarizacion de Apple.

La configuracion de GitHub Actions se puede ampliar mas adelante para firmar y notarizar automaticamente usando secretos del repositorio.
