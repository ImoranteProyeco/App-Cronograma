#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Iniciando Generador de Cronogramas v0.1.7..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "No se encontro pnpm. Instala Node.js y pnpm antes de continuar."
  read -r -p "Pulsa Enter para cerrar..."
  exit 1
fi
if [ ! -d node_modules ]; then
  pnpm install
fi
pnpm electron:dev
