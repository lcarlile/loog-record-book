#!/bin/sh
# Renders the 3D models in models/ to transparent PNGs in art/.
#   ./render.sh
# Expects (CC-BY, see CREDITS.md):
#   models/trophy.glb   models/toilet.glb   [models/medal.glb]
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Google Chrome not found"; exit 1; }
mkdir -p art

PORT=8802
python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1

shot () { # name file size tint yaw pitch
  [ -f "models/$2" ] || { echo "  skip $1 (models/$2 not found)"; return; }
  "$CHROME" --headless --disable-gpu --enable-unsafe-swiftshader --hide-scrollbars \
    --default-background-color=00000000 --window-size=$3,$3 --virtual-time-budget=12000 \
    --screenshot="art/$1.png" \
    "http://localhost:$PORT/render/scene.html?size=$3&file=../models/$2&tint=$4&yaw=$5&pitch=$6" \
    >/dev/null 2>&1
  if [ -f "art/$1.png" ]; then echo "  art/$1.png  $(du -h art/$1.png | cut -f1)"; fi
}

echo "Rendering:"
shot trophy-gold   trophy.glb 640 ""       22 14
shot trophy-silver trophy.glb 640 C8CDD3   22 14
shot medal         medal.glb  640 ""       18 16
shot toilet        toilet.glb 640 ""       28 12
echo "Done. Drop these into the case as flat <img>."
