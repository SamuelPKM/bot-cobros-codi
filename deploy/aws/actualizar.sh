#!/usr/bin/env bash
# Despliega la última versión de la rama configurada (main por defecto): API y web.
# Se corre en CloudShell:  bash deploy/aws/actualizar.sh
# Para cambiar de rama:    BRANCH=otra-rama bash deploy/aws/actualizar.sh
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

if [[ -n "${BRANCH:-}" ]]; then
  aws ssm put-parameter --name "$PREFIX/infra/BRANCH" --value "$BRANCH" --type String --overwrite >/dev/null
  say "Rama cambiada a $BRANCH"
fi
say "Desplegando"
# Se copia el guion antes de correrlo, porque el despliegue lo reemplaza.
remote 'cp /opt/cobrale/src/deploy/aws/servidor/desplegar.sh /tmp/desplegar.sh && bash /tmp/desplegar.sh 2>&1'
api="https://$(aws ssm get-parameter --name "$PREFIX/infra/API_DOMAIN" --query Parameter.Value --output text)"
curl -fsS --max-time 10 "$api/health" >/dev/null && curl -fsS --max-time 10 -o /dev/null "$(site_url)/" && say "Responden: $(site_url) y $api"
