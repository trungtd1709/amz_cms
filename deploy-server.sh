#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-amz_cms}"
REMOTE_DIR="${REMOTE_DIR:-/home/amz_cms}"
NGINX_PORT="${NGINX_PORT:-8083}"
API_UPSTREAM="${API_UPSTREAM:-http://127.0.0.1:8080}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://103.199.17.186:${NGINX_PORT}}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-$PUBLIC_ORIGIN}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${REMOTE_DIR}/releases/${RELEASE_ID}"

cd "$(dirname "$0")"

find_node_bin() {
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  local node_dir
  while IFS= read -r node_dir; do
    if [ -x "${node_dir}/node" ] && [ -e "${node_dir}/npm" ] && PATH="${node_dir}:$PATH" npm -v >/dev/null 2>&1; then
      export PATH="${node_dir}:$PATH"
      break
    fi
  done < <(find /root/.nvm/versions/node -path '*/bin' -type d 2>/dev/null | sort -Vr)

  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found. Install Node.js/npm or add it to PATH." >&2
    exit 1
  fi
}

find_node_bin

echo "Building ${APP_NAME} with VITE_API_BASE_URL=${VITE_API_BASE_URL}"
npm ci
VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build

echo "Creating release ${RELEASE_DIR}"
mkdir -p "$RELEASE_DIR" "${REMOTE_DIR}/releases"
rsync -az --delete dist/ "${RELEASE_DIR}/"
chown -R root:root "$RELEASE_DIR"
find "$RELEASE_DIR" -type d -exec chmod 755 {} +
find "$RELEASE_DIR" -type f -exec chmod 644 {} +
ln -sfn "$RELEASE_DIR" "${REMOTE_DIR}/current"

NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"
BACKUP_TS="$(date +%Y%m%d%H%M%S)"

if [ -e "$NGINX_AVAILABLE" ]; then
  cp -a "$NGINX_AVAILABLE" "${NGINX_AVAILABLE}.bak.${BACKUP_TS}"
fi

if [ -e "$NGINX_ENABLED" ] && [ ! -L "$NGINX_ENABLED" ]; then
  cp -a "$NGINX_ENABLED" "${NGINX_ENABLED}.bak.${BACKUP_TS}"
  rm -f "$NGINX_ENABLED"
fi

cat > "$NGINX_AVAILABLE" <<NGINX
server {
    listen ${NGINX_PORT};
    listen [::]:${NGINX_PORT};
    server_name _;

    root ${REMOTE_DIR}/current;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass ${API_UPSTREAM}/api/;
        proxy_http_version 1.1;

        proxy_set_header Host \$http_host;
        proxy_set_header X-Forwarded-Host \$http_host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
NGINX

ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

find "${REMOTE_DIR}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | sort -r \
  | tail -n +"$((KEEP_RELEASES + 1))" \
  | while read -r old_release; do
      rm -rf "${REMOTE_DIR}/releases/${old_release}"
    done

for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 5 "http://127.0.0.1:${NGINX_PORT}/" >/dev/null; then
    break
  fi

  if [ "$attempt" -eq 5 ]; then
    echo "CMS health check failed on http://127.0.0.1:${NGINX_PORT}/" >&2
    exit 1
  fi

  sleep 1
done

if ! curl -fsS --max-time 5 "${API_UPSTREAM}/api/cms/reports/sp-advertised-products" >/dev/null 2>&1; then
  echo "Warning: API upstream ${API_UPSTREAM} did not respond successfully for /api/cms/reports/sp-advertised-products" >&2
fi

echo "Deployed ${APP_NAME}: ${PUBLIC_ORIGIN}"
