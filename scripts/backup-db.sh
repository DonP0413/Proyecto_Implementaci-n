#!/usr/bin/env bash
# =============================================================================
# backup-db.sh — Respaldo completo de PostgreSQL (formato custom, comprimido).
# Uso: ./scripts/backup-db.sh [etiqueta]
# Cron recomendado (diario 23:00, retención 14 días):
#   0 23 * * * cd /opt/pintotech && ./scripts/backup-db.sh diario >> backups/backup.log 2>&1
# También respalde el volumen de archivos (fotos/documentos): ver docs.
# =============================================================================
set -euo pipefail

LABEL="${1:-manual}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${LABEL}-${STAMP}.dump"

mkdir -p backups
source "$(dirname "$0")/lib/load-env.sh"; load_env .env

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9 --no-owner \
  -f "/backups/${FILE}"

SIZE="$(du -h "backups/${FILE}" | cut -f1)"
echo "[backup] Generado backups/${FILE} (${SIZE})"

# Respaldo del volumen de adjuntos
docker run --rm -v "${COMPOSE_PROJECT_NAME:-pintotech}_uploads:/data:ro" -v "$(pwd)/backups:/out" alpine \
  tar czf "/out/uploads-${LABEL}-${STAMP}.tar.gz" -C /data .
echo "[backup] Adjuntos: backups/uploads-${LABEL}-${STAMP}.tar.gz"

find backups -name '*.dump' -mtime "+${RETENTION_DAYS}" -delete
find backups -name 'uploads-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete
