@echo off
REM ===========================================================================
REM  PINTOTECH - Restablecer la contrasena de un ADMINISTRADOR (doble clic).
REM  Uselo si el administrador olvido su contrasena. Solo funciona en el equipo
REM  donde esta instalada la aplicacion. Puede estar abierta o cerrada.
REM ===========================================================================
setlocal
chcp 65001 >nul
title PINTOTECH - Restablecer contrasena de administrador
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

node scripts\restablecer-admin.mjs
echo.
pause
