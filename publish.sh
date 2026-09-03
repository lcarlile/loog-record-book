#!/bin/sh
# Copies a built league page into its own site repo and pushes it.
#   ./publish.sh the-league
set -e
cd "$(dirname "$0")"
SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "usage: ./publish.sh <league-slug>"; exit 1; }

case "$SLUG" in
  the-league) SRC="build/the-league/index.html"; DEST="../the-league-site" ;;
  loog)       echo "loog publishes from this repo directly - just commit and push."; exit 0 ;;
  *)          echo "no publish target configured for $SLUG"; exit 1 ;;
esac

[ -f "$SRC" ] || { echo "missing $SRC - run: node build.js --league $SLUG"; exit 1; }
cp "$SRC" "$DEST/index.html"
[ -f "build/the-league/tape.html" ] && cp build/the-league/tape.html "$DEST/tape.html"
[ -f "build/the-league/og.png" ] && cp build/the-league/og.png "$DEST/og.png"
cd "$DEST"
if git diff --quiet; then echo "no change to publish"; exit 0; fi
git add index.html tape.html og.png
git commit -q -m "Update record book ($(date +%Y-%m-%d))"
git push -q origin main
echo "published -> https://lcarlile.github.io/the-league-record-book/"
