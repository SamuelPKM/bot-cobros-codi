#!/bin/bash
# Cóbrale en un droplet de DigitalOcean (Ubuntu 24.04).
#
# Se pega completo en "User data" al crear el droplet. Al arrancar, el droplet:
#   1. instala Node.js 22, Caddy (HTTPS automático) y git;
#   2. crea el usuario `cobrale` y descarga el código de GitHub;
#   3. deja Cóbrale como servicio de systemd, detrás de Caddy, en
#      https://<ip-con-guiones>.sslip.io (o en DOMAIN, si lo llenas abajo).
#
# El servicio NO arranca hasta que configures los secretos con `sudo cobrale-config`
# desde la consola del droplet. Así la API key nunca va en este script.
#
# El avance queda en /var/log/cobrale-setup.log.

set -euo pipefail
exec > >(tee -a /var/log/cobrale-setup.log) 2>&1

# ------------------------------------------------------------- ajustes
REPO_HTTPS="https://github.com/SamuelPKM/bot-cobros-codi.git"
REPO_SSH="git@github.com:SamuelPKM/bot-cobros-codi.git"
BRANCH="main"
DOMAIN="" # vacío: se usa <ip>.sslip.io. Con dominio propio, apúntalo a la IP del droplet antes.
# ---------------------------------------------------------------------

echo "== Cóbrale: preparación $(date -Is)"

export DEBIAN_FRONTEND=noninteractive
APP_DIR=/opt/cobrale/app
DATA_DIR=/var/lib/cobrale
CONF_DIR=/etc/cobrale

# Memoria de intercambio: el droplet de 512 MB se queda corto durante `npm ci`.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update
apt-get install -y ca-certificates curl git gnupg ufw caddy

# Node.js 22 (el de Ubuntu 24.04 es muy viejo; Cóbrale usa node:sqlite).
if ! node -v 2>/dev/null | grep -q '^v2[2-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -y nodejs
fi
node -v

# Cortafuegos: solo SSH y web.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Usuario sin privilegios para el servicio.
id cobrale >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/cobrale --shell /usr/sbin/nologin cobrale
install -d -o cobrale -g cobrale -m 750 "$DATA_DIR"
install -d -o root -g cobrale -m 750 "$CONF_DIR"

# Llave de despliegue, por si el repositorio es privado: se agrega en GitHub
# (Settings > Deploy keys) con solo lectura. Si el repo es público no hace falta.
install -d -o cobrale -g cobrale -m 700 /opt/cobrale/.ssh
if [ ! -f /opt/cobrale/.ssh/id_ed25519 ]; then
  sudo -u cobrale ssh-keygen -q -t ed25519 -N '' -C "cobrale-droplet" -f /opt/cobrale/.ssh/id_ed25519
fi
ssh-keyscan -t ed25519 github.com > /opt/cobrale/.ssh/known_hosts 2>/dev/null || true
chown cobrale:cobrale /opt/cobrale/.ssh/known_hosts

