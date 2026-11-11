#!/usr/bin/env bash
# =============================================================================
# dev-setup.sh — Prepara el entorno local de un desarrollador nuevo.
#   - Crea .env desde los ejemplos con secretos aleatorios
#   - Levanta PostgreSQL en Docker
#   - Instala dependencias, migra y crea el admin
# Uso: ./scripts/dev-setup.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

rand() { node -e "console.log(require('crypto').randomBytes(${1:-32}).toString('base64url'))"; }

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|<CAMBIAR-password-segura>|$(rand 18)|; s|<CAMBIAR-minimo-32-caracteres-aleatorios>|$(rand 48)|; s|<CAMBIAR-Clave2026>|Cambiar2026|" .env
  echo "[OK] .env creado"
fi
source "$(dirname "$0")/lib/load-env.sh"; load_env .env

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${POSTGRES_PASSWORD}|; s|^JWT_SECRET=.*|JWT_SECRET=$(rand 48)|" backend/.env
  echo "[OK] backend/.env creado"
fi
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env

docker compose up -d postgres
echo "Esperando PostgreSQL..."
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; do sleep 1; done

(cd backend && npm ci && npm run migrate && npm run seed)
(cd frontend && npm ci)

cat <<EOF

Entorno listo.
   Backend : cd backend && npm run start:dev     -> http://localhost:3000/api/docs
   Frontend: cd frontend && npm run dev          -> http://localhost:5173
   Usuario : ${ADMIN_EMAIL} / (ADMIN_PASSWORD de backend/.env)
EOF
