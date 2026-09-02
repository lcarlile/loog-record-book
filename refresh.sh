#!/bin/sh
# Finds a modern Node for you, then runs refresh.js with whatever flags you pass.
#   ./refresh.sh --check     compare against what is committed, write nothing
#   ./refresh.sh             rebuild the data files
set -e
cd "$(dirname "$0")"

NODE=""
for c in "$(command -v node || true)" $HOME/.nvm/versions/node/v2*/bin/node \
         /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$c" ] || continue
  case "$("$c" -v 2>/dev/null)" in
    v1[89].*|v2*) NODE="$c"; break ;;
  esac
done

if [ -z "$NODE" ]; then
  echo "Could not find Node 18 or newer. Install one, or run refresh.js with a modern node."
  exit 1
fi

echo "using $($NODE -v)"
exec "$NODE" refresh.js "$@"
