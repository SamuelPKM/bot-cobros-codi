#!/usr/bin/env bash
# Borra TODO lo que creó crear.sh: instancia, base RDS (antes saca un respaldo
# final, cobrale-final-<fecha>, que se borra a mano en la consola de RDS),
# IP elástica, grupos de seguridad, rol de IAM y los parámetros /cobrale.
# No toca una base de Neon.
# Pide escribir "borrar cobrale" para confirmar.
set -euo pipefail
# shellcheck source=deploy/aws/comun.sh
source "$(dirname "$0")/comun.sh"

read -rp "Esto borra el servidor de Cóbrale en $REGION y su configuración. Escribe \"borrar cobrale\" para seguir: " ok
[[ "$ok" == "borrar cobrale" ]] || die "cancelado"

ids="$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" \
  "Name=instance-state-name,Values=pending,running,stopping,stopped" --query 'Reservations[].Instances[].InstanceId' --output text)"
if [[ -n "$ids" ]]; then
  say "Terminando $ids"
  # shellcheck disable=SC2086
  aws ec2 terminate-instances --instance-ids $ids >/dev/null
  # shellcheck disable=SC2086
  aws ec2 wait instance-terminated --instance-ids $ids
fi
if aws rds describe-db-instances --db-instance-identifier "$NAME" >/dev/null 2>&1; then
  snapshot="$NAME-final-$(date +%Y%m%d-%H%M)"
  say "Borrando la base RDS (respaldo final: $snapshot)"
  aws rds modify-db-instance --db-instance-identifier "$NAME" --no-deletion-protection --apply-immediately >/dev/null
  aws rds delete-db-instance --db-instance-identifier "$NAME" --final-db-snapshot-identifier "$snapshot" >/dev/null
  aws rds wait db-instance-deleted --db-instance-identifier "$NAME"
fi
db_sg="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$NAME-db" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$db_sg" != None && -n "$db_sg" ]]; then say "Borrando el grupo de seguridad de la base"; aws ec2 delete-security-group --group-id "$db_sg"; fi
alloc="$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$NAME" --query 'Addresses[0].AllocationId' --output text)"
if [[ "$alloc" != None && -n "$alloc" ]]; then say "Liberando la IP elástica"; aws ec2 release-address --allocation-id "$alloc"; fi
sg="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$NAME-web" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$sg" != None && -n "$sg" ]]; then say "Borrando el grupo de seguridad"; aws ec2 delete-security-group --group-id "$sg"; fi
logo_bucket="$NAME-logos-$(aws sts get-caller-identity --query Account --output text)"
if aws s3api head-bucket --bucket "$logo_bucket" >/dev/null 2>&1; then
  say "Borrando los logos y su bucket"
  aws s3 rm "s3://$logo_bucket" --recursive >/dev/null
  aws s3api delete-bucket --bucket "$logo_bucket"
fi
if aws iam get-instance-profile --instance-profile-name "$NAME-ec2" >/dev/null 2>&1; then
  say "Borrando el rol de IAM"
  aws iam remove-role-from-instance-profile --instance-profile-name "$NAME-ec2" --role-name "$NAME-ec2" || true
  aws iam delete-instance-profile --instance-profile-name "$NAME-ec2"
fi
if aws iam get-role --role-name "$NAME-ec2" >/dev/null 2>&1; then
  aws iam delete-role-policy --role-name "$NAME-ec2" --policy-name leer-configuracion || true
  aws iam delete-role-policy --role-name "$NAME-ec2" --policy-name logos || true
  aws iam detach-role-policy --role-name "$NAME-ec2" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore || true
  aws iam delete-role --role-name "$NAME-ec2"
fi
names="$(aws ssm get-parameters-by-path --path "$PREFIX" --recursive --query 'Parameters[].Name' --output text)"
if [[ -n "$names" ]]; then
  say "Borrando los parámetros de $PREFIX"
  # shellcheck disable=SC2086
  printf '%s\n' $names | xargs -n 10 aws ssm delete-parameters --names >/dev/null
fi
say "Listo. Si usabas Neon, esa base sigue intacta."
