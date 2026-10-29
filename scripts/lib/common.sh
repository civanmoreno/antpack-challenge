# Shared helpers for the Docker-based scripts. Source it; do not execute it.

# Colors only on a terminal, so CI logs stay readable.
if [[ -t 1 ]]; then BOLD=$'\033[1m' GREEN=$'\033[32m' RED=$'\033[31m' RESET=$'\033[0m'
else BOLD='' GREEN='' RED='' RESET=''; fi

step() { printf '\n%s▶ %s%s\n' "$BOLD" "$*" "$RESET"; }
ok() { printf '  %s✔%s %s\n' "$GREEN" "$RESET" "$*"; }
fail() { printf '%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 no está instalado. $2"
}

require_docker() {
  require_command docker "Instálalo desde https://docs.docker.com/get-docker/ y vuelve a intentarlo."
  if ! docker info >/dev/null 2>&1; then
    fail "Docker está instalado pero no responde. Inicia el servicio (p. ej. 'sudo systemctl start docker' o abre Docker Desktop) y comprueba que tu usuario puede usarlo ('docker ps')."
  fi
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) disponible"
}
