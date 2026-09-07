#!/bin/bash
set -u

STATE_DIR=/var/lib/cache-watchdog
FAIL_COUNT_FILE="$STATE_DIR/failcount"
ALERT_SENT_FILE="$STATE_DIR/alert-sent"
CHECK_URL="https://thebreaksurf.co.uk/construction"
MAX_FAILS=3
ENV_FILE=/home/cooper2n/Documents/thebreaksite/.env.production

mkdir -p "$STATE_DIR"
[ -f "$FAIL_COUNT_FILE" ] || echo 0 > "$FAIL_COUNT_FILE"

check_status() {
  curl -s -o /dev/null -D - -m 10 "$CHECK_URL" 2>/dev/null | grep -i "^cf-cache-status:" | tr -d '\r' | awk '{print $2}'
}

# A single MISS is normal (cold edge node, just-expired TTL) — only treat this
# as a problem if NEITHER of two quick checks comes back HIT.
status1=$(check_status)
status2=$(check_status)

if [ "$status1" = "HIT" ] || [ "$status2" = "HIT" ]; then
  echo 0 > "$FAIL_COUNT_FILE"
  rm -f "$ALERT_SENT_FILE"
  exit 0
fi

fails=$(cat "$FAIL_COUNT_FILE")
fails=$((fails + 1))
echo "$fails" > "$FAIL_COUNT_FILE"
logger -t cache-watchdog "Cloudflare cache not HIT (check $fails/$MAX_FAILS, statuses: '$status1' '$status2')"

if [ "$fails" -ge "$MAX_FAILS" ] && [ ! -f "$ALERT_SENT_FILE" ] && [ -f "$ENV_FILE" ]; then
  RESEND_API_KEY=$(grep -E "^RESEND_API_KEY=" "$ENV_FILE" | cut -d= -f2-)
  if [ -n "$RESEND_API_KEY" ]; then
    curl -s -m 5 -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"from\":\"The Break Surf <orders@thebreaksurf.co.uk>\",\"to\":\"nathan@thebreaksurf.co.uk\",\"subject\":\"Cloudflare cache appears to have stopped working\",\"text\":\"The public site has failed $fails consecutive checks for a Cloudflare cache HIT on $CHECK_URL. Visitors may currently be hitting your origin server directly on every request instead of being served from Cloudflare's edge. Check the Cache Rule in your Cloudflare dashboard (Rules > Cache Rules) to confirm it is still enabled and the zone is proxied (orange cloud).\"}" \
      >/dev/null 2>&1 || true
  fi
  touch "$ALERT_SENT_FILE"
fi
