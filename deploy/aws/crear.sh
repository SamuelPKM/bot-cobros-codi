#!/usr/bin/env bash
# Crea Cóbrale en AWS. Se corre UNA vez en AWS CloudShell (la terminal del
# navegador en la consola de AWS), desde una copia de este repositorio.
#
# Qué crea, todo con el nombre "cobrale":
#   - Parámetros cifrados en SSM Parameter Store (/cobrale/...): API key de pey,
#     DATABASE_URL de Neon, token de GitHub y el resto de la configuración.
#   - Un rol de IAM para la instancia: solo puede leer /cobrale/* y ser
#     administrada con Session Manager. Sin llaves SSH.
#   - Un grupo de seguridad con los puertos 80 y 443 abiertos (nada más).
#   - Una IP elástica, para que la URL no cambie.
#   - Una instancia EC2 (Amazon Linux 2023) con Docker, que baja el código,
#     construye la imagen y levanta la app detrás de Caddy (HTTPS automático).
#
# Uso:
#   bash deploy/aws/crear.sh
# Variables opcionales: REGION (us-east-1), INSTANCE_TYPE (t3.micro),
# BRANCH (main), REPO (SamuelPKM/bot-cobros-codi), DOMAIN (tu dominio; si no,
# se usa <ip>.sslip.io).
set -euo pipefail

REGION="${REGION:-us-east-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
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
ask PEY_API_KEY "API key de pey (portal.pey.mx > Desarrollador)"
ask DATABASE_URL "DATABASE_URL de Neon (conexión directa, sin -pooler)"
[[ "$DATABASE_URL" == postgres* ]] || die "DATABASE_URL debe empezar con postgresql://"
[[ "$DATABASE_URL" != *-pooler* ]] || die "esa cadena usa el pooler de Neon; copia la conexión directa"
ask GITHUB_TOKEN "Token de GitHub de solo lectura para $REPO"
ask PEY_WEBHOOK_SECRET "Secreto del webhook de pey (Enter si todavía no lo tienes)" opcional
read -rp "Correo de la cuenta del jurado (Enter para omitir): " DEMO_ACCOUNT_EMAIL
DEMO_ACCOUNT_PASSWORD=""
[[ -z "$DEMO_ACCOUNT_EMAIL" ]] || ask DEMO_ACCOUNT_PASSWORD "Contraseña de esa cuenta (10 caracteres o más)"
read -rp "Correos de confianza, separados por coma (Enter para omitir): " TRUSTED_EMAILS

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
echo "IP $EIP · URL https://$SITE_DOMAIN"
[[ -z "${DOMAIN:-}" ]] || echo "Recuerda: el registro A de $DOMAIN debe apuntar a $EIP antes de que Caddy pida el certificado."

say "Guardando la configuración en SSM ($PREFIX/...)"
put app/PEY_API_KEY "$PEY_API_KEY"
put app/DATABASE_URL "$DATABASE_URL"
put app/PEY_WEBHOOK_SECRET "$PEY_WEBHOOK_SECRET"
put app/DEMO_ACCOUNT_EMAIL "$DEMO_ACCOUNT_EMAIL" String
put app/DEMO_ACCOUNT_PASSWORD "$DEMO_ACCOUNT_PASSWORD"
put app/TRUSTED_EMAILS "$TRUSTED_EMAILS" String
put app/PUBLIC_BASE_URL "https://$SITE_DOMAIN" String
put app/DEMO_ENABLED true String
put app/DEMO_MAX_AMOUNT 1 String
put app/DEMO_MERCHANT_NAME "Negocio de prueba" String
# Llave para cifrar secretos de los negocios (la usa la versión con cuenta de
# pey propia). Se genera una vez y no se cambia.
aws ssm get-parameter --name "$PREFIX/app/SECRETS_KEY" >/dev/null 2>&1 || put app/SECRETS_KEY "$(openssl rand -base64 48 | tr -d '\n')"
put infra/GITHUB_TOKEN "$GITHUB_TOKEN"
put infra/REPO "$REPO" String
put infra/BRANCH "$BRANCH" String
put infra/SITE_DOMAIN "$SITE_DOMAIN" String
unset PEY_API_KEY DATABASE_URL GITHUB_TOKEN PEY_WEBHOOK_SECRET DEMO_ACCOUNT_PASSWORD

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

say "Instalando y arrancando (unos 5 minutos la primera vez)"
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "https://$SITE_DOMAIN/health" >/dev/null 2>&1; then
    say "Listo: https://$SITE_DOMAIN"
    cat <<FIN

Siguientes pasos:
  1. Abre https://$SITE_DOMAIN y revisa que cargue.
  2. En portal.pey.mx > Desarrollador, crea el webhook con la URL:
       https://$SITE_DOMAIN/webhooks/pey
     y guarda su secreto con:
       bash deploy/aws/variable.sh PEY_WEBHOOK_SECRET
  3. Para subir cambios de la rama $BRANCH:
       bash deploy/aws/actualizar.sh
FIN
    exit 0
  fi
  sleep 10
done
echo
echo "La app todavía no responde en https://$SITE_DOMAIN. Revisa el arranque con:"
echo "  bash deploy/aws/registros.sh"
exit 1
