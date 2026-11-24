# shellcheck shell=bash
# Funciones que comparten los guiones de deploy/aws (se cargan con `source`).
# Hablan con la instancia por SSM Run Command: no hace falta SSH.

REGION="${REGION:-us-east-1}"
NAME=cobrale
PREFIX=/cobrale
export AWS_DEFAULT_REGION="$REGION"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }

instance_id() {
  local id
  id="$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)"
  [[ -n "$id" && "$id" != None ]] || die "no hay una instancia \"$NAME\" encendida en $REGION"
  echo "$id"
}

# Corre un comando como root en la instancia y muestra lo que imprimió.
remote() {
  local id cmd_id status
  id="$(instance_id)"
  cmd_id="$(aws ssm send-command --instance-ids "$id" --document-name AWS-RunShellScript \
    --comment "cobrale" --parameters "$(python3 -c 'import json, sys; print(json.dumps({"commands": [sys.argv[1]], "executionTimeout": ["1800"]}))' "$1")" \
    --query Command.CommandId --output text)"
  aws ssm wait command-executed --command-id "$cmd_id" --instance-id "$id" 2>/dev/null || true
  status="$(aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$id" --query Status --output text)"
  aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$id" --query StandardOutputContent --output text
  if [[ "$status" != Success ]]; then
    aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$id" --query StandardErrorContent --output text >&2
    die "el comando terminó con estado $status"
  fi
}

site_url() {
  echo "https://$(aws ssm get-parameter --name "$PREFIX/infra/SITE_DOMAIN" --query Parameter.Value --output text)"
}
