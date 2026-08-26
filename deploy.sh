#!/usr/bin/env bash
# Deploy mAI-school in one go (Chaibook-style: private Caddy + app + Docker Postgres behind Traefik).
#
# On the VPS:
#   ./deploy.sh
#
# From your laptop (rsync + SSH, then the same script on the server):
#   ./deploy.sh
#   DEPLOY_HOST=root@200.234.41.108 DEPLOY_DIR=/opt/shurbe-data/mAI-school ./deploy.sh
#
# Non-interactive:
#   MAISCHOOL_HOST=maischool.ayushdixit.work ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:-root@200.234.41.108}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/shurbe-data/mAI-school}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

prompt() {
  local var="$1" message="$2" default="${3:-}"
  local current=""
  eval "current=\"\${${var}-}\""
  if [[ -n "$current" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    return 1
  fi
  local reply
  if [[ -n "$default" ]]; then
    read -r -p "$message [$default]: " reply || true
    printf -v "$var" '%s' "${reply:-$default}"
  else
    read -r -p "$message: " reply || true
    printf -v "$var" '%s' "$reply"
  fi
}

env_get() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- || true
}

upsert_env() {
  local file="$1" key="$2" value="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]]; then
    KEY="$key" VAL="$value" awk '
      BEGIN { k=ENVIRON["KEY"]; v=ENVIRON["VAL"]; done=0 }
      $0 ~ "^#?" k "=" { if (!done) { print k "=" v; done=1 } next }
      { print }
      END { if (!done) print k "=" v }
    ' "$file" >"$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >"$tmp"
  fi
  mv "$tmp" "$file"
}

rand_secret() {
  local n="${1:-32}"
  if command -v openssl >/dev/null; then
    openssl rand -base64 48 | tr -d '\n=/+' | head -c "$n"
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$n"
  fi
}

is_blank() {
  local v="${1:-}"
  [[ -z "$v" || "$v" == "change-me" || "$v" == "change_me"* || "$v" == your_* ]]
}

# --- Laptop path: copy this folder to the VPS and run there ---
remote_deploy() {
  command -v rsync >/dev/null || die "rsync is required on the laptop."
  command -v ssh >/dev/null || die "ssh is required on the laptop."

  log "Syncing mAI-school → ${DEPLOY_HOST}:${DEPLOY_DIR}"
  ssh -o BatchMode=yes "$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR'"
  rsync -az --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude graphify-out \
    --exclude '**/node_modules/**' \
    --exclude '**/.next/**' \
    "$ROOT/" "${DEPLOY_HOST}:${DEPLOY_DIR}/"

  log "Running deploy on ${DEPLOY_HOST}"
  ssh -o BatchMode=yes "$DEPLOY_HOST" \
    "cd '$DEPLOY_DIR' && chmod +x deploy.sh && \
     MAISCHOOL_HOST='${MAISCHOOL_HOST:-}' \
     PUBLIC_API_URL='${PUBLIC_API_URL:-}' \
     GEMINI_API_KEY='${GEMINI_API_KEY:-}' \
     POSTGRES_PASSWORD='${POSTGRES_PASSWORD:-}' \
     JWT_SECRET='${JWT_SECRET:-}' \
     ./deploy.sh"
}

if [[ "$(uname -s)" != "Linux" ]]; then
  remote_deploy
  exit 0
fi

# --- VPS path ---
if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  die "Docker is not reachable. From the repo root run: ../setup.sh"
fi

compose() { "${DOCKER[@]}" compose "$@"; }

ensure_gateway() {
  if "${DOCKER[@]}" network inspect proxy >/dev/null 2>&1 \
    && "${DOCKER[@]}" ps --filter "label=com.docker.compose.project=gateway" \
         --filter "label=com.docker.compose.service=traefik" \
         --filter "status=running" --format '{{.Names}}' | grep -q .; then
    return 0
  fi
  local setup
  setup="$(cd "$ROOT/.." && pwd)/setup.sh"
  [[ -x "$setup" ]] || die "Traefik is not running and $setup is missing. Copy the repo to /opt/shurbe-data and run setup.sh."
  log "Traefik / proxy network missing — running ../setup.sh"
  "$setup"
}

ensure_env() {
  if [[ ! -f .env ]]; then
    [[ -f .env.example ]] || die "Missing .env.example."
    cp .env.example .env
    log "Created .env from .env.example."
  fi

  local pg_user pg_db
  pg_user="${POSTGRES_USER:-$(env_get .env POSTGRES_USER)}"
  pg_db="${POSTGRES_DB:-$(env_get .env POSTGRES_DB)}"
  POSTGRES_USER="${pg_user:-maischool}"
  POSTGRES_DB="${pg_db:-mai_school}"

  MAISCHOOL_HOST="${MAISCHOOL_HOST:-$(env_get .env MAISCHOOL_HOST)}"
  PUBLIC_API_URL="${PUBLIC_API_URL:-$(env_get .env PUBLIC_API_URL)}"
  CORS_ORIGINS="${CORS_ORIGINS:-$(env_get .env CORS_ORIGINS)}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(env_get .env POSTGRES_PASSWORD)}"
  JWT_SECRET="${JWT_SECRET:-$(env_get .env JWT_SECRET)}"
  MAI_GRAPHQL_DB_PASSWORD="${MAI_GRAPHQL_DB_PASSWORD:-$(env_get .env MAI_GRAPHQL_DB_PASSWORD)}"
  GEMINI_API_KEY="${GEMINI_API_KEY:-$(env_get .env GEMINI_API_KEY)}"
  SMTP_FROM="${SMTP_FROM:-$(env_get .env SMTP_FROM)}"

  if [[ "${PUBLIC_API_URL:-}" == http://localhost* ]]; then
    PUBLIC_API_URL=""
  fi

  prompt MAISCHOOL_HOST "Public hostname" "maischool.ayushdixit.work" || true
  if [[ -z "${PUBLIC_API_URL:-}" && -n "${MAISCHOOL_HOST:-}" ]]; then
    PUBLIC_API_URL="https://${MAISCHOOL_HOST}"
  fi
  prompt PUBLIC_API_URL "Public https URL" "${PUBLIC_API_URL:-https://maischool.ayushdixit.work}" || true

  [[ -n "${MAISCHOOL_HOST:-}" ]] || die "Set MAISCHOOL_HOST (e.g. maischool.ayushdixit.work)."
  [[ "${PUBLIC_API_URL:-}" == https://* ]] || die "Set PUBLIC_API_URL to the public https URL."

  if is_blank "${CORS_ORIGINS:-}" || [[ "${CORS_ORIGINS:-}" == *"localhost"* ]]; then
    CORS_ORIGINS="$PUBLIC_API_URL"
  fi

  if is_blank "${POSTGRES_PASSWORD:-}"; then
    prompt POSTGRES_PASSWORD "Postgres password (blank = generate)" || true
    if is_blank "${POSTGRES_PASSWORD:-}"; then
      POSTGRES_PASSWORD="$(rand_secret 24)"
      log "Generated POSTGRES_PASSWORD and wrote it to .env."
    fi
  fi

  if is_blank "${JWT_SECRET:-}" || [[ "${#JWT_SECRET}" -lt 32 ]]; then
    JWT_SECRET="$(rand_secret 48)"
    log "Generated JWT_SECRET and wrote it to .env."
  fi

  if is_blank "${MAI_GRAPHQL_DB_PASSWORD:-}"; then
    MAI_GRAPHQL_DB_PASSWORD="$(rand_secret 24)"
    log "Generated MAI_GRAPHQL_DB_PASSWORD and wrote it to .env."
  fi

  if is_blank "${GEMINI_API_KEY:-}"; then
    prompt GEMINI_API_KEY "GEMINI_API_KEY (optional, blank to skip AI)" || true
  fi

  if is_blank "${SMTP_FROM:-}" || [[ "${SMTP_FROM:-}" == *"noreply@maischool.ayushdixit.work"* ]]; then
    SMTP_FROM="mAI-school <noreply@${MAISCHOOL_HOST}>"
  fi

  upsert_env .env MAISCHOOL_HOST "$MAISCHOOL_HOST"
  upsert_env .env PUBLIC_API_URL "$PUBLIC_API_URL"
  upsert_env .env CORS_ORIGINS "$CORS_ORIGINS"
  upsert_env .env POSTGRES_USER "$POSTGRES_USER"
  upsert_env .env POSTGRES_DB "$POSTGRES_DB"
  upsert_env .env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  upsert_env .env DATABASE_URL "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5433/${POSTGRES_DB}"
  upsert_env .env JWT_SECRET "$JWT_SECRET"
  upsert_env .env MAI_GRAPHQL_DB_PASSWORD "$MAI_GRAPHQL_DB_PASSWORD"
  upsert_env .env REQUIRE_GRAPHQL_AUTH "1"
  upsert_env .env TRUST_PROXY "1"
  upsert_env .env SMTP_FROM "$SMTP_FROM"
  if [[ -n "${GEMINI_API_KEY:-}" ]] && ! is_blank "$GEMINI_API_KEY"; then
    upsert_env .env GEMINI_API_KEY "$GEMINI_API_KEY"
  fi

  [[ -z "$(env_get .env JWT_AUDIENCE)" ]] && upsert_env .env JWT_AUDIENCE "postgraphile"
  [[ -z "$(env_get .env JWT_ISSUER)" ]] && upsert_env .env JWT_ISSUER "mai-school"
  [[ -z "$(env_get .env MAI_GRAPHQL_DB_USER)" ]] && upsert_env .env MAI_GRAPHQL_DB_USER "mai_graphql"
}

wait_stack() {
  log "Waiting up to ${WAIT_TIMEOUT}s for db, server, client, and caddy."
  if compose --env-file .env -f docker-compose.yml up -d --wait --wait-timeout "$WAIT_TIMEOUT"; then
    return 0
  fi
  log "compose --wait failed; polling healthchecks."
  local deadline svc health
  deadline=$((SECONDS + WAIT_TIMEOUT))
  for svc in db server client; do
    while (( SECONDS < deadline )); do
      health="$(compose ps --format '{{.Health}}' "$svc" 2>/dev/null || true)"
      if [[ "$health" == healthy ]]; then
        log "$svc is healthy."
        break
      fi
      sleep 5
    done
    health="$(compose ps --format '{{.Health}}' "$svc" 2>/dev/null || true)"
    if [[ "$health" != healthy ]]; then
      compose logs --tail 80 "$svc" || true
      die "$svc did not become healthy in ${WAIT_TIMEOUT}s."
    fi
  done
}

verify() {
  log "Checking API health inside the server container."
  local body
  if ! body="$("${DOCKER[@]}" compose --env-file .env -f docker-compose.yml exec -T server \
    node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})")"; then
    compose logs --tail 80 server || true
    die "Server /api/health failed."
  fi
  printf '%s\n' "$body"
}

ensure_env
ensure_gateway

log "Building and starting mAI-school (first build can take several minutes)."
compose --env-file .env -f docker-compose.yml up -d --build --wait --wait-timeout "$WAIT_TIMEOUT" \
  || wait_stack
verify

log "mAI-school is up."
echo "Public URL: $PUBLIC_API_URL"
echo "Traefik routes Host($MAISCHOOL_HOST) → Caddy → Next.js / Express / Postgres."
echo "Health: $PUBLIC_API_URL/api/health"
echo "Institute logins: $PUBLIC_API_URL/i/{slug}/login"
echo "Postgres lives in the maischool_pg volume (this script does not wipe it)."
compose ps
