#!/bin/sh
# Regenerates a league's social card: builds the HTML, renders it to a 1200x630 PNG.
#   ./make-og.sh loog
#   ./make-og.sh the-league
set -e
cd "$(dirname "$0")"
SLUG="${1:-loog}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Google Chrome not found - needed to render the card"; exit 1; }

NODE=""
for c in $HOME/.nvm/versions/node/v2*/bin/node /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node || true)"; do
  [ -x "$c" ] || continue
  case "$("$c" -v 2>/dev/null)" in v1[89].*|v2*) NODE="$c"; break ;; esac
done
[ -n "$NODE" ] || { echo "need Node 18+"; exit 1; }

"$NODE" make-og.js --league "$SLUG"
PORT=8791
"$NODE" -e '
const http=require("http"),fs=require("fs"),p=require("path");
http.createServer((q,s)=>{const f=p.join(process.cwd(),decodeURIComponent(q.url).split("?")[0]);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}
 s.writeHead(200,{"content-type":q.url.endsWith(".png")?"image/png":"text/html"});
 fs.createReadStream(f).pipe(s)}).listen('"$PORT"',"127.0.0.1");
setTimeout(()=>process.exit(0),15000);' &
SRV=$!
sleep 1
case "$SLUG" in
  loog)       OUT="og.png" ;;
  the-league) OUT="build/the-league/og.png"; mkdir -p build/the-league ;;
  *)          OUT="og/$SLUG.png" ;;
esac
"$CHROME" --headless --disable-gpu --hide-scrollbars --window-size=1200,630 \
  --virtual-time-budget=4000 --screenshot="$OUT" \
  "http://127.0.0.1:$PORT/og/$SLUG.html" >/dev/null 2>&1
kill $SRV 2>/dev/null || true
echo "wrote $OUT"
