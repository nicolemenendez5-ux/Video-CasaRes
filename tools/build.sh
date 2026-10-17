#!/usr/bin/env bash
# Pipeline completo: voz → audio → render 9:16 y 16:9 → mux final en out/.
#   tools/build.sh <dir_modelos_kokoro> [dir_temporal]
# Los modelos de Kokoro (kokoro-v1.0.onnx, voices-v1.0.bin) se descargan de
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$1"
TMP="${2:-$(mktemp -d)}"
mkdir -p "$TMP" "$ROOT/out"
cd "$ROOT"

tools/prep_images.sh
python3 audio/vo.py "$MODELS" "$TMP"
python3 audio/build_audio.py "$TMP" "$TMP/mix.wav"

node tools/render.mjs video 1080 1920 "$TMP/v_9x16.mp4" src/vo_lines.json &
node tools/render.mjs video 1920 1080 "$TMP/v_16x9.mp4" src/vo_lines.json &
wait

for f in 9x16 16x9; do
  ffmpeg -v error -y -i "$TMP/v_$f.mp4" -i "$TMP/mix.wav" -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 19 -maxrate 16M -bufsize 32M -pix_fmt yuv420p -profile:v high -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest \
    "out/CasaRES_15s_$f.mp4"
done
cp "$TMP/mix.wav" out/CasaRES_15s_audio.wav
ls -la out
