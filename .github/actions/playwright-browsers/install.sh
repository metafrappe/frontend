#!/usr/bin/env bash
# Playwright system dependencies + browsers.
# Source: the same script in the frappesetup repository (AJA-364, AJA-382, AJA-389).
# atonota-web finding (24 November 2026, PR 7): the `playwright install --with-deps webkit` step
# did not finish within the 30-minute job limit; in the Chromium job installation made the job take 23 minutes.
# frappesetup measurement (23 November 2026): the same step took between 42 s and 1453 s;
# the duration depended on the apt mirror's speed (in one run `apt-get update` hung for 24 min).
# With a cache, the .deb files are installed without the network; `apt-get update` never runs.
# The package set is the same as with `--with-deps`: the cache holds only the files
# downloaded by `playwright install-deps`.
#
# frappesetup finding (AJA-364): `apt-get install --no-download` does not install .deb files
# outside the archive folder ("Unable to fetch some archives"). So the cache was never
# used; every job installed from the network. A job that hit a slow mirror (234 kB/s) did not finish in 20 minutes.
# Fix: the files are first copied into the apt archive folder, and installation runs from there.
set -euo pipefail

# Browsers to install come from the action input (space-separated). Firefox is not run in this repository.
read -r -a BROWSERS <<< "${PW_BROWSERS:-}"
# When run directly the list must not be empty; the check runs before any system setting is touched.
if [ "${BASH_SOURCE[0]}" = "$0" ] && ((${#BROWSERS[@]} == 0)); then
  echo "PW_BROWSERS boş: kurulacak tarayıcı verilmedi" >&2
  exit 1
fi
DEBS="$HOME/.cache/pw-debs"
ARCHIVES=/var/cache/apt/archives
MIRRORS=/etc/apt/apt-mirrors.txt
# Time limit and attempt count for one network attempt. The job limit is 30 min; 3 attempts take at most 12 min.
NET_ATTEMPT_SECONDS="${PW_APT_ATTEMPT_SECONDS:-240}"
NET_ATTEMPTS="${PW_APT_ATTEMPTS:-3}"
# When time runs out, processes get TERM first; KILL follows after this many seconds.
KILL_AFTER="${PW_APT_KILL_AFTER_SECONDS:-15}"
# Before a new attempt, wait at most this long for the apt lock to be released.
LOCK_WAIT="${PW_APT_LOCK_WAIT_SECONDS:-60}"
# frappesetup finding (AJA-382, 24 November 2026): GNU `timeout` stopped only its own process group.
# `sudo` runs the command in a separate session (pty); the inner `apt-get` was not in the group.
# After the timeout `apt-get` kept running and held the dpkg lock. Later attempts
# failed at once with "Could not get lock /var/lib/dpkg/lock-frontend".
# AJA-389: processes are not stopped by name. A name pattern would also stop apt jobs the script
# did not start. On timeout the script stops only the process tree of the command it started.
# The tree is found from parent process IDs (ppid); `apt-get` in a separate session is in the tree too.
# The lock wait looks for apt processes by exact name only, and only waits.
APT_PROC_NAMES='apt-get|apt|dpkg'
# Time limit for `dpkg --configure -a`.
DPKG_CONFIGURE_SECONDS="${PW_DPKG_CONFIGURE_SECONDS:-120}"
APT_LOCK_FILES="/var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock /var/lib/apt/lists/lock"

# On a slow network, time out and retry instead of waiting; do not delete downloaded packages.
# After an interrupted attempt, wait a while for the dpkg lock.
sudo tee /etc/apt/apt.conf.d/80playwright-ci >/dev/null <<'EOF'
Acquire::Retries "5";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
DPkg::Lock::Timeout "120";
APT::Keep-Downloaded-Packages "true";
Binary::apt-get::APT::Keep-Downloaded-Packages "true";
EOF

list_archives() {
  find "$ARCHIVES" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort
}

# Files copied from the cache, to be removed again if installation fails.
COPIED=()

install_from_cache() {
  shopt -s nullglob
  local files=("$DEBS"/*.deb)
  shopt -u nullglob
  ((${#files[@]})) || return 1
  echo "apt paketleri önbellekten kuruluyor (${#files[@]} dosya)"
  local f name targets=()
  for f in "${files[@]}"; do
    name=$(basename "$f")
    if [ ! -e "$ARCHIVES/$name" ]; then
      sudo cp "$f" "$ARCHIVES/$name"
      COPIED+=("$name")
    fi
    targets+=("$ARCHIVES/$name")
  done
  # If a downgrade is requested, apt -y stops (no --allow-downgrades); network installation starts.
  sudo apt-get install -y --no-install-recommends --no-download "${targets[@]}"
}

undo_cache_copy() {
  local name
  for name in "${COPIED[@]}"; do
    sudo rm -f "$ARCHIVES/$name"
  done
  COPIED=()
  # Any half-finished dpkg work is completed; network installation starts from a clean state.
  configure_dpkg
}

# Completes half-finished dpkg work with a time limit. dpkg errors are swallowed; the next
# installation shows the problem again. On timeout it prints a clear error and returns 1.
configure_dpkg() {
  local rc=0
  run_with_deadline "$DPKG_CONFIGURE_SECONDS" sudo dpkg --configure -a || rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "dpkg --configure -a ${DPKG_CONFIGURE_SECONDS} sn içinde bitmedi; komut durduruldu" >&2
    return 1
  fi
  return 0
}

# Moves the first mirror in the mirror list to the end. A slow but responding mirror gives apt no
# error; apt does not move to the next mirror by itself.
demote_first_mirror() {
  [ -s "$MIRRORS" ] || return 0
  local tmp
  tmp=$(mktemp)
  awk 'NF { line[++n] = $0 }
       END {
         for (i = 2; i <= n + 1; i++) {
           l = (i <= n) ? line[i] : line[1]
           sub(/priority:[0-9]+/, "priority:" (i - 1), l)
           print l
         }
       }' "$MIRRORS" > "$tmp"
  echo "apt ayna sırası değişti:"
  cat "$tmp"
  sudo cp "$tmp" "$MIRRORS"
  rm -f "$tmp"
}

# Prints the given processes and all their descendants (ppid tree).
process_tree() {
  ps -A -o pid= -o ppid= | awk -v roots="$*" '
    BEGIN { n = split(roots, r, " "); for (i = 1; i <= n; i++) keep[r[i]] = 1 }
    { pid[++m] = $1; parent[$1] = $2 }
    END {
      do {
        changed = 0
        for (i = 1; i <= m; i++) {
          p = pid[i]
          if (!(p in keep) && (parent[p] in keep)) { keep[p] = 1; changed = 1 }
        }
      } while (changed)
      for (p in keep) print p
    }'
}

# Is any process in the list still alive?
any_alive() {
  local p
  for p in "$@"; do
    kill -0 "$p" 2>/dev/null && return 0
  done
  return 1
}

# Runs the command in its own process group. On timeout it stops only this command's process
# tree and returns 124. The `sudo` child is in the tree even in a separate session.
run_with_deadline() {
  local secs="$1" pid rc=0 start tree
  shift
  set -m
  "$@" &
  pid=$!
  set +m
  start=$SECONDS
  while kill -0 "$pid" 2>/dev/null; do
    if ((SECONDS - start >= secs)); then
      # The tree is read before TERM: when a parent dies, its child detaches from it.
      tree=$(process_tree "$pid")
      # shellcheck disable=SC2086
      sudo kill -TERM -- "-$pid" $tree 2>/dev/null || true
      start=$SECONDS
      # shellcheck disable=SC2086
      while any_alive $tree && ((SECONDS - start < KILL_AFTER)); do sleep 1; done
      # Children spawned during TERM are added to the tree too.
      # shellcheck disable=SC2086
      tree=$(process_tree $tree)
      # shellcheck disable=SC2086
      sudo kill -KILL -- "-$pid" $tree 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      start=$SECONDS
      # shellcheck disable=SC2086
      while any_alive $tree && ((SECONDS - start < KILL_AFTER)); do sleep 1; done
      return 124
    fi
    sleep 1
  done
  wait "$pid" || rc=$?
  return "$rc"
}

# Succeeds if apt or dpkg is running or an apt lock is held.
apt_busy() {
  local f
  pgrep -x -- "$APT_PROC_NAMES" >/dev/null 2>&1 && return 0
  command -v fuser >/dev/null 2>&1 || return 1
  for f in $APT_LOCK_FILES; do
    if [ -e "$f" ] && sudo fuser "$f" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

wait_for_apt_lock() {
  local start=$SECONDS
  while apt_busy; do
    if ((SECONDS - start >= LOCK_WAIT)); then
      echo "apt kilidi ${LOCK_WAIT} sn içinde bırakılmadı" >&2
      return 1
    fi
    sleep 1
  done
}

install_from_network() {
  local before="$1" after attempt rc
  echo "apt paketleri ağdan kuruluyor"
  for ((attempt = 1; attempt <= NET_ATTEMPTS; attempt++)); do
    echo "ağ denemesi $attempt/$NET_ATTEMPTS (süre sınırı ${NET_ATTEMPT_SECONDS} sn)"
    rc=0
    run_with_deadline "$NET_ATTEMPT_SECONDS" npx playwright install-deps "${BROWSERS[@]}" || rc=$?
    [ "$rc" -eq 0 ] && break
    echo "ağ denemesi $attempt başarısız (çıkış kodu $rc)"
    if ((attempt == NET_ATTEMPTS)); then
      echo "apt paketleri $NET_ATTEMPTS denemede kurulamadı" >&2
      return "$rc"
    fi
    wait_for_apt_lock || return 1
    # Any half-finished installation is completed; the next attempt starts from a clean state.
    configure_dpkg || return 1
    demote_first_mirror
  done
  after=$(mktemp)
  list_archives > "$after"
  # apt takes file times from the server, so name lists are compared instead of times.
  rm -rf "$DEBS"
  mkdir -p "$DEBS"
  comm -13 "$before" "$after" | while IFS= read -r f; do cp "$ARCHIVES/$f" "$DEBS/"; done
  echo "önbelleğe alınacak paket sayısı: $(find "$DEBS" -name '*.deb' | wc -l)"
}

main() {
  local before
  before=$(mktemp)
  list_archives > "$before"
  # DEBS_HIT: "true" exact key, "false" an older image's key, empty value no cache.
  if [ -n "${DEBS_HIT:-}" ]; then
    if [ "$DEBS_HIT" != "true" ]; then
      echo "apt önbelleği tam anahtarla gelmedi; eski imajın paketleri deneniyor"
    fi
    if install_from_cache; then
      return 0
    fi
    echo "önbellekten kurulum olmadı; ağdan kurulacak"
    undo_cache_copy
  fi
  install_from_network "$before"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main
  # If the browser is in the cache this command only verifies it; otherwise it downloads it.
  npx playwright install "${BROWSERS[@]}"
fi
