#!/usr/bin/env bash
# Reescala las fotos de referencia x3 (Lanczos + nitidez + leve calidez) para
# que los planos macro no se pixelen al ampliarse en 1080x1920.
set -euo pipefail
cd "$(dirname "$0")/../src/assets"
for f in steak interior; do
  convert "$f.webp" -filter Lanczos -resize 300% -unsharp 0x1.4+0.7+0.01 \
    -modulate 100,108,100 -quality 92 "${f}_3x.jpg"
done
ls -la *_3x.jpg
