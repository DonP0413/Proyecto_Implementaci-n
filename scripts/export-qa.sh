#!/usr/bin/env bash
# =============================================================================
# export-qa.sh — Genera una copia ANONIMIZADA de la base para el equipo de QA.
#
#   1. Copia la base actual a una base temporal (pintotech_qa_export).
#   2. Aplica database/qa/anonimizar.sql (datos personales -> ficticios).
#   3. Exporta la copia a backups/qa-anonimizado-<fecha>.dump
#   4. (Opcional) Empaqueta fotos y documentos en backups/qa-archivos-<fecha>.tar.gz
#      (sin los comprobantes PDF, que llevan datos reales impresos).
#   5. Escribe backups/qa-credenciales-<fecha>.txt con los usuarios de QA.
#   La base real NO se modifica; la temporal se elimina al terminar.
#
# Uso:
#   ./scripts/export-qa.sh                 # base + archivos
#   ./scripts/export-qa.sh --sin-archivos  # sólo la base
#   QA_PASSWORD='ClaveQA2026' ./scripts/export-qa.sh   # contraseña de QA fija
# Variables: COMPOSE_FILE (por defecto docker-compose.yml).
# Para restaurar en el ambiente de QA: ./scripts/import-qa.sh
# =============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: no convertir rutas de los contenedores

INCLUDE_FILES=true
[ "${1:-}" = "--sin-archivos" ] && INCLUDE_FILES=false

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TMP_DB="pintotech_qa_export"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="backups/qa-anonimizado-${STAMP}.dump"
FILES_TAR="backups/qa-archivos-${STAMP}.tar.gz"
CREDENTIALS="backups/qa-credenciales-${STAMP}.txt"
# Contraseña aleatoria (od no corta el pipe, a diferencia de `tr </dev/urandom | head`, que falla con pipefail).
QA_PASSWORD="${QA_PASSWORD:-QA-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')-2026}"

[ -f .env ] || { echo "Ejecute desde la raíz del proyecto (no se encontró .env)"; exit 1; }
source "$(dirname "$0")/lib/load-env.sh"; load_env .env
mkdir -p backups

dc() { docker compose -f "$COMPOSE_FILE" "$@"; }
psql_on() { local db="$1"; shift; dc exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$db" "$@"; }
cleanup() { psql_on postgres -c "DROP DATABASE IF EXISTS ${TMP_DB};" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[qa] 1/5 Copiando '${POSTGRES_DB}' a la base temporal '${TMP_DB}'…"
psql_on postgres -c "DROP DATABASE IF EXISTS ${TMP_DB};" -c "CREATE DATABASE ${TMP_DB};"
dc exec -T postgres sh -c \
  "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --format=custom --no-owner | pg_restore -U \"\$POSTGRES_USER\" -d ${TMP_DB} --no-owner --exit-on-error"

echo "[qa] 2/5 Anonimizando datos personales…"
{
  printf "SELECT set_config('qa.password', '%s', false);\n" "${QA_PASSWORD//\'/\'\'}"
  cat database/qa/anonimizar.sql
} | psql_on "${TMP_DB}" >/dev/null

echo "[qa] 3/5 Exportando ${DUMP}…"
dc exec -T postgres pg_dump -U "$POSTGRES_USER" -d "${TMP_DB}" --format=custom --compress=9 --no-owner >"${DUMP}"

if $INCLUDE_FILES; then
  echo "[qa] 4/5 Empaquetando fotos y documentos (sin comprobantes PDF)…"
  psql_on "${TMP_DB}" -tA -c "SELECT storage_key FROM attachments ORDER BY storage_key;" >"backups/.qa-lista-${STAMP}.txt"
  if [ -s "backups/.qa-lista-${STAMP}.txt" ]; then
    dc exec -T backend sh -c 'cat > /tmp/qa-lista.txt' <"backups/.qa-lista-${STAMP}.txt"
    dc exec -T backend tar czf - -C /app/storage -T /tmp/qa-lista.txt >"${FILES_TAR}"
    dc exec -T backend rm -f /tmp/qa-lista.txt
  else
    echo "[qa]     No hay archivos adjuntos para exportar."
    INCLUDE_FILES=false
  fi
  rm -f "backups/.qa-lista-${STAMP}.txt"
else
  echo "[qa] 4/5 Archivos omitidos (--sin-archivos)."
fi

echo "[qa] 5/5 Usuarios de QA:"
{
  echo "PINTOTECH — Credenciales del ambiente de QA (${STAMP})"
  echo "Contraseña común: ${QA_PASSWORD}"
  echo "Cambiarla después del primer ingreso. No compartir por canales públicos."
  echo
  psql_on "${TMP_DB}" -tA -F ' | ' -c "SELECT role, email, full_name FROM users ORDER BY role, email;"
} | tee "${CREDENTIALS}"

echo
echo "[qa] Listo. Entregue a QA:"
echo "       ${DUMP} ($(du -h "${DUMP}" | cut -f1))"
$INCLUDE_FILES && echo "       ${FILES_TAR} ($(du -h "${FILES_TAR}" | cut -f1))"
echo "       ${CREDENTIALS}  (por un canal privado)"
echo "     QA restaura con: ./scripts/import-qa.sh ${DUMP}$($INCLUDE_FILES && echo " ${FILES_TAR}")"
