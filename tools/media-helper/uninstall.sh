#!/bin/zsh
set -euo pipefail

HELPER_NAME="The Break Surf Media Helper"
INSTALL_DIR="$HOME/Library/Application Support/$HELPER_NAME"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/uk.co.thebreaksurf.media-helper.plist"
USER_ID="$(id -u)"

launchctl bootout "gui/$USER_ID/uk.co.thebreaksurf.media-helper" 2>/dev/null || true
rm -f "$LAUNCH_AGENT"

if [[ -f "$INSTALL_DIR/localhost.crt" ]]; then
  security remove-trusted-cert -d "$INSTALL_DIR/localhost.crt" 2>/dev/null || true
fi

echo "The login service and certificate trust were removed."
echo "Helper data remains at: $INSTALL_DIR"
