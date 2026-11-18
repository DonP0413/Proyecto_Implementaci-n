@echo off
REM ===========================================================================
REM  PINTOTECH - Cerrar la aplicacion local (doble clic).
REM  iniciar.bat deja la aplicacion en segundo plano; este archivo la detiene.
REM ===========================================================================
setlocal
chcp 65001 >nul
title PINTOTECH - Cerrar
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 set "PATH=%PATH%;%ProgramFiles%\nodejs"

node scripts\detener-local.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
ping -n 3 127.0.0.1 >nul
exit /b 0
