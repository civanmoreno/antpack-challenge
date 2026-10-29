#!/usr/bin/env bash
# Generates a component and checks, in a real Drupal 11 (Docker), that it follows the Drupal
# coding standards, installs and renders. Non-interactive so CI can run it; set KEEP=1 to leave
# the container running for inspection.
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

IMAGE="${DRUPAL_IMAGE:-drupal:11-php8.3}"
NAME="smoke_component"
CONTAINER="scaffold-smoke-$$"
KEEP="${KEEP:-0}"
WORKDIR="$(mktemp -d)"
SECONDS=0

cleanup() {
  rm -rf "$WORKDIR"
  if [[ "$KEEP" != 1 ]]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

step "Requisitos"
require_command node "Instala Node.js >= 20."
ok "Node $(node --version) disponible"
require_docker

step "[1/5] Generando el componente de prueba \"$NAME\""
node "$(dirname "$0")/../tools/scaffold/cli.mjs" "$NAME" --dir "$WORKDIR" \
  | grep -E '^(✔|  \+)' | sed "s|$WORKDIR/||; s/^/  /"

step "[2/5] Iniciando el contenedor $CONTAINER ($IMAGE)"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "  Descargando la imagen (solo la primera vez, puede tardar unos minutos)..."
  docker pull -q "$IMAGE" >/dev/null
fi
# The component is copied (not mounted) so KEEP=1 still works after $WORKDIR is removed.
docker run -d --name "$CONTAINER" "$IMAGE" >/dev/null
docker exec "$CONTAINER" mkdir -p web/modules/custom
docker cp -q "$WORKDIR/$NAME" "$CONTAINER:/opt/drupal/web/modules/custom/$NAME"
ok "Contenedor en marcha"
in_container() { docker exec "$CONTAINER" bash -c "set -euo pipefail; $1"; }
in_container "composer config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true
  composer require -q drush/drush && composer require -q --dev drupal/coder"
ok "Drush y drupal/coder instalados"

step "[3/5] Sintaxis PHP y estándares de código Drupal (phpcs)"
in_container "php -l web/modules/custom/$NAME/$NAME.module" | sed 's/^/  /'
# -v lists every checked file; on failure the full report is shown instead.
if ! phpcs_out="$(in_container "vendor/bin/phpcs -v --standard=Drupal,DrupalPractice \
  --extensions=php,module,inc,install,theme,yml web/modules/custom/$NAME 2>&1")"; then
  sed 's/^/  /' <<<"$phpcs_out"
  fail "phpcs encontró incumplimientos de los estándares Drupal (ver arriba)"
fi
grep '^Processing' <<<"$phpcs_out" | sed 's/^Processing /  revisado: /; s/ \[.*\]\.\.\. DONE in [0-9]*ms//'
ok "Sin errores ni advertencias de Drupal y DrupalPractice"

step "[4/5] Instalando Drupal y habilitando el módulo"
in_container "vendor/bin/drush site:install minimal \
  --db-url=sqlite://localhost/sites/default/files/.ht.sqlite -y -q
  vendor/bin/drush pm:install $NAME -y -q"
ok "Módulo $NAME instalado"

step "[5/5] Renderizando el componente y verificando el HTML"
html="$(in_container "vendor/bin/drush php:eval '\$b = [\"#theme\" => \"$NAME\", \"#title\" => \"Smoke\"];
  echo \Drupal::service(\"renderer\")->renderInIsolation(\$b);'")"
sed 's/^/  │ /' <<<"$html"
grep -q 'class="smoke-component"' <<<"$html" || fail "Falta la clase smoke-component en el HTML"
grep -q 'smoke-component__title">Smoke' <<<"$html" || fail "Falta el título renderizado"
ok "HTML esperado"

printf '\n%s✔ Smoke test OK en %ss%s\n' "$GREEN" "$SECONDS" "$RESET"
if [[ "$KEEP" == 1 ]]; then
  echo "  El contenedor $CONTAINER sigue en marcha. Entra con: docker exec -it $CONTAINER bash"
  echo "  Bórralo con: docker rm -f $CONTAINER"
else
  echo "  Contenedor $CONTAINER eliminado."
fi
echo "  Para ver un componente en el navegador: make component name=<nombre> && make demo name=<nombre>"
