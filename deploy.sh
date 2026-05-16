#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-amz_cms}"
REMOTE_HOST="${REMOTE_HOST:-103.199.17.186}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/server_key}"
REMOTE_SOURCE_DIR="${REMOTE_SOURCE_DIR:-/home/amz_cms/source}"
REMOTE_DIR="${REMOTE_DIR:-/home/amz_cms}"
NGINX_PORT="${NGINX_PORT:-8083}"
API_UPSTREAM="${API_UPSTREAM:-http://127.0.0.1:8080}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://${REMOTE_HOST}:${NGINX_PORT}}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-$PUBLIC_ORIGIN}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RUN_REMOTE="${RUN_REMOTE:-1}"

SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command rsync
require_command ssh

if [ ! -f "$SSH_KEY" ]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "Syncing ${APP_NAME} source to ${SSH_TARGET}:${REMOTE_SOURCE_DIR}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '$REMOTE_SOURCE_DIR'"
rsync -az --delete --no-owner --no-group \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude 'dist/' \
  --exclude 'node_modules/' \
  -e "ssh -i ${SSH_KEY} -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new" \
  ./ "${SSH_TARGET}:${REMOTE_SOURCE_DIR}/"

if [ "$RUN_REMOTE" = "0" ]; then
  echo "Remote source synced. Skipped remote deploy because RUN_REMOTE=0."
  exit 0
fi

echo "Running remote deploy-server.sh"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s -- \
  "$REMOTE_SOURCE_DIR" "$APP_NAME" "$REMOTE_DIR" "$NGINX_PORT" "$API_UPSTREAM" "$PUBLIC_ORIGIN" "$VITE_API_BASE_URL" "$KEEP_RELEASES" <<'REMOTE'
set -euo pipefail

cd "$1"
export APP_NAME="$2"
export REMOTE_DIR="$3"
export NGINX_PORT="$4"
export API_UPSTREAM="$5"
export PUBLIC_ORIGIN="$6"
export VITE_API_BASE_URL="$7"
export KEEP_RELEASES="$8"

bash ./deploy-server.sh
REMOTE
