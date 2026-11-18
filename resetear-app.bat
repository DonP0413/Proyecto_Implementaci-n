@echo off
REM ===========================================================================
REM  PINTOTECH - Resetear la aplicacion (dejarla como recien instalada).
REM  Borra ordenes, clientes, usuarios, fotos y documentos. Pide escribir
REM  BORRAR para confirmar y guarda antes una copia en la carpeta "backups".
REM  La configuracion (backend\.env) se conserva.
REM ===========================================================================
setlocal
chcp 65001 >nul
title PINTOTECH - Resetear aplicacion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 set "PATH=%PATH%;%ProgramFiles%\nodejs"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Node.js. Ejecute primero iniciar.bat.
  echo.
  pause
  exit /b 1
)

node scripts\resetear-app.mjs
echo.
pause
