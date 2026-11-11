#!/bin/sh
# =============================================================================
# Objetivo: preparar el contenedor antes de iniciar la API.
#   RUN_MIGRATIONS=true -> aplica migraciones SQL pendientes (con advisory lock)
#   RUN_SEED=true       -> crea el administrador inicial si no existe
# Si la migración falla, el contenedor NO arranca (fail-fast) y el deploy
# se detiene antes de exponer una versión con esquema incompatible.
# =============================================================================
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Ejecutando migraciones..."
  node dist/infrastructure/database/migrate.cli.js
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Ejecutando seed del administrador..."
  node dist/infrastructure/database/seed.cli.js
fi

echo "[entrypoint] Iniciando aplicación (versión ${APP_VERSION:-dev})"
exec "$@"
