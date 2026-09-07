#!/bin/sh
set -e

# Named volumes keep their numeric ownership between image versions. An older
# image used a different Node user, so normalise every writable runtime mount
# before dropping privileges for the application process.
if [ "$(id -u)" = "0" ]; then
  for dir in /app/data /app/public/images/uploads /app/backups; do
    mkdir -p "$dir"
    chown -R nextjs:nodejs "$dir"
  done
  RUN_AS="su-exec nextjs:nodejs"
else
  RUN_AS=""
fi

# Persist one entry per actual host boot. Containers share the host kernel boot
# ID, so routine deploys and container restarts during the same boot are safely
# deduplicated while every Pi restart is retained in the data volume.
BOOT_EVENTS_FILE=/app/data/boot-events.log
BOOT_ID=$(cat /proc/sys/kernel/random/boot_id)
if ! grep -Fq "$(printf '\tboot\t%s' "$BOOT_ID")" "$BOOT_EVENTS_FILE" 2>/dev/null; then
  UPTIME_SECONDS=$(cut -d. -f1 /proc/uptime)
  BOOT_TIME=$(($(date +%s) - UPTIME_SECONDS))
  printf '%s\tboot\t%s\n' "$BOOT_TIME" "$BOOT_ID" >> "$BOOT_EVENTS_FILE"
fi
if [ "$(id -u)" = "0" ]; then
  chown nextjs:nodejs "$BOOT_EVENTS_FILE"
fi

# Start the Next.js server in the background so we can warm the cache once
# it's actually ready to answer requests.
$RUN_AS node server.js &
SERVER_PID=$!

# Wait for the server to come up (max ~30s), then trigger the safety-net
# revalidate. Every deploy re-bakes `/`, `/products`, `/writing`, `/events`
# with whatever's committed to git, not live data — this is what heals them
# automatically on every container start instead of relying on an admin
# edit to happen to touch each content type afterwards.
(
  for i in $(seq 1 30); do
    if wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/" 2>/dev/null; then
      wget -q -O /dev/null \
        --header="Authorization: Bearer ${CRON_SECRET}" \
        --post-data="" \
        "http://127.0.0.1:${PORT:-3000}/api/cron/warm-safety-net" 2>/dev/null || true
      break
    fi
    sleep 1
  done
) &

wait "$SERVER_PID"
