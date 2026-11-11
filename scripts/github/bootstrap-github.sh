#!/usr/bin/env bash
# =============================================================================
# bootstrap-github.sh — Configura GitHub para el equipo (ejecutar UNA vez, Erick):
#   - Labels, milestones e issues iniciales (desde issues.psv)
#   - Proyecto (GitHub Projects v2) con los issues agregados
#   - Rama develop
# Requisitos: gh CLI autenticado (gh auth login) con scopes repo y project.
# Uso:
#   export REPO=owner/pintotech JORGE_GH=login1 MIGUEL_GH=login2 ERICK_GH=login3
#   ./scripts/github/bootstrap-github.sh
# Idempotencia: labels/milestones se actualizan; los issues se omiten si ya
# existe uno con el mismo título.
# =============================================================================
set -euo pipefail

: "${REPO:?Defina REPO=owner/nombre}"
: "${JORGE_GH:?}" "${MIGUEL_GH:?}" "${ERICK_GH:?}"
OWNER="${REPO%%/*}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Labels"
while IFS='|' read -r name color desc; do
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force > /dev/null
  echo "  [OK] $name"
done <<'EOF'
backend|1d76db|API, servicios, BD, Mailgun
frontend|5319e7|Interfaz React
devops|0e8a16|Docker, CI/CD, infraestructura
bug|d73a4a|Algo no funciona
enhancement|a2eeef|Nueva funcionalidad
documentation|0075ca|Documentación
urgent|b60205|Prioridad máxima
qa|fbca04|Pruebas funcionales / UAT
dependencies|ededed|Actualización de dependencias
EOF

echo "== Milestones"
due() { date -u -d "$1" +%Y-%m-%dT23:59:59Z 2>/dev/null || date -u -v"$1" +%Y-%m-%dT23:59:59Z; }
create_milestone() {
  local title="$1" due_on="$2" description="$3"
  if gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' | grep -Fxq "$title"; then
    echo "  = $title (ya existe)"
  else
    gh api "repos/$REPO/milestones" -f title="$title" -f due_on="$due_on" -f description="$description" > /dev/null
    echo "  [OK] $title"
  fi
}
create_milestone "Sprint 0 - Fundaciones" "$(due '+7 days')" "Repositorio, Docker, CI, base backend/frontend, autenticación"
create_milestone "Sprint 1 - Recepción e ingreso" "$(due '+14 days')" "RF-01..RF-04: ingreso, recepción, comprobante y correo automático"
create_milestone "Sprint 2 - Seguimiento y cotización" "$(due '+21 days')" "RF-05, RF-06: estados, cotización y notificaciones manuales"
create_milestone "Sprint 3 - Registro técnico, entrega y consulta" "$(due '+28 days')" "RF-07..RF-09 + staging + UAT"
create_milestone "Sprint 4 - Calidad y release v1.0.0" "$(due '+35 days')" "Hardening, e2e, documentación y paso a producción"

echo "== Proyecto"
PROJECT_NUMBER="$(gh project list --owner "$OWNER" --format json --jq '.projects[] | select(.title=="PINTOTECH - Desarrollo") | .number' || true)"
if [ -z "$PROJECT_NUMBER" ]; then
  PROJECT_NUMBER="$(gh project create --owner "$OWNER" --title "PINTOTECH - Desarrollo" --format json --jq '.number')"
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" --name "Puntos" --data-type NUMBER > /dev/null
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" --name "Área" --data-type SINGLE_SELECT \
    --single-select-options "Backend,Frontend,DevOps,QA,Documentación" > /dev/null
  echo "  [OK] Proyecto #$PROJECT_NUMBER creado (configure columnas de Status manualmente: ver docs/07)"
else
  echo "  = Proyecto #$PROJECT_NUMBER ya existe"
fi
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$REPO" > /dev/null 2>&1 || true

echo "== Issues"
EXISTING="$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title')"
grep -v '^#' "$DIR/issues.psv" | while IFS='|' read -r key who milestone labels points title body; do
  [ -z "$key" ] && continue
  full_title="[$key] $title"
  if grep -Fxq "$full_title" <<< "$EXISTING"; then
    echo "  = $full_title"
    continue
  fi
  case "$who" in
    JORGE) assignee="$JORGE_GH" ;;
    MIGUEL) assignee="$MIGUEL_GH" ;;
    ERICK) assignee="$ERICK_GH" ;;
  esac
  url="$(gh issue create --repo "$REPO" --title "$full_title" \
    --body "$(printf '%b\n\n---\n**Estimación:** %s puntos · **Responsable:** @%s' "$body" "$points" "$assignee")" \
    --label "$labels" --milestone "$milestone" --assignee "$assignee")"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" > /dev/null
  echo "  [OK] $full_title -> $url"
done

echo "== Rama develop"
if ! gh api "repos/$REPO/branches/develop" > /dev/null 2>&1; then
  SHA="$(gh api "repos/$REPO/git/ref/heads/main" --jq '.object.sha')"
  gh api "repos/$REPO/git/refs" -f ref=refs/heads/develop -f sha="$SHA" > /dev/null
  echo "  [OK] develop creada desde main"
fi

echo
echo "Listo. Pasos manuales restantes (docs/07-guia-github-projects.md):"
echo "  1. Ajustar opciones del campo Status: Backlog, Ready, In Progress, Code Review, Testing, Done"
echo "  2. Crear vistas Board / Por responsable / Roadmap"
echo "  3. Proteger main y develop (Settings > Branches) y crear environments staging/production"
