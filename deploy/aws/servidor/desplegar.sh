#!/usr/bin/env bash
# Corre EN el servidor EC2 (como root). Baja la versión de la rama configurada,
# carga la configuración de SSM Parameter Store, construye la imagen y
# reemplaza los contenedores. Lo llaman el arranque, el servicio de systemd y
# deploy/aws/actualizar.sh.
#
#   desplegar.sh            baja código nuevo y despliega
#   desplegar.sh --sin-codigo   solo recarga la configuración y reinicia
set -euo pipefail

BASE=/opt/cobrale
SRC="$BASE/src"
ENV_FILE="$BASE/app.env"
PREFIX=/cobrale
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$(TOKEN=$(curl -sS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60') && curl -sS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)}"

param() { aws ssm get-parameter --name "$PREFIX/$1" --with-decryption --query Parameter.Value --output text; }

if [[ "${1:-}" != "--sin-codigo" ]]; then
  repo="$(param infra/REPO)"
  branch="$(param infra/BRANCH)"
  token="$(param infra/GITHUB_TOKEN)"
  echo "==> Bajando $repo ($branch)"
  # El token no se guarda en .git/config: se usa solo para esta descarga.
  git -C "$SRC" fetch --depth 1 "https://x-access-token:${token}@github.com/${repo}.git" "$branch"
  git -C "$SRC" reset --hard FETCH_HEAD
  unset token
fi
echo "==> Versión: $(git -C "$SRC" log -1 --format='%h %s')"

echo "==> Cargando la configuración de SSM ($PREFIX/app/)"
umask 077
aws ssm get-parameters-by-path --path "$PREFIX/app/" --with-decryption --recursive --output json \
  | python3 -c '
import json, sys
params = json.load(sys.stdin)["Parameters"]
for p in sorted(params, key=lambda p: p["Name"]):
    name = p["Name"].rsplit("/", 1)[1]
    value = p["Value"]
    if "\n" in value:
        sys.exit(f"{name} tiene un salto de línea; corrígelo en Parameter Store")
    print(f"{name}={value}")
' > "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
site_domain="$(param infra/SITE_DOMAIN)"

echo "==> Construyendo la imagen"
docker build -q -t cobrale:latest "$SRC" >/dev/null

docker network inspect cobrale >/dev/null 2>&1 || docker network create cobrale >/dev/null

echo "==> Reiniciando la app"
docker rm -f cobrale-app >/dev/null 2>&1 || true
docker run -d --name cobrale-app --network cobrale --restart unless-stopped \
  --env-file "$ENV_FILE" -e PORT=3000 -e TRUST_PROXY=true \
  --log-opt max-size=10m --log-opt max-file=5 \
  cobrale:latest >/dev/null

# Caddy solo se recrea si cambió su configuración o el dominio, para no
# volver a pedir certificados en cada despliegue.
caddy_hash="$(sha256sum "$SRC/deploy/aws/servidor/Caddyfile" | cut -c1-16)-$site_domain"
current="$(docker inspect -f '{{ index .Config.Labels "cobrale.hash" }}' cobrale-caddy 2>/dev/null || true)"
if [[ "$current" != "$caddy_hash" ]]; then
  echo "==> Reiniciando Caddy para $site_domain"
  docker rm -f cobrale-caddy >/dev/null 2>&1 || true
  docker run -d --name cobrale-caddy --network cobrale --restart unless-stopped \
    -p 80:80 -p 443:443 -p 443:443/udp \
    -e SITE_DOMAIN="$site_domain" --label cobrale.hash="$caddy_hash" \
    -v "$SRC/deploy/aws/servidor/Caddyfile:/etc/caddy/Caddyfile:ro" \
    -v cobrale-caddy-data:/data -v cobrale-caddy-config:/config \
    --log-opt max-size=10m --log-opt max-file=5 \
    caddy:2.10-alpine >/dev/null
fi

echo "==> Esperando a que la app responda"
for _ in $(seq 1 30); do
  if [[ "$(docker inspect -f '{{.State.Health.Status}}' cobrale-app)" == healthy ]]; then
    echo "==> Listo: https://$site_domain"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done
echo "La app no quedó sana. Últimas líneas del registro:" >&2
docker logs --tail 40 cobrale-app >&2
exit 1
