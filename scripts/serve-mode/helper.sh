#!/bin/sh
# T3 Code serve mode helper. install.sh installs it as a root LaunchDaemon that
# runs at boot, every 15 seconds, and whenever a server adds or removes a
# request. While a live T3 Code server has a request in REQUEST_DIR, the Mac
# runs in Low Power Mode and keeps running with the lid closed on AC power.
# On battery, closing the lid sleeps as usual. Once no server has asked for a
# minute, the saved Low Power Mode settings come back and sleep is re-enabled.
# Sleep is never restored as disabled: a Mac left that way overheats in a bag.
#
# REQUEST_DIR must match SERVE_MODE_REQUEST_DIR in
# apps/server/src/background/ServeMode.ts.

set -eu

readonly REQUEST_DIR=/private/tmp/t3code-serve-mode
readonly STATE_FILE=/var/db/t3code-serve-mode.state
readonly SEEN_FILE=/var/db/t3code-serve-mode.seen
# Outlasts a server restart, so an update does not sleep a closed Mac.
readonly GRACE_SECONDS=60
readonly PMSET=/usr/bin/pmset

log() {
  /usr/bin/logger -t t3code-serve-mode "$*"
}

has_live_request() {
  # The directory is user-writable; never follow a link planted in its place.
  [ -d "$REQUEST_DIR" ] && [ ! -L "$REQUEST_DIR" ] || return 1
  found=1
  for request in "$REQUEST_DIR"/*; do
    pid=${request##*/}
    case $pid in '' | *[!0-9]*) continue ;; esac
    if /bin/kill -0 "$pid" 2>/dev/null; then
      found=0
    else
      /bin/rm -f "$request"
    fi
  done
  return $found
}

seen_recently() {
  [ -f "$SEEN_FILE" ] || return 1
  [ $(($(/bin/date +%s) - $(/usr/bin/stat -f %m "$SEEN_FILE"))) -lt "$GRACE_SECONDS" ]
}

# Apple Silicon names Low Power Mode `powermode` (1 = low); older Macs use
# `lowpowermode`.
power_mode_key() {
  if "$PMSET" -g custom | /usr/bin/grep -q '^ *powermode '; then
    echo powermode
  else
    echo lowpowermode
  fi
}

# Prints nothing when the Mac has no such power source (no battery on a desktop).
power_mode_for() {
  "$PMSET" -g custom | /usr/bin/awk -v section="$1:" -v key="$2" '
    $0 == section { inside = 1; next }
    /^[^ \t].*:$/ { inside = 0 }
    inside && $1 == key { print $2 }
  '
}

sleep_disabled() {
  value=$("$PMSET" -g | /usr/bin/awk '$1 == "SleepDisabled" { print $2 }')
  echo "${value:-0}"
}

on_ac_power() {
  "$PMSET" -g ps | /usr/bin/head -n 1 | /usr/bin/grep -q "'AC Power'"
}

# An external display keeps a closed Mac awake on its own; leave that alone.
sleep_if_lid_closed() {
  clamshell=$(/usr/sbin/ioreg -r -k AppleClamshellState -d 1)
  if echo "$clamshell" | /usr/bin/grep -q '"AppleClamshellState" = Yes' &&
    echo "$clamshell" | /usr/bin/grep -q '"AppleClamshellCausesSleep" = Yes'; then
    log "lid is closed; sleeping"
    "$PMSET" sleepnow >/dev/null
  fi
}

serve() {
  key=$(power_mode_key)
  battery=$(power_mode_for "Battery Power" "$key")
  ac=$(power_mode_for "AC Power" "$key")
  disabled=$(sleep_disabled)
  if [ ! -f "$STATE_FILE" ]; then
    printf 'key=%s\nbattery=%s\nac=%s\n' "$key" "$battery" "$ac" >"$STATE_FILE"
    log "serving: saved $key battery=$battery ac=$ac"
  fi
  if [ -n "$battery" ] && [ "$battery" != 1 ]; then "$PMSET" -b "$key" 1; fi
  if [ -n "$ac" ] && [ "$ac" != 1 ]; then "$PMSET" -c "$key" 1; fi
  if on_ac_power; then
    if [ "$disabled" != 1 ]; then
      "$PMSET" -a disablesleep 1
      log "on AC power; closing the lid keeps running"
    fi
  else
    if [ "$disabled" != 0 ]; then
      "$PMSET" -a disablesleep 0
      log "on battery; closing the lid sleeps"
    fi
    sleep_if_lid_closed
  fi
}

restore() {
  /bin/rm -f "$SEEN_FILE"
  [ -f "$STATE_FILE" ] || return 0
  # Root-owned and written by serve() above.
  . "$STATE_FILE"
  if [ -n "$battery" ]; then "$PMSET" -b "$key" "$battery"; fi
  if [ -n "$ac" ]; then "$PMSET" -c "$key" "$ac"; fi
  if [ "$(sleep_disabled)" != 0 ]; then "$PMSET" -a disablesleep 0; fi
  /bin/rm -f "$STATE_FILE"
  log "restored $key battery=$battery ac=$ac; sleep enabled"
  sleep_if_lid_closed
}

case "${1:-reconcile}" in
  reconcile)
    if has_live_request; then
      /usr/bin/touch "$SEEN_FILE"
      serve
    elif [ -f "$STATE_FILE" ] && seen_recently; then
      serve
    else
      restore
    fi
    ;;
  restore) restore ;;
  *)
    echo "usage: $0 [reconcile|restore]" >&2
    exit 64
    ;;
esac
