# Generador de Cronogramas — App de escritorio (Electron)

Tu app de cronogramas (React) empaquetada con **Electron** para correr como
programa de escritorio, sin depender de Figma y sin necesitar instalar Rust
ni herramientas de compilación de C++.

## Exportación

El botón "Exportar" tiene 4 formatos:
- **PDF / PNG / JPG** — usan una **captura nativa real** de la ventana
  (la misma tecnología que un programa de capturas de pantalla), no una
  reconstrucción del CSS. Esto evita por completo los errores de "unsupported
  color function oklch" que daba la librería anterior (html2canvas), porque
  ya no depende de que una librería externa entienda cada función de color
  moderna que usa Tailwind — simplemente fotografía lo que Chromium ya
  renderizó. **Nota:** mientras exporta, la ventana se agranda un instante
  (para que quepa todo el cronograma sin recortar por el scroll) y luego
  vuelve a su tamaño normal — es esperado, no es un error.
- **Excel (.xlsx)** — ahora es un Gantt visual real: una hoja "Cronograma"
  con los meses/días como columnas y barras de color (los mismos colores que
  configuraste en cada fase/actividad/hito), más una hoja "Datos" con la
  tabla simple por si prefieres editar los valores directamente.

## Dónde se guardan tus cronogramas

La barra superior usa ahora **un solo botón Abrir y un solo botón Guardar**.
Al pulsarlos, la app pregunta qué origen/destino quieres usar:

1. **En línea** — usa la biblioteca interna de la app y sincroniza con Supabase
   cuando hay conexión.
2. **Este ordenador** — abre o guarda un archivo `.json` real mediante el
   diálogo nativo de Windows/Mac, en la carpeta que elijas.

Así se mantienen las dos formas de trabajo, pero sin duplicar botones en la
barra principal.

## Exportación

El botón "Exportar" ahora tiene 4 formatos:
- **PDF** — captura del cronograma, paginado según tamaño de papel y orientación.
- **PNG** — imagen del cronograma con fondo blanco.
- **JPG** — igual que PNG, comprimido.
- **Excel (.xlsx)** — no es una imagen: genera una tabla con 3 hojas
  (Actividades, Fases, Hitos) con nombres, fechas y duración.

## ⚠️ Importante: no trabajes dentro de una carpeta de OneDrive

Si tu proyecto vive dentro de `OneDrive - ...\...` (como pasó la primera vez),
Electron puede fallar al abrir silenciosamente porque OneDrive bloquea o
sincroniza archivos binarios grandes (como `electron.exe`) mientras Node los
usa. **Mueve la carpeta del proyecto a una ruta simple fuera de OneDrive**,
por ejemplo `C:\dev\cronograma-app`, y trabaja ahí. Vuelve a correr
`pnpm install` en la nueva ubicación.

## Cómo guarda los datos

- **Siempre guarda primero en tu ordenador.** Electron guarda esto dentro del
  perfil de la app (en `%APPDATA%` en Windows, `~/Library/Application Support`
  en Mac), así que sobrevive a que cierres y abras el programa, y funciona
  sin internet.
- **Si hay conexión**, además sincroniza con Supabase, para que tu equipo
  pueda compartir cronogramas entre varios ordenadores.
- Si guardaste algo sin internet, en la lista aparece como
  *"(pendiente de sincronizar)"* y se sube solo la próxima vez que haya
  conexión.

---

## 1. Preparar tu ordenador (solo tú, una sola vez)

Solo necesitas **Node.js** — nada de Rust, nada de compiladores de C++, nada
que pida permisos de administrador.

- Descarga Node.js (versión LTS) desde https://nodejs.org e instálalo.
- Instala pnpm:
  ```bash
  npm install -g pnpm
  ```

Eso es todo. Electron se descarga solo como una dependencia normal de npm en
el siguiente paso.

---

## 2. Instalar las dependencias del proyecto

Descomprime este `.zip`, abre una terminal dentro de la carpeta del proyecto
y ejecuta:

```bash
pnpm install
```

---

## 3. Probar la app en modo desarrollo

```bash
pnpm electron:dev
```

Esto abre una ventana nativa con tu app (arranca Vite y Electron juntos). Los
cambios que hagas en el código de React se recargan solos.

---

## 4. Generar aplicaciones de escritorio

### Windows x64 (portable)

```bash
pnpm electron:build:win
```

El `.exe` queda en `release/`. Esta es la misma modalidad portable que ya se utilizaba en Windows.

### macOS Universal (Intel + Apple Silicon)

La compilacion de macOS debe ejecutarse en un Mac o mediante GitHub Actions:

```bash
pnpm electron:build:mac
```

Genera un `.dmg` y un `.zip` Universal compatibles con Macs Intel (`x64`) y Apple Silicon (`arm64`).

Si no dispones de un Mac, consulta `COMPILAR_WINDOWS_Y_MAC.md`: el proyecto incluye `.github/workflows/build-desktop.yml` para que GitHub genere automaticamente Windows y macOS.

> Los paquetes macOS quedan sin firma/notarizacion hasta configurar una cuenta Apple Developer. Gatekeeper puede mostrar una advertencia al abrirlos por primera vez.

---

## 5. Configurar Supabase (opcional, para compartir en equipo)

Las credenciales están en `src/app/lib/storage.ts`, al principio del archivo:

```ts
const SUPABASE_URL = 'https://hujdumahgvlnvitgrmiz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_...';
const TABLE_NAME = 'Cronograma';
```

Ya vienen puestas las que traía tu proyecto original. Si cambias de proyecto
de Supabase, solo reemplaza esos dos valores. Si prefieres que la app
funcione 100% local sin ninguna nube, puedes dejarlos como están: si la
petición a Supabase falla, la app sigue funcionando igual, solo local.

---

## Estructura del proyecto

```
electron/main.cjs          → proceso principal de Electron (abre la ventana)
src/app/App.tsx             → pantalla principal (igual que tenías, usando storage.ts)
src/app/lib/storage.ts      → toda la lógica de guardar/cargar local + Supabase
src/app/types.ts            → tipos compartidos (Activity, Phase, Milestone...)
src/app/components/         → tus formularios y el Timeline, sin cambios
build/icon.png               → ícono de la app (puedes reemplazarlo por el tuyo, 1024x1024px)
```

## Si algo falla al instalar o compilar

Pégame el error tal cual aparece en la terminal y lo resolvemos.
