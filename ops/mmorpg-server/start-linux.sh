#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and set both secrets first." >&2
  exit 1
fi
docker compose --env-file .env -f docker-compose.mmorpg.yml up -d --build
docker compose --env-file .env -f docker-compose.mmorpg.yml ps
