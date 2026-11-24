#!/usr/bin/env bash
# Muestra el estado y los últimos registros de la app, de Caddy y del primer arranque.
#   bash deploy/aws/registros.sh [líneas]
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

lines="${1:-80}"
[[ "$lines" =~ ^[0-9]+$ ]] || die "las líneas deben ser un número"
remote "echo '--- contenedores'; docker ps -a --format '{{.Names}}\t{{.Status}}' 2>&1;
echo '--- app'; docker logs --tail $lines cobrale-app 2>&1;
echo '--- caddy'; docker logs --tail 30 cobrale-caddy 2>&1;
echo '--- primer arranque'; tail -n 30 /var/log/cloud-init-output.log 2>&1" || true
