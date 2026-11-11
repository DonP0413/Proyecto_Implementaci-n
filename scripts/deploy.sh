#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliegue en el servidor (staging/producción) con:
#   1. Respaldo previo de la BD (checklist de la cátedra)
#   2. Pull de imágenes con el tag indicado
#   3. Arranque y verificación de salud (/health/ready)
#   4. ROLLBACK automático al último tag estable si la verificación falla
# Uso:  ./scripts/deploy.sh <IMAGE_TAG>        ej. ./scripts/deploy.sh 1.2.0
# Requiere en el servidor: docker, docker compose, .env de producción.
# =============================================================================
set -euo pipefail

NEW_TAG="${1:?Uso: deploy.sh <IMAGE_TAG>}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"
STATE_FILE=".last_successful_tag"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${FRONTEND_PORT:-8080}/health/ready}"
PREVIOUS_TAG="$(cat "$STATE_FILE" 2>/dev/null || echo "")"

log() { echo "[deploy $(date '+%F %T')] $*"; }

set_tag() {
  if grep -q '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env
  else
    echo "IMAGE_TAG=$1" >> .env
  fi
}

wait_healthy() {
  for i in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then return 0; fi
    log "Esperando salud ($i/30)..."
    sleep 5
  done
  return 1
}

log "Desplegando versión $NEW_TAG (anterior: ${PREVIOUS_TAG:-ninguna})"

log "1/4 Respaldo de base de datos"
./scripts/backup-db.sh "pre-deploy-${NEW_TAG}"

log "2/4 Descargando imágenes"
set_tag "$NEW_TAG"
$COMPOSE pull backend frontend

log "3/4 Iniciando servicios (las migraciones corren en el entrypoint del backend)"
$COMPOSE up -d --remove-orphans

log "4/4 Verificando salud en $HEALTH_URL"
if wait_healthy; then
  echo "$NEW_TAG" > "$STATE_FILE"
  docker image prune -f > /dev/null
  log "[OK] Despliegue exitoso: $NEW_TAG"
  exit 0
fi

log "[ERROR] La versión $NEW_TAG no pasó el health check"
$COMPOSE logs --tail=100 backend || true

if [ -n "$PREVIOUS_TAG" ]; then
  log "[ROLLBACK] Rollback a $PREVIOUS_TAG"
  set_tag "$PREVIOUS_TAG"
  $COMPOSE pull backend frontend
  $COMPOSE up -d
  if wait_healthy; then
    log "Rollback completado. Si la nueva versión aplicó migraciones incompatibles, restaure el respaldo:"
    log "  ./scripts/restore-db.sh backups/pre-deploy-${NEW_TAG}-*.dump"
  else
    log "[CRITICO] El rollback tampoco responde. Intervención manual requerida."
  fi
fi
exit 1
