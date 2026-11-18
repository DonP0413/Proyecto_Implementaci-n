@echo off
REM ===========================================================================
REM  PINTOTECH - Iniciar la aplicacion local (doble clic).
REM  - Si falta Node.js, lo instala con winget (pide permiso de administrador).
REM  - La primera vez instala dependencias y compila (tarda unos minutos).
REM  - La aplicacion queda en segundo plano y esta ventana se cierra sola.
REM    Para cerrar la aplicacion: detener.bat
REM  Para recompilar despues de cambiar el codigo:  iniciar.bat --reconstruir
REM ===========================================================================
setlocal
chcp 65001 >nul
title PINTOTECH
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 goto :node_ok

echo [PINTOTECH] Node.js no esta instalado. Se instalara automaticamente.
where winget >nul 2>nul
if errorlevel 1 goto :sin_winget
echo [PINTOTECH] Instalando Node.js LTS. Acepte el permiso de administrador si Windows lo solicita...
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
REM Windows no actualiza el PATH de esta ventana: se agrega la carpeta de instalacion a mano.
set "PATH=%PATH%;%ProgramFiles%\nodejs"
where node >nul 2>nul
if errorlevel 1 goto :reabrir
echo [PINTOTECH] Node.js instalado correctamente.

:node_ok
if not exist "node_modules\" (
  echo [PINTOTECH] Instalando dependencias de la interfaz ^(solo la primera vez^)...
  call npm install --no-audit --no-fund || goto :error
)
if not exist "backend\node_modules\" (
  echo [PINTOTECH] Instalando dependencias del servidor ^(solo la primera vez^)...
  call npm install --prefix backend --no-audit --no-fund || goto :error
)

node scripts\iniciar-local.mjs %*
if errorlevel 1 goto :error
exit /b 0

:sin_winget
echo.
echo  No se pudo instalar Node.js automaticamente ^(winget no disponible^).
echo  Instale la version LTS desde https://nodejs.org y vuelva a ejecutar este archivo.
echo.
pause
exit /b 1

:reabrir
echo.
echo  Si la instalacion de Node.js termino bien, cierre esta ventana y vuelva a
echo  ejecutar iniciar.bat. Si fallo, instale la version LTS desde https://nodejs.org
echo.
pause
exit /b 1

:error
echo.
echo [PINTOTECH] No se pudo iniciar la aplicacion. Revise los mensajes anteriores.
pause
exit /b 1
