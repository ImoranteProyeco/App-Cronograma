@echo off
setlocal
cd /d "%~dp0"
title Cronograma App v0.1.7 - desarrollo
where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro pnpm en el sistema.
  echo Abre una terminal en esta carpeta y ejecuta el comando que uses normalmente para iniciar el proyecto.
  echo.
  pause
  exit /b 1
)
echo Iniciando EXACTAMENTE la version de esta carpeta: %CD%
echo Debes ver la insignia v0.1.7 junto al titulo de la app.
echo.
pnpm electron:dev
