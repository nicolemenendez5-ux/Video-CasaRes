"""Voz en off: genera cada línea con Kokoro (voz em_alex, español) y la procesa
para que suene más grave, cálida y con autoridad.

Uso: python3 audio/vo.py <dir_modelos_kokoro> <dir_salida>
Escribe <dir_salida>/vo_<n>.wav (48 kHz mono, sin silencios) y vo_lines.json
(copia en src/vo_lines.json para los subtítulos).
"""
import json
import subprocess
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# (inicio en segundos, texto hablado, texto de subtítulo[, velocidad])
LINES = [
    (0.95, "Todo empieza con el fuego.", "Todo empieza con el fuego."),
    (3.10, "Con el corte perfecto.", "Con el corte perfecto."),
    (7.85, "Con las personas que importan.", "Con las personas que importan."),
    (9.72, "En Casa Res, somos maestros de la parrilla.", "En Casa RES somos maestros de la parrilla."),
    # el cierre va sin subtítulo: el logo y el eslogan en pantalla ya lo dicen
    (12.42, "Casa Res.", None),
    (13.36, "Sellamos tus recuerdos.", None, 1.0),
]
SPEED = 0.9
SRC_JSON = __file__.rsplit("/audio/", 1)[0] + "/src/vo_lines.json"
VOICE = "em_alex"


def trim(a, sr, thr=0.008, pad=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    s = max(idx[0] - int(pad * sr), 0)
    e = min(idx[-1] + int(pad * sr), len(a))
    return a[s:e]


def main(models, out):
    k = Kokoro(f"{models}/kokoro-v1.0.onnx", f"{models}/voices-v1.0.bin")
    meta = []
    for i, (start, spoken, sub, *opt) in enumerate(LINES):
        a, sr = k.create(spoken, voice=VOICE, speed=opt[0] if opt else SPEED, lang="es")
        raw = f"{out}/vo_raw_{i}.wav"
        sf.write(raw, trim(a, sr), sr)
        dst = f"{out}/vo_{i}.wav"
        # Más grave (-2 semitonos con formantes preservados), cuerpo en graves,
        # presencia, compresión suave.
        af = (
            "aresample=48000,"
            "rubberband=pitch=0.89:formant=preserved:pitchq=quality,"
            "highpass=f=70,"
            "equalizer=f=140:t=q:w=1.0:g=4,"
            "equalizer=f=320:t=q:w=1.2:g=-2,"
            "equalizer=f=3200:t=q:w=1.0:g=2.5,"
            "equalizer=f=9000:t=q:w=1.0:g=-2,"
            "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2"
        )
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ac", "1", dst],
            check=True,
        )
        b, sr2 = sf.read(dst)
        b = trim(b, sr2)
        sf.write(dst, b, sr2)
        dur = len(b) / sr2
        meta.append({"start": start, "end": round(start + dur, 3), "text": sub or spoken, "noSub": sub is None, "file": f"vo_{i}.wav"})
        print(f"{i}: {start:.2f}-{start + dur:.2f} ({dur:.2f}s) {spoken}")
    data = {"lines": meta, "tag": LINES[-1][0]}
    for path in (f"{out}/vo_lines.json", SRC_JSON):
        with open(path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
