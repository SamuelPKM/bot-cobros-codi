#!/usr/bin/env bash
# Muestra el estado y los últimos registros de la API, la web, Caddy y el primer arranque.
#   bash deploy/aws/registros.sh [líneas]
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

lines="${1:-60}"
[[ "$lines" =~ ^[0-9]+$ ]] || die "las líneas deben ser un número"
remote "echo '--- contenedores'; docker ps -a --format '{{.Names}}\t{{.Status}}' 2>&1;
echo '--- memoria'; free -m 2>&1;
echo '--- api'; docker logs --tail $lines cobrale-api 2>&1;
echo '--- web'; docker logs --tail $lines cobrale-web 2>&1;
echo '--- caddy'; docker logs --tail 30 cobrale-caddy 2>&1;
echo '--- primer arranque'; tail -n 30 /var/log/cloud-init-output.log 2>&1" || true
