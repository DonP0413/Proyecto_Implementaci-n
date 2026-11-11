# =============================================================================
# Dockerfile del backend (NestJS) - multi-stage
# Contexto de build: RAÍZ del repositorio (para incluir /database/migrations)
#   docker build -f backend/Dockerfile -t pintotech-backend .
# Etapas:
#   deps    -> instala dependencias completas (cacheable por package-lock)
#   build   -> compila TypeScript
#   prod-deps -> sólo dependencias de producción
#   runtime -> imagen final mínima, usuario no-root, healthcheck
# =============================================================================
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM deps AS build
COPY backend/ ./
RUN npm run build

FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi \
    && npm cache clean --force

FROM node:${NODE_VERSION} AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=3000 \
    MIGRATIONS_DIR=/app/database/migrations \
    STORAGE_LOCAL_PATH=/app/storage
WORKDIR /app

RUN apk add --no-cache tini wget \
    && mkdir -p /app/storage && chown -R node:node /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node database/migrations ./database/migrations
COPY --chown=node:node backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 3000
VOLUME ["/app/storage"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health/live || exit 1

LABEL org.opencontainers.image.title="pintotech-backend" \
      org.opencontainers.image.version="${APP_VERSION}"

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
