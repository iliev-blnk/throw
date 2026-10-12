#!/usr/bin/env bash
# Render the demo media with pagereel (needs ffmpeg and Chrome/Chromium). Run from the repo root:
#   bash demo/render.sh
set -euo pipefail
PORT=${PORT:-7790}
URL="http://127.0.0.1:$PORT"

pnpm build
mkdir -p dist/demo media
node demo/synth.mjs dist/demo/demo.wav
node dist-server/server/cli.js --port "$PORT" --host 127.0.0.1 --artnet 127.0.0.1 >/dev/null &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1

pnpm exec pagereel render "$URL/previs.html?demo&w=1920&h=1080&audio=demo/demo.wav&dur=30" -o media/throw-previs.mp4
pnpm exec pagereel render "$URL/render.html?demo&w=1920&h=1080&audio=demo/demo.wav&dur=30" -o media/throw-program.mp4
pnpm exec pagereel render "$URL/previs.html?demo&w=720&h=406&dur=8" --fps 15 -o media/demo.gif

# smaller files for the repo: h264 CRF 26 with fast start, a 640 px 12 fps GIF
for f in throw-previs throw-program; do
  ffmpeg -v error -y -i "media/$f.mp4" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart "media/$f.tmp.mp4"
  mv "media/$f.tmp.mp4" "media/$f.mp4"
done
ffmpeg -v error -y -i media/demo.gif -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" media/demo.tmp.gif
mv media/demo.tmp.gif media/demo.gif
