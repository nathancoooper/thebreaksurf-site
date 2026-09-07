#!/bin/sh
set -e

echo "→ Pulling latest code…"
git pull

# Keep host-level diagnostics current when this account has passwordless sudo.
if sudo -n true >/dev/null 2>&1; then
  sudo install -m 0755 infra/connectivity-watchdog.sh /usr/local/bin/connectivity-watchdog.sh
fi

echo "→ Building new image…"
docker compose build

echo "→ Swapping container…"
docker compose up -d

echo "✓ Done. Check logs with: docker compose logs -f"
