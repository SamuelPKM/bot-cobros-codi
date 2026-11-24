#!/usr/bin/env bash
# Cambia una variable de la API o de la web y las reinicia para que la tomen.
# Los valores secretos se piden sin mostrarlos.
#
#   bash deploy/aws/variable.sh api DEMO_BUSINESS_ID --visible
#   bash deploy/aws/variable.sh api WHATSAPP_TOKEN
#   bash deploy/aws/variable.sh api CORS_ORIGINS --borrar
#   bash deploy/aws/variable.sh GITHUB_TOKEN          (token para bajar el código)
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

USAGE="uso: bash deploy/aws/variable.sh api|web NOMBRE [--visible|--borrar]"

# El token de GitHub no es de la app: solo se usa al bajar el código.
if [[ "${1:-}" == GITHUB_TOKEN ]]; then
  read -rsp "Token de GitHub nuevo (no se muestra): " value; echo
  [[ -n "$value" ]] || die "el token está vacío"
  aws ssm put-parameter --name "$PREFIX/infra/GITHUB_TOKEN" --value "$value" --type SecureString --overwrite >/dev/null
  unset value
  say "Token guardado. Se usa en el siguiente actualizar.sh"
  exit 0
fi

service="${1:-}"
var="${2:-}"
[[ "$service" == api || "$service" == web ]] || die "$USAGE"
[[ "$var" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "$USAGE"
case "$var" in
  ENCRYPTION_KEY) die "ENCRYPTION_KEY no se cambia: las API keys de pey guardadas dejarían de poder descifrarse" ;;
  FRONT_PROXY_SECRET) die "FRONT_PROXY_SECRET se genera al crear el servidor y debe ser igual en la API y en la web" ;;
esac

name="$PREFIX/$service/$var"
case "${3:-}" in
  --borrar)
    aws ssm delete-parameter --name "$name" ;;
  --visible)
    read -rp "Valor de $var: " value
    aws ssm put-parameter --name "$name" --value "$value" --type String --overwrite >/dev/null ;;
  "")
    read -rsp "Valor de $var (no se muestra): " value; echo
    [[ -n "$value" ]] || die "el valor está vacío; para quitarla usa --borrar"
    aws ssm put-parameter --name "$name" --value "$value" --type SecureString --overwrite >/dev/null ;;
  *) die "$USAGE" ;;
esac
unset value
say "Reiniciando la API y la web con la configuración nueva"
remote 'bash /opt/cobrale/src/deploy/aws/servidor/desplegar.sh --reiniciar 2>&1'
