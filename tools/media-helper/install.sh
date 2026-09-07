#!/bin/zsh
set -euo pipefail

HELPER_NAME="The Break Surf Media Helper"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/Library/Application Support/$HELPER_NAME"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/uk.co.thebreaksurf.media-helper.plist"
NODE_BIN="$(command -v node)"
OPENSSL_BIN="$(command -v openssl)"
USER_ID="$(id -u)"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents"
cp "$SOURCE_DIR/helper.mjs" "$INSTALL_DIR/helper.mjs"
chmod 700 "$INSTALL_DIR/helper.mjs"
/usr/bin/clang -fobjc-arc -framework Foundation "$SOURCE_DIR/trash-file.m" -o "$INSTALL_DIR/trash-file"
chmod 700 "$INSTALL_DIR/trash-file"
/usr/bin/clang -fobjc-arc \
  -framework Foundation -framework AVFoundation -framework CoreGraphics -framework CoreMedia \
  "$SOURCE_DIR/rotate-video.m" -o "$INSTALL_DIR/rotate-video"
chmod 700 "$INSTALL_DIR/rotate-video"

if [[ ! -f "$INSTALL_DIR/localhost.crt" || ! -f "$INSTALL_DIR/localhost.key" ]]; then
  "$OPENSSL_BIN" req -x509 -newkey rsa:2048 -sha256 -nodes \
    -keyout "$INSTALL_DIR/localhost.key" \
    -out "$INSTALL_DIR/localhost.crt" \
    -days 3650 \
    -subj "/CN=The Break Surf Media Helper" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth"
  chmod 600 "$INSTALL_DIR/localhost.key" "$INSTALL_DIR/localhost.crt"
  security add-trusted-cert -d -r trustRoot \
    -k "$HOME/Library/Keychains/login.keychain-db" \
    "$INSTALL_DIR/localhost.crt"
fi

cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>uk.co.thebreaksurf.media-helper</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$INSTALL_DIR/helper.mjs</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>$INSTALL_DIR/helper.log</string>
  <key>StandardErrorPath</key>
  <string>$INSTALL_DIR/helper-error.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$USER_ID/uk.co.thebreaksurf.media-helper" 2>/dev/null || true
for attempt in 1 2 3; do
  if launchctl bootstrap "gui/$USER_ID" "$LAUNCH_AGENT"; then
    break
  fi
  if [[ "$attempt" == "3" ]]; then
    echo "Could not restart the media helper login service." >&2
    exit 1
  fi
  sleep 1
done
launchctl enable "gui/$USER_ID/uk.co.thebreaksurf.media-helper"
launchctl kickstart -k "gui/$USER_ID/uk.co.thebreaksurf.media-helper"

echo "$HELPER_NAME installed and running at https://localhost:47831"
