#!/usr/bin/env bash
# =============================================================================
# restore-db.sh — Restaura un respaldo generado por backup-db.sh.
# AVISO: DESTRUCTIVO: reemplaza los datos actuales. Pide confirmación explícita.
# Uso: ./scripts/restore-db.sh backups/pre-deploy-1.2.0-20261107-210000.dump
# =============================================================================
set -euo pipefail

DUMP="${1:?Uso: restore-db.sh <archivo.dump>}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
[ -f "$DUMP" ] || { echo "No existe $DUMP"; exit 1; }
source "$(dirname "$0")/lib/load-env.sh"; load_env .env

read -r -p "Se reemplazará la BD '${POSTGRES_DB}' con ${DUMP}. Escriba RESTAURAR para continuar: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }

docker compose -f "$COMPOSE_FILE" stop backend
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner "/backups/$(basename "$DUMP")"
docker compose -f "$COMPOSE_FILE" start backend
echo "[restore] Restauración completada."
