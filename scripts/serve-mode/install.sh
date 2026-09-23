#!/bin/bash
# Installs or removes the root helper that lets T3 Code's serve mode keep a Mac
# running with the lid closed and in Low Power Mode. See helper.sh.
#
#   sudo scripts/serve-mode/install.sh            # install or update
#   sudo scripts/serve-mode/install.sh uninstall  # remove and restore power settings

set -euo pipefail

readonly label="com.t3tools.t3code.serve-mode"
readonly helper_path="/Library/PrivilegedHelperTools/$label"
readonly plist_path="/Library/LaunchDaemons/$label.plist"
readonly source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '[t3code-serve-mode] %s\n' "$*"
}

install_helper() {
  install -o root -g wheel -m 0755 "$source_dir/helper.sh" "$helper_path"
  local plist
  plist="$(mktemp)"
  cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$helper_path</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>15</integer>
  <key>WatchPaths</key>
  <array>
    <string>/private/tmp/t3code-serve-mode</string>
  </array>
</dict>
</plist>
EOF
  plutil -lint "$plist" >/dev/null
  install -o root -g wheel -m 0644 "$plist" "$plist_path"
  rm -f "$plist"
  launchctl bootout "system/$label" 2>/dev/null || true
  launchctl bootstrap system "$plist_path"
  log "Installed. With serve mode on, this Mac keeps running with the lid closed while"
  log "plugged in and uses Low Power Mode. Remove it with: sudo $0 uninstall"
}

uninstall_helper() {
  launchctl bootout "system/$label" 2>/dev/null || true
  if [[ -x "$helper_path" ]]; then
    "$helper_path" restore
  fi
  rm -f "$helper_path" "$plist_path"
  log "Removed. Power settings are back to what they were before serve mode."
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Serve mode's helper only supports macOS." >&2
  exit 1
fi
if [[ "$EUID" -ne 0 ]]; then
  echo "Run with sudo: sudo $0 ${1:-install}" >&2
  exit 1
fi

case "${1:-install}" in
  install) install_helper ;;
  uninstall) uninstall_helper ;;
  *)
    echo "usage: sudo $0 [install|uninstall]" >&2
    exit 64
    ;;
esac
