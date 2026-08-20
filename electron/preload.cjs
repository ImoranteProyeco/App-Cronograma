const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro entre la ventana (React) y el proceso principal de Electron.
// Solo exponemos estas funciones puntuales, nada de acceso libre a Node/fs.
contextBridge.exposeInMainWorld('electronAPI', {
  // Abre el diálogo nativo "Guardar como...". Devuelve la ruta elegida o null
  // si el usuario canceló.
  saveFileDialog: (defaultName, content) =>
    ipcRenderer.invoke('save-file-dialog', defaultName, content),

  // Abre el diálogo nativo "Abrir archivo...". Devuelve { path, content } o
  // null si el usuario canceló.
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Exportación por captura nativa (ver electron/main.cjs para el detalle).
  resizeWindowForCapture: (size) => ipcRenderer.invoke('resize-window-for-capture', size),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  restoreWindowSize: (size) => ipcRenderer.invoke('restore-window-size', size),
});
