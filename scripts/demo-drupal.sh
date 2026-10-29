#!/usr/bin/env bash
# Starts a throwaway Drupal 11 with a generated component mounted, so it can be checked in a browser.
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

NAME="${1:?Uso: scripts/demo-drupal.sh <nombre> [carpeta_base]}"
BASE_DIR="${2:-web/modules/custom}"
PORT="${DEMO_PORT:-8080}"
IMAGE="${DRUPAL_IMAGE:-drupal:11-php8.3}"
CONTAINER="scaffold-demo"
MODULE_DIR="$(cd "$BASE_DIR/$NAME" 2>/dev/null && pwd)" \
  || fail "No existe $BASE_DIR/$NAME. Genéralo primero: make component name=$NAME"

step "Requisitos"
require_docker
require_command curl "Instálalo con el gestor de paquetes de tu sistema."
ok "Componente encontrado en $BASE_DIR/$NAME"

step "[1/3] Iniciando el contenedor $CONTAINER ($IMAGE) en el puerto $PORT"
# A previous demo is replaced, never stacked.
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -p "$PORT:80" \
  -v "$MODULE_DIR:/opt/drupal/web/modules/custom/$NAME:ro" "$IMAGE" >/dev/null \
  || fail "No se pudo iniciar el contenedor. Si el puerto $PORT está ocupado, usa otro: DEMO_PORT=8081 make demo name=$NAME"
ok "Contenedor en marcha; tu componente está montado en solo lectura"

step "[2/3] Instalando Drupal y habilitando $NAME (1–2 min la primera vez)"
docker exec "$CONTAINER" bash -c "
set -euo pipefail
cd /opt/drupal
composer require -q drush/drush

# Demo-only module: a route that renders the component. It is not part of the generated code.
mkdir -p web/modules/custom/scaffold_demo/src/Controller
cat > web/modules/custom/scaffold_demo/scaffold_demo.info.yml <<'YML'
name: 'Scaffold demo'
type: module
core_version_requirement: ^10.3 || ^11
YML
cat > web/modules/custom/scaffold_demo/scaffold_demo.routing.yml <<'YML'
scaffold_demo.page:
  path: '/scaffold-demo'
  defaults:
    _controller: '\Drupal\scaffold_demo\Controller\DemoController::page'
    _title: 'Demo del componente'
    component: '$NAME'
  requirements:
    _access: 'TRUE'
YML
cat > web/modules/custom/scaffold_demo/src/Controller/DemoController.php <<'PHP'
<?php

namespace Drupal\scaffold_demo\Controller;

final class DemoController {

  public function page(string \$component): array {
    return [
      '#theme' => \$component,
      '#title' => 'Hola desde ' . \$component,
      '#content' => 'Si este bloque tiene la clase --ready, el JS del componente se ejecutó.',
    ];
  }

}
PHP

vendor/bin/drush site:install standard --db-url=sqlite://localhost/sites/default/files/.ht.sqlite \
  --account-pass=admin -y -q
vendor/bin/drush pm:install $NAME scaffold_demo -y -q
# Serve CSS/JS as separate files so they are easy to spot in DevTools.
vendor/bin/drush config:set system.performance css.preprocess 0 -y -q
vendor/bin/drush config:set system.performance js.preprocess 0 -y -q
chown -R www-data:www-data web/sites/default/files
"
ok "Drupal instalado con los módulos $NAME y scaffold_demo"

step "[3/3] Comprobando la página de demo"
URL="http://localhost:$PORT/scaffold-demo"
CSS_CLASS="${NAME//_/-}"
html="$(curl -fsS "$URL")" || fail "La página $URL no responde. Revisa los logs: docker logs $CONTAINER"
expect() {
  if grep -q "$1" <<<"$html"; then ok "$2"; else fail "Falta: $2"; fi
}
expect "class=\"$CSS_CLASS\"" "HTML del componente presente"
expect "css/$NAME.css" "CSS del componente enlazado"
expect "js/$NAME.js" "JS del componente enlazado"

cat <<MSG

${GREEN}✔ Demo en marcha${RESET}
  Página:  $URL
           Inspecciona el bloque (F12): debe tener la clase "$CSS_CLASS--ready", que añade
           el JS al ejecutarse; en Network verás css/$NAME.css y js/$NAME.js.
  Admin:   http://localhost:$PORT/user/login  (admin / admin)

  Apagar:  make demo-stop  (borra el contenedor y todo lo creado dentro)
           Tras apagarla, una pestaña ya abierta puede seguir mostrando la página desde la
           caché del navegador; al recargar verás que el sitio ya no responde.
MSG
