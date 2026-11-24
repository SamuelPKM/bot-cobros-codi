#!/usr/bin/env bash
# Corre EN el servidor EC2 (como root). Baja la rama configurada, carga la
# configuración de SSM Parameter Store, construye las imágenes de la API y de
# la web y reemplaza los contenedores. Lo llaman el primer arranque, el
# servicio de systemd y deploy/aws/actualizar.sh.
#
#   desplegar.sh                baja código nuevo, construye y despliega
#   desplegar.sh --sin-codigo   construye y despliega lo que ya está bajado
#   desplegar.sh --reiniciar    solo recarga la configuración y reinicia
set -euo pipefail

BASE=/opt/cobrale
SRC="$BASE/src"
PREFIX=/cobrale
MODE="${1:-}"
if [[ -z "${AWS_DEFAULT_REGION:-}" ]]; then
  imds="$(curl -sS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
  AWS_DEFAULT_REGION="$(curl -sS -H "X-aws-ec2-metadata-token: $imds" http://169.254.169.254/latest/meta-data/placement/region)"
  export AWS_DEFAULT_REGION
fi

param() { aws ssm get-parameter --name "$PREFIX/$1" --with-decryption --query Parameter.Value --output text; }

# Escribe /opt/cobrale/<servicio>.env con los parámetros /cobrale/<servicio>/*.
env_file() {
  umask 077
  aws ssm get-parameters-by-path --path "$PREFIX/$1/" --with-decryption --recursive --output json \
    | python3 -c '
import json, sys
for p in sorted(json.load(sys.stdin)["Parameters"], key=lambda p: p["Name"]):
    name, value = p["Name"].rsplit("/", 1)[1], p["Value"]
    if "\n" in value:
        sys.exit(f"{name} tiene un salto de línea; corrígelo en Parameter Store")
    print(f"{name}={value}")
' > "$BASE/$1.env.tmp"
  mv "$BASE/$1.env.tmp" "$BASE/$1.env"
}

wait_healthy() {
  for _ in $(seq 1 60); do
    case "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" in
      healthy) return 0 ;;
      unhealthy) break ;;
    esac
    sleep 3
  done
  echo "$1 no quedó sano. Últimas líneas de su registro:" >&2
  docker logs --tail 40 "$1" >&2
  return 1
}

run_api() {
  docker rm -f cobrale-api >/dev/null 2>&1 || true
  docker run -d --name cobrale-api --network cobrale --restart unless-stopped \
    --env-file "$BASE/api.env" -e PORT=3000 \
    --log-opt max-size=10m --log-opt max-file=5 cobrale-api:latest >/dev/null
}

run_web() {
  docker rm -f cobrale-web >/dev/null 2>&1 || true
  docker run -d --name cobrale-web --network cobrale --restart unless-stopped \
    --env-file "$BASE/web.env" -e PORT=3001 \
    --log-opt max-size=10m --log-opt max-file=5 cobrale-web:latest >/dev/null
}

if [[ -z "$MODE" ]]; then
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

echo "==> Cargando la configuración de SSM"
env_file api
env_file web
site_domain="$(param infra/SITE_DOMAIN)"
api_domain="$(param infra/API_DOMAIN)"
docker network inspect cobrale >/dev/null 2>&1 || docker network create cobrale >/dev/null

if [[ "$MODE" != "--reiniciar" ]]; then
  echo "==> Construyendo la API"
  docker build -q -t cobrale-api:latest "$SRC/backend" >/dev/null
  # Construir la web pide ~1 GB de RAM. Con menos de 1.5 GB (t3.micro) se
  # detiene la web mientras tanto; la API y los webhooks siguen atendiendo.
  total_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
  if (( total_mb < 1500 )) && docker inspect cobrale-web >/dev/null 2>&1; then
    echo "==> Poca memoria ($total_mb MB): se detiene la web mientras se construye"
    docker stop cobrale-web >/dev/null
  fi
  echo "==> Construyendo la web"
  if ! docker build -q -t cobrale-web:latest "$SRC/front/web" >/dev/null; then
    # Si falla, vuelve la versión anterior: nada se queda apagado.
    docker start cobrale-web >/dev/null 2>&1 || true
    echo "No se pudo construir la web; sigue la versión anterior." >&2
    exit 1
  fi
fi

echo "==> Reiniciando la API (corre las migraciones pendientes)"
run_api
wait_healthy cobrale-api
echo "==> Reiniciando la web"
run_web
wait_healthy cobrale-web

# Caddy solo se recrea si cambió su configuración o los dominios, para no
# volver a pedir certificados en cada despliegue.
caddy_hash="$(sha256sum "$SRC/deploy/aws/servidor/Caddyfile" | cut -c1-16)-$site_domain-$api_domain"
current="$(docker inspect -f '{{ index .Config.Labels "cobrale.hash" }}' cobrale-caddy 2>/dev/null || true)"
if [[ "$current" != "$caddy_hash" ]]; then
  echo "==> Reiniciando Caddy para $site_domain y $api_domain"
  docker rm -f cobrale-caddy >/dev/null 2>&1 || true
  docker run -d --name cobrale-caddy --network cobrale --restart unless-stopped \
    -p 80:80 -p 443:443 -p 443:443/udp \
    -e SITE_DOMAIN="$site_domain" -e API_DOMAIN="$api_domain" --label cobrale.hash="$caddy_hash" \
    -v "$SRC/deploy/aws/servidor/Caddyfile:/etc/caddy/Caddyfile:ro" \
    -v cobrale-caddy-data:/data -v cobrale-caddy-config:/config \
    --log-opt max-size=10m --log-opt max-file=5 caddy:2.10-alpine >/dev/null
fi

docker image prune -f >/dev/null
echo "==> Listo: web https://$site_domain · API https://$api_domain"
