# =============================================================================
# Dockerfile del frontend (React + Vite) - multi-stage
#   build   -> compila la SPA estática
#   runtime -> Nginx sin privilegios sirviendo /dist y haciendo proxy a /api
# Contexto de build: carpeta frontend/
# =============================================================================
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
ARG VITE_API_URL=/api/v1
ARG VITE_APP_NAME=PINTOTECH
ENV VITE_API_URL=${VITE_API_URL} VITE_APP_NAME=${VITE_APP_NAME}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="pintotech-frontend" org.opencontainers.image.version="${APP_VERSION}"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/nginx-health || exit 1
