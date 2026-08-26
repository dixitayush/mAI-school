#!/usr/bin/env bash
# Deploy mAI-school behind the Traefik gateway (private Caddy + Next.js + API + Postgres).
# Prerequisite: repo-root ./setup.sh (Docker + Traefik) already ran.
# Usage:
#   ./deploy.sh
#   MAISCHOOL_HOST=maischool.ayushdixit.work GEMINI_API_KEY=... ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  die "Docker is not reachable. Run ../setup.sh on the VPS first."
fi

compose() { "${DOCKER[@]}" compose "$@"; }

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

if [[ ! -f .env ]]; then
  [[ -f .env.example ]] || die "Missing .env.example."
  cp .env.example .env
  log "Created .env from .env.example."
fi

MAISCHOOL_HOST="${MAISCHOOL_HOST:-$(env_get .env MAISCHOOL_HOST)}"
PUBLIC_API_URL="${PUBLIC_API_URL:-$(env_get .env PUBLIC_API_URL)}"
CORS_ORIGINS="${CORS_ORIGINS:-$(env_get .env CORS_ORIGINS)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(env_get .env POSTGRES_PASSWORD)}"
JWT_SECRET="${JWT_SECRET:-$(env_get .env JWT_SECRET)}"
MAI_GRAPHQL_DB_PASSWORD="${MAI_GRAPHQL_DB_PASSWORD:-$(env_get .env MAI_GRAPHQL_DB_PASSWORD)}"
GEMINI_API_KEY="${GEMINI_API_KEY:-$(env_get .env GEMINI_API_KEY)}"

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

if [[ -z "${CORS_ORIGINS:-}" || "$CORS_ORIGINS" == *"localhost"* ]]; then
  CORS_ORIGINS="$PUBLIC_API_URL"
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  if [[ -t 0 ]]; then
    prompt POSTGRES_PASSWORD "Postgres password (blank = generate)" || true
  fi
  if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    POSTGRES_PASSWORD="$(rand_secret 24)"
    log "Generated POSTGRES_PASSWORD and wrote it to .env."
  fi
fi

if [[ -z "${JWT_SECRET:-}" || "${#JWT_SECRET}" -lt 32 ]]; then
  JWT_SECRET="$(rand_secret 48)"
  log "Generated JWT_SECRET and wrote it to .env."
fi

if [[ -z "${MAI_GRAPHQL_DB_PASSWORD:-}" ]]; then
  MAI_GRAPHQL_DB_PASSWORD="$(rand_secret 24)"
  log "Generated MAI_GRAPHQL_DB_PASSWORD and wrote it to .env."
fi

if [[ -z "${GEMINI_API_KEY:-}" || "$GEMINI_API_KEY" == your_gemini* ]]; then
  prompt GEMINI_API_KEY "GEMINI_API_KEY (optional, blank to skip AI features)" || true
fi

upsert_env .env MAISCHOOL_HOST "$MAISCHOOL_HOST"
upsert_env .env PUBLIC_API_URL "$PUBLIC_API_URL"
upsert_env .env CORS_ORIGINS "$CORS_ORIGINS"
upsert_env .env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
upsert_env .env DATABASE_URL "postgres://${POSTGRES_USER:-maischool}:${POSTGRES_PASSWORD}@localhost:5433/${POSTGRES_DB:-mai_school}"
upsert_env .env JWT_SECRET "$JWT_SECRET"
upsert_env .env MAI_GRAPHQL_DB_PASSWORD "$MAI_GRAPHQL_DB_PASSWORD"
if [[ -n "${GEMINI_API_KEY:-}" && "$GEMINI_API_KEY" != your_gemini* ]]; then
  upsert_env .env GEMINI_API_KEY "$GEMINI_API_KEY"
fi

if ! "${DOCKER[@]}" network inspect proxy >/dev/null 2>&1; then
  die "Docker network 'proxy' is missing. From the repo root run: ./setup.sh"
fi

if ! "${DOCKER[@]}" ps --filter "label=com.docker.compose.project=gateway" \
      --filter "label=com.docker.compose.service=traefik" \
      --filter "status=running" --format '{{.Names}}' | grep -q .; then
  die "Traefik is not running. From the repo root run: ./setup.sh"
fi

log "Building and starting mAI-school (first build can take several minutes)."
compose --env-file .env -f docker-compose.yml up -d --build

log "mAI-school is up on the private network."
echo "Public URL: $PUBLIC_API_URL"
echo "Traefik routes Host($MAISCHOOL_HOST) → Caddy → Next.js / API."
echo "Health: $PUBLIC_API_URL/api/health"
echo "Institute logins: $PUBLIC_API_URL/i/{slug}/login"
echo "Postgres data is kept across deploys (this script does not wipe volumes)."
