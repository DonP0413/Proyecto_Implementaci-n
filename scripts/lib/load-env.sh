#!/usr/bin/env bash
# =============================================================================
# load-env.sh — Carga las variables de un archivo .env de forma SEGURA.
# `source .env` falla (o ejecuta código) con valores como
#   MAIL_FROM=PINTOTECH <no-reply@mg.dominio.com>
# porque bash interpreta `<` y `>`. Aquí cada línea VAR=valor se exporta
# literalmente, sin evaluarla. Ignora comentarios y líneas vacías.
# Uso:  source "$(dirname "$0")/lib/load-env.sh"; load_env .env
# =============================================================================
load_env() {
  local file="${1:-.env}" line key value
  [ -f "$file" ] || { echo "No se encontró $file" >&2; return 1; }
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    # Quita comillas envolventes si las hay ("valor" o 'valor').
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done <"$file"
}
