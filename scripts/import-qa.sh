#!/usr/bin/env bash
# =============================================================================
# import-qa.sh — Restaura en el ambiente de QA la copia anonimizada generada por
# export-qa.sh (base de datos y, opcionalmente, fotos/documentos).
# AVISO: DESTRUCTIVO para el ambiente donde se ejecuta: reemplaza sus datos.
#
# Uso:
#   ./scripts/import-qa.sh backups/qa-anonimizado-<fecha>.dump [backups/qa-archivos-<fecha>.tar.gz]
# Requisitos: .env propio de QA (cp .env.example .env) con MAIL_DRIVER=console
#             o un Mailgun sandbox, y el stack levantado (docker compose up -d).
# =============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1

DUMP="${1:?Uso: import-qa.sh <qa-anonimizado.dump> [qa-archivos.tar.gz]}"
FILES_TAR="${2:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
[ -f "$DUMP" ] || { echo "No existe $DUMP"; exit 1; }
[ -z "$FILES_TAR" ] || [ -f "$FILES_TAR" ] || { echo "No existe $FILES_TAR"; exit 1; }
[ -f .env ] || { echo "Falta .env (cp .env.example .env)"; exit 1; }
source "$(dirname "$0")/lib/load-env.sh"; load_env .env
dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

if [ "${MAIL_DRIVER:-console}" = "mailgun" ]; then
  echo "AVISO: MAIL_DRIVER=mailgun. En QA use 'console' o un dominio sandbox para no escribir a nadie real."
fi

read -r -p "Se reemplazarán los datos de '${POSTGRES_DB}' con ${DUMP}. Escriba RESTAURAR para continuar: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }

dc stop backend
dc exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction <"$DUMP"
dc start backend

if [ -n "$FILES_TAR" ]; then
  echo "[qa] Esperando al backend para copiar fotos y documentos…"
  for _ in $(seq 1 30); do
    dc exec -T backend true 2>/dev/null && break
    sleep 2
  done
  dc exec -T backend tar xzf - -C /app/storage <"$FILES_TAR"
fi
echo "[qa] Restauración completada. Ingrese con las credenciales de qa-credenciales-*.txt"
