#!/usr/bin/env bash
# Checks a generated component against the Drupal and DrupalPractice coding standards (Docker).
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

NAME="${1:?Uso: scripts/phpcs-drupal.sh <nombre> [carpeta_base]}"
BASE_DIR="${2:-web/modules/custom}"
IMAGE="${DRUPAL_IMAGE:-drupal:11-php8.3}"
MODULE_DIR="$(cd "$BASE_DIR/$NAME" 2>/dev/null && pwd)" \
  || fail "No existe $BASE_DIR/$NAME. Genéralo primero: make component name=$NAME"

step "Requisitos"
require_docker
ok "Componente encontrado en $BASE_DIR/$NAME"

step "phpcs --standard=Drupal,DrupalPractice sobre $BASE_DIR/$NAME"
# The component is mounted read-only: this command reports, it never modifies your files.
set +e
output="$(docker run --rm -v "$MODULE_DIR:/opt/drupal/web/modules/custom/$NAME:ro" "$IMAGE" bash -c "
  set -euo pipefail
  cd /opt/drupal
  composer config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true
  composer require -q --dev drupal/coder >/dev/null 2>&1
  cd web/modules/custom/$NAME
  ../../../../vendor/bin/phpcs -v -s --standard=Drupal,DrupalPractice \
    --extensions=php,module,inc,install,theme,yml --report=full .
" 2>&1)"
status=$?
set -e

# -v lists every checked file; drop the rest of the verbose noise.
grep '^Processing' <<<"$output" \
  | sed -E 's/^Processing ([^ ]+) .*\((.*)\)$/  revisado: \1 (\2)/'
grep -vE '^(Processing|Registering|Creating|DONE|Changing|Time:)' <<<"$output" \
  | sed '/./,$!d' | sed "s|/opt/drupal/web/modules/custom/$NAME|$BASE_DIR/$NAME|; s/^/  /" || true

if [[ $status -eq 0 ]]; then
  ok "Sin errores ni advertencias: $NAME cumple los estándares Drupal"
else
  fail "$NAME no cumple los estándares Drupal: corrige las líneas indicadas arriba y vuelve a ejecutar make phpcs name=$NAME"
fi
