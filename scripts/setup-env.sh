#!/usr/bin/env bash
# Derives client/.env.local and mobile/.env from the single root .env.
# Usage: ./scripts/setup-env.sh

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_ENV="$ROOT_DIR/.env"

if [ ! -f "$ROOT_ENV" ]; then
  echo "Error: $ROOT_ENV not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# Helper: extract a var's value from root .env (ignores comments and blank lines)
get_var() {
  grep -E "^${1}=" "$ROOT_ENV" | head -1 | cut -d'=' -f2-
}

# --- client/.env.local ---
CLIENT_ENV="$ROOT_DIR/client/.env.local"
{
  echo "# Auto-generated from root .env — do not edit directly."
  echo "# Re-run: ./scripts/setup-env.sh"
  for var in NEXT_PUBLIC_API_URL NEXT_PUBLIC_ROOT_DOMAIN NEXT_PUBLIC_SITE_URL; do
    val="$(get_var "$var")"
    if [ -n "$val" ]; then
      echo "${var}=${val}"
    fi
  done
} > "$CLIENT_ENV"
echo "Wrote $CLIENT_ENV"

# --- mobile/.env ---
MOBILE_ENV="$ROOT_DIR/mobile/.env"
if [ -d "$ROOT_DIR/mobile" ]; then
  {
    echo "# Auto-generated from root .env — do not edit directly."
    echo "# Re-run: ./scripts/setup-env.sh"
    val="$(get_var EXPO_PUBLIC_API_URL)"
    if [ -n "$val" ]; then
      echo "EXPO_PUBLIC_API_URL=${val}"
    fi
  } > "$MOBILE_ENV"
  echo "Wrote $MOBILE_ENV"
fi
