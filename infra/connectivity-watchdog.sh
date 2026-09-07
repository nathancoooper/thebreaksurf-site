#!/bin/bash
set -u

STATE_DIR=/var/lib/connectivity-watchdog
FAIL_COUNT_FILE="$STATE_DIR/failcount"
LAST_REBOOT_FILE="$STATE_DIR/last-reboot"
REBOOT_LOG_FILE="$STATE_DIR/reboots.log"
RECOVERY_LOG_FILE="$STATE_DIR/recoveries.log"
ALERT_SENT_FILE="$STATE_DIR/alert-sent"
CHECK_TARGETS=("1.1.1.1" "8.8.8.8")
MAX_FAILS=5
REBOOT_COOLDOWN=1800
ENV_FILE=/home/cooper2n/Documents/thebreaksite/.env.production
WIFI_CONNECTION="The Mothership"
TUNNEL_CONTAINER="thebreaksite-cloudflared-1"
LOCAL_HEALTH_URL="http://127.0.0.1:3000/api/maintenance-status"
PUBLIC_HEALTH_URL="https://finance.thebreaksurf.co.uk/api/maintenance-status"

mkdir -p "$STATE_DIR"
[ -f "$FAIL_COUNT_FILE" ] || echo 0 > "$FAIL_COUNT_FILE"

online() {
  for target in "${CHECK_TARGETS[@]}"; do
    if ping -c1 -W3 "$target" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

record_recovery() {
  printf '%s\t%s\n' "$(date +%s)" "$1" >> "$RECOVERY_LOG_FILE"
}

restart_tunnel() {
  logger -t connectivity-watchdog "restarting Cloudflare tunnel container"
  record_recovery "cloudflared-restart"
  docker restart "$TUNNEL_CONTAINER" >/dev/null 2>&1 || true
}

recover_wifi() {
  logger -t connectivity-watchdog "attempting Wi-Fi recovery before reboot"
  record_recovery "wifi-reconnect"
  nmcli device disconnect wlan0 >/dev/null 2>&1 || true
  sleep 3
  nmcli connection up "$WIFI_CONNECTION" ifname wlan0 >/dev/null 2>&1 || true
  sleep 12
  restart_tunnel
}

if online; then
  echo 0 > "$FAIL_COUNT_FILE"
  rm -f "$ALERT_SENT_FILE"
  # The origin can be healthy while the connector is stuck after a network
  # interruption. Repair just the tunnel instead of rebooting the Pi.
  if curl -fsS -m 5 "$LOCAL_HEALTH_URL" >/dev/null 2>&1 \
    && ! curl -fsS -m 10 "$PUBLIC_HEALTH_URL" >/dev/null 2>&1; then
    restart_tunnel
  fi
  exit 0
fi

fails=$(cat "$FAIL_COUNT_FILE")
fails=$((fails + 1))
echo "$fails" > "$FAIL_COUNT_FILE"
logger -t connectivity-watchdog "internet unreachable (check $fails/$MAX_FAILS)"

if [ "$fails" -eq 2 ]; then
  recover_wifi
  if online; then
    logger -t connectivity-watchdog "connectivity restored without reboot"
    echo 0 > "$FAIL_COUNT_FILE"
    rm -f "$ALERT_SENT_FILE"
    exit 0
  fi
fi

if [ "$fails" -eq 2 ] && [ ! -f "$ALERT_SENT_FILE" ] && [ -f "$ENV_FILE" ]; then
  RESEND_API_KEY=$(grep -E "^RESEND_API_KEY=" "$ENV_FILE" | cut -d= -f2-)
  if [ -n "$RESEND_API_KEY" ]; then
    curl -s -m 5 -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"from\":\"The Break Surf <orders@thebreaksurf.co.uk>\",\"to\":\"nathan@thebreaksurf.co.uk\",\"subject\":\"Pi connectivity trouble\",\"text\":\"The Pi has failed $fails consecutive internet connectivity checks and may reboot automatically if this continues.\"}" \
      >/dev/null 2>&1 || true
  fi
  touch "$ALERT_SENT_FILE"
fi

if [ "$fails" -ge "$MAX_FAILS" ]; then
  last_reboot=$(cat "$LAST_REBOOT_FILE" 2>/dev/null || echo 0)
  now=$(date +%s)
  if [ $((now - last_reboot)) -ge "$REBOOT_COOLDOWN" ]; then
    logger -t connectivity-watchdog "internet unreachable after Wi-Fi recovery for $fails checks - rebooting"
    echo "$now" > "$LAST_REBOOT_FILE"
    printf '%s\t%s\n' "$now" "connectivity-watchdog" >> "$REBOOT_LOG_FILE"
    systemctl reboot
  else
    logger -t connectivity-watchdog "internet still unreachable but reboot cooldown active, skipping reboot"
  fi
fi
