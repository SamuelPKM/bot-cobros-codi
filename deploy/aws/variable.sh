#!/usr/bin/env bash
# Cambia una variable de la app (por ejemplo el secreto del webhook de pey) y
# reinicia la app para que la tome. Los valores se piden sin mostrarlos.
#
#   bash deploy/aws/variable.sh PEY_WEBHOOK_SECRET
#   bash deploy/aws/variable.sh DEMO_MAX_AMOUNT --visible
#   bash deploy/aws/variable.sh TRUSTED_EMAILS --borrar
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

var="${1:-}"
[[ "$var" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "uso: bash deploy/aws/variable.sh NOMBRE [--visible|--borrar]"

# El token de GitHub no es de la app: solo se usa al bajar el código.
if [[ "$var" == GITHUB_TOKEN ]]; then
  read -rsp "Token de GitHub nuevo (no se muestra): " value; echo
  [[ -n "$value" ]] || die "el token está vacío"
  aws ssm put-parameter --name "$PREFIX/infra/GITHUB_TOKEN" --value "$value" --type SecureString --overwrite >/dev/null
  unset value
  say "Token guardado. Se usa en el siguiente actualizar.sh"
  exit 0
fi
case "${2:-}" in
  --borrar)
    aws ssm delete-parameter --name "$PREFIX/app/$var" ;;
  --visible)
    read -rp "Valor de $var: " value
    aws ssm put-parameter --name "$PREFIX/app/$var" --value "$value" --type String --overwrite >/dev/null ;;
  *)
    read -rsp "Valor de $var (no se muestra): " value; echo
    [[ -n "$value" ]] || die "el valor está vacío; para quitarla usa --borrar"
    aws ssm put-parameter --name "$PREFIX/app/$var" --value "$value" --type SecureString --overwrite >/dev/null ;;
esac
unset value
say "Reiniciando la app con la configuración nueva"
remote 'bash /opt/cobrale/src/deploy/aws/servidor/desplegar.sh --sin-codigo 2>&1'
