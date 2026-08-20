import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  // './' es necesario para que Electron cargue bien los archivos con file://
  // en la versión empaquetada, pero rompe el servidor de desarrollo si se
  // aplica también ahí — por eso solo se usa al hacer "build".
  base: command === 'build' ? './' : '/',
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },

  // ── A partir de aquí: necesario para que la app de escritorio (Electron) funcione ──
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
}))
