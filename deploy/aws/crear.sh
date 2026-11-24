#!/usr/bin/env bash
# Crea Cóbrale en AWS. Se corre UNA vez en AWS CloudShell (la terminal del
# navegador en la consola de AWS), desde una copia de este repositorio.
#
# Qué crea, todo con el nombre "cobrale":
#   - Parámetros cifrados en SSM Parameter Store (/cobrale/...): DATABASE_URL
#     de Neon, token de GitHub y llaves generadas (AUTH_SECRET, ENCRYPTION_KEY,
#     FRONT_PROXY_SECRET). No hay API key de pey: cada negocio registra la suya.
#   - Un rol de IAM para la instancia: solo puede leer /cobrale/* y ser
#     administrada con Session Manager. Sin llaves SSH.
#   - Un grupo de seguridad con los puertos 80 y 443 abiertos (nada más).
#   - Una IP elástica, para que la URL no cambie.
#   - Una instancia EC2 (Amazon Linux 2023) con Docker, que baja el código,
#     construye las imágenes de la API (backend/) y la web (front/web) y las
#     levanta detrás de Caddy, con HTTPS automático en dos dominios:
#       web  https://<ip>.sslip.io       API  https://api.<ip>.sslip.io
#
# Uso:
#   bash deploy/aws/crear.sh
# Variables opcionales: REGION (us-east-2, la de Neon), INSTANCE_TYPE
# (t3.small; t3.micro también sirve, pero cada actualización deja la web unos
# minutos sin servicio), BRANCH (main), REPO (SamuelPKM/bot-cobros-codi),
# DOMAIN (tu dominio para la web; la API queda en api.<DOMAIN>).
set -euo pipefail

REGION="${REGION:-us-east-2}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-SamuelPKM/bot-cobros-codi}"
NAME=cobrale
PREFIX=/cobrale
export AWS_DEFAULT_REGION="$REGION"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }

command -v aws >/dev/null || die "falta la AWS CLI (CloudShell ya la trae)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)" || die "no hay sesión de AWS"
say "Cuenta $ACCOUNT, región $REGION"

existing="$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" \
  "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text)"
[[ -z "$existing" ]] || die "ya existe la instancia $existing. Para subir cambios usa deploy/aws/actualizar.sh"

# ------------------------------------------------------------ secretos
say "Secretos (no se muestran al escribirlos; quedan cifrados en SSM)"
ask() { # ask VAR "pregunta" [opcional]
  local value
  read -rsp "$2: " value; echo
  [[ -n "$value" || "${3:-}" == opcional ]] || die "$1 es obligatorio"
  printf -v "$1" '%s' "$value"
}
ask DATABASE_URL "DATABASE_URL de Neon (conexión directa, sin -pooler)"
[[ "$DATABASE_URL" == postgres* ]] || die "DATABASE_URL debe empezar con postgresql://"
[[ "$DATABASE_URL" != *-pooler* ]] || die "esa cadena usa el pooler de Neon; copia la conexión directa"
ask GITHUB_TOKEN "Token de GitHub de solo lectura para $REPO"

put() { # put NOMBRE VALOR [SecureString|String]
  [[ -n "$2" ]] || return 0
  aws ssm put-parameter --name "$PREFIX/$1" --value "$2" --type "${3:-SecureString}" --overwrite >/dev/null
}

# ------------------------------------------------------------ IP elástica
say "IP elástica"
EIP_ALLOC="$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$NAME" --query 'Addresses[0].AllocationId' --output text)"
if [[ "$EIP_ALLOC" == None || -z "$EIP_ALLOC" ]]; then
  EIP_ALLOC="$(aws ec2 allocate-address --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" --query AllocationId --output text)"
fi
EIP="$(aws ec2 describe-addresses --allocation-ids "$EIP_ALLOC" --query 'Addresses[0].PublicIp' --output text)"
SITE_DOMAIN="${DOMAIN:-${EIP//./-}.sslip.io}"
API_DOMAIN="api.$SITE_DOMAIN"
echo "IP $EIP · web https://$SITE_DOMAIN · API https://$API_DOMAIN"
[[ -z "${DOMAIN:-}" ]] || echo "Recuerda: los registros A de $DOMAIN y $API_DOMAIN deben apuntar a $EIP antes de que Caddy pida los certificados."

say "Guardando la configuración en SSM ($PREFIX/...)"
# Llaves que se generan una sola vez. ENCRYPTION_KEY cifra las API keys de
# pey de los negocios: si cambia, ya no se pueden descifrar.
generate() { # generate NOMBRE COMANDO...
  aws ssm get-parameter --name "$PREFIX/$1" >/dev/null 2>&1 || put "$1" "$("${@:2}" | tr -d '\n')"
}
generate api/AUTH_SECRET openssl rand -base64 48
generate api/ENCRYPTION_KEY openssl rand -base64 32
generate api/FRONT_PROXY_SECRET openssl rand -hex 32
put web/FRONT_PROXY_SECRET "$(aws ssm get-parameter --name "$PREFIX/api/FRONT_PROXY_SECRET" --with-decryption --query Parameter.Value --output text)"