# Dirección pública.
IP=$(curl -fsS http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
HOST=${DOMAIN:-${IP//./-}.sslip.io}
echo "$HOST" > "$CONF_DIR/host"
echo "$REPO_HTTPS" > "$CONF_DIR/repo_https"
echo "$REPO_SSH" > "$CONF_DIR/repo_ssh"
echo "$BRANCH" > "$CONF_DIR/branch"

# Caddy: HTTPS automático con Let's Encrypt y proxy al puerto 3000.
cat > /etc/caddy/Caddyfile <<EOF
$HOST {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable caddy
systemctl restart caddy

# Servicio de systemd. Solo arranca si ya existe el archivo de secretos.
cat > /etc/systemd/system/cobrale.service <<EOF
[Unit]
Description=Cóbrale
After=network-online.target
Wants=network-online.target
ConditionPathExists=$CONF_DIR/env

[Service]
User=cobrale
Group=cobrale
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONF_DIR/env
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cobrale

# ------------------------------------------------ comandos de operación

# cobrale-update: descarga la última versión, instala dependencias y reinicia.
cat > /usr/local/bin/cobrale-update <<'EOF'
#!/bin/bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo: sudo cobrale-update"; exit 1; }
APP_DIR=/opt/cobrale/app
BRANCH=$(cat /etc/cobrale/branch)
# GIT_TERMINAL_PROMPT=0: con el repo privado, git falla en vez de quedarse pidiendo usuario.
as_app() { sudo -u cobrale -H env GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -i /opt/cobrale/.ssh/id_ed25519 -o UserKnownHostsFile=/opt/cobrale/.ssh/known_hosts" "$@"; }

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Descargando el código..."
  if ! as_app git clone --depth 1 --branch "$BRANCH" "$(cat /etc/cobrale/repo_https)" "$APP_DIR" 2>/dev/null; then
    rm -rf "$APP_DIR"
    if ! as_app git clone --depth 1 --branch "$BRANCH" "$(cat /etc/cobrale/repo_ssh)" "$APP_DIR"; then
      rm -rf "$APP_DIR"
      echo
      echo "No pude descargar el repositorio: parece privado."
      echo "Agrega esta llave en GitHub > el repositorio > Settings > Deploy keys (solo lectura):"
      echo
      cat /opt/cobrale/.ssh/id_ed25519.pub
      echo
      echo "Y vuelve a correr: sudo cobrale-update"
      exit 1
    fi
  fi
else
  echo "Actualizando el código..."
  as_app git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  as_app git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

echo "Instalando dependencias..."
as_app bash -c "cd $APP_DIR && npm ci --omit=dev --no-audit --no-fund"
echo "Versión: $(as_app git -C "$APP_DIR" log --oneline -1)"

if [ -f /etc/cobrale/env ]; then
  systemctl restart cobrale
  sleep 3
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
    echo "Listo: Cóbrale está corriendo en https://$(cat /etc/cobrale/host)"
  else
    echo "Cóbrale no respondió. Revisa: sudo journalctl -u cobrale -n 50"
    exit 1
  fi
else
  echo "Código listo. Falta configurar los secretos: sudo cobrale-config"
fi
EOF

# cobrale-config: pide los secretos sin mostrarlos y escribe /etc/cobrale/env.
cat > /usr/local/bin/cobrale-config <<'EOF'
#!/bin/bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo: sudo cobrale-config"; exit 1; }
HOST=$(cat /etc/cobrale/host)
ENV_FILE=/etc/cobrale/env

current() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }

# Se usa como VAR=$(ask_secret ...): todo lo que se muestra va a stderr, y a
# stdout solo el valor, para que no se cuele nada más en el secreto.
ask_secret() {
  local name=$1 label=$2 value old
  old=$(current "$name")
  while true; do
    if [ -n "$old" ]; then
      read -r -s -p "$label (Enter para dejar el actual): " value; echo >&2
      value=${value:-$old}
    else
      read -r -s -p "$label: " value; echo >&2
    fi
    [ -n "$value" ] && break
    echo "Es obligatorio." >&2
  done
  printf '%s' "$value"
}

echo "Configuración de Cóbrale para https://$HOST"
echo "Lo que escribas no se muestra en pantalla."
echo
PEY_API_KEY=$(ask_secret PEY_API_KEY "API key de pey (sk_live_...)")
echo "Registra el webhook https://$HOST/webhooks/pey en portal.pey.mx y copia su secreto."
PEY_WEBHOOK_SECRET=$(ask_secret PEY_WEBHOOK_SECRET "Secreto del webhook (whsec_...)")
MAX=$(current DEMO_MAX_AMOUNT); MAX=${MAX:-1}
read -r -p "Monto máximo por cobro en la demo, en pesos [$MAX]: " input
MAX=${input:-$MAX}
NAME=$(current DEMO_MERCHANT_NAME); NAME=${NAME:-Negocio de prueba}
read -r -p "Nombre del negocio en la demo [$NAME]: " input
NAME=${input:-$NAME}

case "$PEY_WEBHOOK_SECRET" in whsec_*) ;; *) echo "Aviso: el secreto del webhook suele empezar con whsec_." ;; esac

umask 027
TMP=$(mktemp /etc/cobrale/env.XXXXXX)
{
  echo "PEY_API_KEY=$PEY_API_KEY"
  echo "PEY_WEBHOOK_SECRET=$PEY_WEBHOOK_SECRET"
  echo "PUBLIC_BASE_URL=https://$HOST"
  echo "DATABASE_FILE=/var/lib/cobrale/cobros.db"
  echo "PORT=3000"
  echo "TRUST_PROXY=true"
  echo "DEMO_ENABLED=true"
  echo "DEMO_MAX_AMOUNT=$MAX"
  echo "DEMO_MERCHANT_NAME=$NAME"
  # Conserva las variables de WhatsApp si ya estaban.
  [ -f "$ENV_FILE" ] && grep -E '^(WHATSAPP_[A-Z_]+|MERCHANTS)=' "$ENV_FILE" || true
} > "$TMP"
chown root:cobrale "$TMP"
chmod 640 "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Guardado en $ENV_FILE."

if [ -d /opt/cobrale/app/.git ]; then
  systemctl restart cobrale
  sleep 3
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
    echo "Listo: abre https://$HOST/demo"
  else
    echo "Cóbrale no respondió. Revisa: sudo journalctl -u cobrale -n 50"
    exit 1
  fi
else
  echo "Falta descargar el código: sudo cobrale-update"
fi
EOF

chmod 755 /usr/local/bin/cobrale-update /usr/local/bin/cobrale-config

# Primera descarga del código (si el repo es privado, avisa cómo seguir).
/usr/local/bin/cobrale-update || true

cat > /etc/motd <<EOF

  Cóbrale: https://$HOST
  sudo cobrale-config   configurar secretos (API key de pey, webhook)
  sudo cobrale-update   actualizar a la última versión de $BRANCH
  sudo journalctl -u cobrale -f   ver los registros

EOF

echo "== Cóbrale: preparación terminada $(date -Is). URL: https://$HOST"
