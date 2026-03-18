#!/usr/bin/env bash
set -e

# Load .env from project root (two levels up from apps/web)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$PROJECT_ROOT/.env"
  set +a
fi

# Start Next.js dev server with custom port from WEB_PORT env variable
PORT=${WEB_PORT:-3333} next dev --port ${WEB_PORT:-3333}
