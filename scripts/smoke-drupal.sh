#!/usr/bin/env bash
# Generates a component and checks it installs and renders in a real Drupal 11 (Docker).
set -euo pipefail

IMAGE="${DRUPAL_IMAGE:-drupal:11-php8.3}"
NAME="smoke_component"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

node "$(dirname "$0")/../tools/scaffold/cli.mjs" "$NAME" --dir "$WORKDIR" >/dev/null

docker run --rm -v "$WORKDIR/$NAME:/opt/drupal/web/modules/custom/$NAME:ro" "$IMAGE" bash -c "
set -euo pipefail
cd /opt/drupal
composer require -q drush/drush
php -l web/modules/custom/$NAME/$NAME.module
vendor/bin/drush site:install minimal --db-url=sqlite://localhost/sites/default/files/.ht.sqlite -y -q
vendor/bin/drush pm:install $NAME -y
html=\$(vendor/bin/drush php:eval '\$b = [\"#theme\" => \"$NAME\", \"#title\" => \"Smoke\"]; echo \Drupal::service(\"renderer\")->renderInIsolation(\$b);')
echo \"\$html\"
grep -q 'class=\"smoke-component\"' <<<\"\$html\"
grep -q 'smoke-component__title\">Smoke' <<<\"\$html\"
echo 'OK: el componente se instala y renderiza en Drupal'
"
