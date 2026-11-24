#!/bin/bash
# User data de la instancia EC2: corre una sola vez, como root, en el primer
# arranque. Instala Docker, agrega memoria de intercambio, baja el código, deja
# el servicio de systemd y hace el primer despliegue.
set -euxo pipefail

dnf install -y docker git
systemctl enable --now docker

# 1 GB de intercambio: una t3.micro tiene 1 GB de RAM y construir la imagen lo necesita.
if [[ ! -f /swapfile ]]; then
  dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

imds_token="$(curl -sS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
AWS_DEFAULT_REGION="$(curl -sS -H "X-aws-ec2-metadata-token: $imds_token" http://169.254.169.254/latest/meta-data/placement/region)"
export AWS_DEFAULT_REGION

mkdir -p /opt/cobrale/src
git -C /opt/cobrale/src init -q

# Primera descarga, con reintentos por si IAM todavía no propagó el permiso.
fetched=no
for _ in 1 2 3 4 5 6; do
  if repo="$(aws ssm get-parameter --name /cobrale/infra/REPO --query Parameter.Value --output text)" &&
    branch="$(aws ssm get-parameter --name /cobrale/infra/BRANCH --query Parameter.Value --output text)" &&
    token="$(aws ssm get-parameter --name /cobrale/infra/GITHUB_TOKEN --with-decryption --query Parameter.Value --output text)" &&
    git -C /opt/cobrale/src fetch --depth 1 "https://x-access-token:${token}@github.com/${repo}.git" "$branch"; then
    fetched=yes
    break
  fi
  sleep 20
done
unset token
[[ "$fetched" == yes ]] || { echo "No se pudo bajar el código: revisa el token de GitHub en /cobrale/infra/GITHUB_TOKEN"; exit 1; }
git -C /opt/cobrale/src reset --hard FETCH_HEAD

# Al reiniciar la instancia, el servicio vuelve a levantar la app y Caddy.
cat > /etc/systemd/system/cobrale.service <<'UNIT'
[Unit]
Description=Cobrale (app y Caddy en Docker)
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash /opt/cobrale/src/deploy/aws/servidor/desplegar.sh --sin-codigo

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable cobrale.service

bash /opt/cobrale/src/deploy/aws/servidor/desplegar.sh --sin-codigo
