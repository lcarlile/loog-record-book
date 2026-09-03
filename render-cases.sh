#!/usr/bin/env bash
# Renders one trophy-case image per manager, per league.
#   ./render-cases.sh            all managers
#   ./render-cases.sh loog       one league only
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8803
W=1600; H=1220
SS=2          # render at 2x and downsample: the cheapest, most reliable way to
              # kill the stair-stepped edges that make a render look like a viewport

# a local server is required: ES-module imports are blocked over file://
if ! curl -sf -o /dev/null "http://localhost:$PORT/render/case3d.html"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SRV=$!; trap 'kill $SRV 2>/dev/null || true' EXIT
  for _ in $(seq 30); do curl -sf -o /dev/null "http://localhost:$PORT/render/case3d.html" && break; done
fi

node -e "
const fs=require('fs');
const only=process.argv[1]||'';
const rows=[];
for (const sl of ['loog','the-league']) {
  if (only && sl!==only) continue;
  const d=JSON.parse(fs.readFileSync('data/'+sl+'/data.json','utf8'));
  Object.values(d).forEach(m=>{
    const c=n=>m.seasons.filter(s=>s.note===n).length;
    const g=c('Champion'), s=c('Runner Up'), b=c('Third'), t=c('Biggest Loser');
    // cobwebs whenever the case itself is bare - toilets don't count as silverware
    rows.push([sl+'-'+m.name, g, s, b, t, (g+s+b)===0?1:0, m.name].join('\t'));
  });
}
console.log(rows.join('\n'));
" "${1:-}" | while IFS=$'\t' read -r slug g s b t web name; do
  out="art/cases/${slug}.png"
  # Chrome's new headless does not reliably exit after --screenshot; left alone the
  # renderers pile up and every later frame contends with them. Each invocation's
  # unique --screenshot path is the handle we reap them by, plus a hard timeout.
  ( "$CHROME" --headless --disable-gpu --enable-unsafe-swiftshader --hide-scrollbars \
      --default-background-color=00000000 --window-size=$((W*SS)),$((H*SS)) --virtual-time-budget=60000 \
      --screenshot="$out" \
      "http://localhost:$PORT/render/case3d.html?w=$((W*SS))&h=$((H*SS))&gold=$g&silver=$s&medal=$b&loo=$t&web=$web&name=$(printf %s "$name" | sed 's/ /%20/g')" \
      >/dev/null 2>&1 ) & cpid=$!
  ( sleep 240; kill -9 $cpid 2>/dev/null ) & watchdog=$!
  wait $cpid 2>/dev/null || true
  kill $watchdog 2>/dev/null || true
  pkill -9 -f "screenshot=$out" 2>/dev/null || true
  sips -Z $W "$out" --out "$out" >/dev/null 2>&1 || true
  printf '  %-26s %s\n' "$slug" "$(du -h "$out" | cut -f1)"
done

echo
echo "total: $(du -sh art/cases | cut -f1) across $(ls art/cases/*.png | wc -l | tr -d ' ') images"