put api/DATABASE_URL "$DATABASE_URL"
put api/DATABASE_SSL true String
put api/PUBLIC_BASE_URL "https://$API_DOMAIN" String
put api/FRONTEND_URL "https://$SITE_DOMAIN" String
put api/TRUST_PROXY true String
put api/DEMO_MAX_AMOUNT 1 String
# La web llama a la API por la red interna de Docker, sin salir a internet.
put web/API_URL http://cobrale-api:3000 String
put infra/GITHUB_TOKEN "$GITHUB_TOKEN"
put infra/REPO "$REPO" String
put infra/BRANCH "$BRANCH" String
put infra/SITE_DOMAIN "$SITE_DOMAIN" String
put infra/API_DOMAIN "$API_DOMAIN" String
unset DATABASE_URL GITHUB_TOKEN

# ------------------------------------------------------------ IAM
say "Rol de IAM para la instancia"
if ! aws iam get-role --role-name "$NAME-ec2" >/dev/null 2>&1; then
  aws iam create-role --role-name "$NAME-ec2" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$NAME-ec2" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
fi
aws iam put-role-policy --role-name "$NAME-ec2" --policy-name leer-configuracion --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": [\"ssm:GetParameter\", \"ssm:GetParameters\", \"ssm:GetParametersByPath\"],
    \"Resource\": [\"arn:aws:ssm:$REGION:$ACCOUNT:parameter$PREFIX\", \"arn:aws:ssm:$REGION:$ACCOUNT:parameter$PREFIX/*\"]
  }]
}"
if ! aws iam get-instance-profile --instance-profile-name "$NAME-ec2" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$NAME-ec2" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$NAME-ec2" --role-name "$NAME-ec2"
  echo "Esperando a que IAM propague el perfil..."
  sleep 15
fi

# ------------------------------------------------------------ red
say "Grupo de seguridad (solo 80 y 443)"
VPC="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
[[ "$VPC" != None ]] || die "la región no tiene VPC por defecto; créala en la consola (VPC > Create default VPC)"
SG="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$NAME-web" "Name=vpc-id,Values=$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "$SG" == None || -z "$SG" ]]; then
  SG="$(aws ec2 create-security-group --group-name "$NAME-web" --description "Cobrale: HTTP y HTTPS" --vpc-id "$VPC" \
    --query GroupId --output text)"
  aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
    'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]' \
    'IpProtocol=udp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]' >/dev/null
fi

# ------------------------------------------------------------ instancia
say "Instancia $INSTANCE_TYPE (Amazon Linux 2023)"
AMI="$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)"

USER_DATA="$(cat "$(dirname "$0")/servidor/primer-arranque.sh")"

INSTANCE="$(aws ec2 run-instances --image-id "$AMI" --instance-type "$INSTANCE_TYPE" \
  --iam-instance-profile "Name=$NAME-ec2" --security-group-ids "$SG" \
  --metadata-options HttpTokens=required,HttpEndpoint=enabled \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=16,VolumeType=gp3,Encrypted=true}' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
  --user-data "$USER_DATA" --query 'Instances[0].InstanceId' --output text)"
echo "Instancia $INSTANCE"
aws ec2 wait instance-running --instance-ids "$INSTANCE"
aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$EIP_ALLOC" >/dev/null

say "Instalando y arrancando (de 5 a 10 minutos la primera vez)"
for _ in $(seq 1 90); do
  if curl -fsS --max-time 5 "https://$API_DOMAIN/health" >/dev/null 2>&1 &&
    curl -fsS --max-time 5 -o /dev/null "https://$SITE_DOMAIN/"; then
    say "Listo: https://$SITE_DOMAIN"
    cat <<FIN

Siguientes pasos:
  1. Abre https://$SITE_DOMAIN y registra el negocio del equipo con su
     API key de pey (portal.pey.mx > Desarrollador).
  2. En pey, en esa API key, crea el webhook con la URL que muestra
     Ajustes (https://$API_DOMAIN/webhooks/pey/...) y pega su secreto en Ajustes.
  3. Para activar la demo pública, guarda el id de ese negocio:
       bash deploy/aws/variable.sh api DEMO_BUSINESS_ID --visible
  4. Para subir cambios de la rama $BRANCH:
       bash deploy/aws/actualizar.sh
FIN
    exit 0
  fi
  sleep 10
done
echo
echo "Cóbrale todavía no responde en https://$SITE_DOMAIN. Revisa el arranque con:"
echo "  bash deploy/aws/registros.sh"
exit 1
