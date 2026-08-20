const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// true mientras trabajas con "pnpm electron:dev", false en el .exe/.app ya empaquetado
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: `Generador de Cronogramas v${app.getVersion()}`,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true, // oculta la barra de menú (Archivo/Editar/Ver...) para que se vea como tu diseño
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:1420');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// "Guardar como..." nativo: el usuario elige carpeta y nombre, nosotros escribimos el archivo.
ipcMain.handle('save-file-dialog', async (_event, defaultName, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar cronograma',
    defaultPath: defaultName,
    filters: [{ name: 'Cronograma', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
});

// "Abrir archivo..." nativo: el usuario elige un .json, nosotros lo leemos y lo devolvemos.
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Abrir cronograma',
    properties: ['openFile'],
    filters: [{ name: 'Cronograma', extensions: ['json'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  const content = await fs.readFile(filePaths[0], 'utf-8');
  return { path: filePaths[0], content };
});

// ── Exportación por captura nativa (PDF/PNG/JPG) ──────────────────────────
// En vez de intentar que una librería en JS (html2canvas) entienda cada
// función de color que usa Tailwind (oklch, color-mix...), le pedimos al
// propio Chromium que tome una captura real de los píxeles ya renderizados.
// Así el resultado es siempre exacto, sin importar qué CSS se use.
//
// Como el cronograma puede ser más ancho/alto que la ventana, agrandamos
// temporalmente la ventana para que quepa todo sin recortar, capturamos, y
// la devolvemos a su tamaño original.

// 1) El renderer pide agrandar la ventana al tamaño que necesita el contenido.
ipcMain.handle('resize-window-for-capture', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const [prevWidth, prevHeight] = win.getContentSize();
  win.setContentSize(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
  return { prevWidth, prevHeight };
});

// 2) El renderer pide capturar una zona exacta (coordenadas ya en el nuevo tamaño).
ipcMain.handle('capture-rect', async (event, rect) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const image = await win.webContents.capturePage({
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  });
  return image.toDataURL();
});

// 3) El renderer pide devolver la ventana a su tamaño original.
ipcMain.handle('restore-window-size', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  win.setContentSize(Math.round(width), Math.round(height));
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

