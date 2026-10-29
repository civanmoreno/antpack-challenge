#!/usr/bin/env bash
# Starts a throwaway Drupal 11 with a generated component mounted, so it can be checked in a browser.
set -euo pipefail

NAME="${1:?Uso: scripts/demo-drupal.sh <nombre> [carpeta_base]}"
BASE_DIR="${2:-web/modules/custom}"
PORT="${DEMO_PORT:-8080}"
IMAGE="${DRUPAL_IMAGE:-drupal:11-php8.3}"
CONTAINER="scaffold-demo"
MODULE_DIR="$(cd "$BASE_DIR/$NAME" 2>/dev/null && pwd)" || {
  echo "✖ No existe $BASE_DIR/$NAME. Genéralo primero: make component name=$NAME" >&2
  exit 1
}

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -p "$PORT:80" \
  -v "$MODULE_DIR:/opt/drupal/web/modules/custom/$NAME:ro" "$IMAGE" >/dev/null

echo "Instalando Drupal en el contenedor $CONTAINER (1–2 min la primera vez)..."
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

URL="http://localhost:$PORT/scaffold-demo"
CSS_CLASS="${NAME//_/-}"
html="$(curl -fsS "$URL")"
expect() {
  if grep -q "$1" <<<"$html"; then echo "✔ $2"; else echo "✖ Falta: $2" >&2; exit 1; fi
}
expect "class=\"$CSS_CLASS\"" "HTML del componente presente"
expect "css/$NAME.css" "CSS del componente enlazado"
expect "js/$NAME.js" "JS del componente enlazado"

cat <<MSG

Abre $URL en el navegador e inspecciona el bloque (F12):
  • <div class="$CSS_CLASS $CSS_CLASS--ready">  → la clase --ready la añade el JS al ejecutarse
  • En la pestaña Network verás css/$NAME.css y js/$NAME.js
Admin: http://localhost:$PORT/user/login  (admin / admin)
Para apagarlo: make demo-stop
MSG
