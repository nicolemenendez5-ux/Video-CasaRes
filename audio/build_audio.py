"""Banda sonora completa sintetizada: música (120 BPM, percusión moderna),
diseño sonoro (chispa, encendido, chisporroteo, cuchillo, sal, copas, sello)
y mezcla con la voz en off (con ducking).

Uso: python3 audio/build_audio.py <dir_vo> <salida.wav>
<dir_vo> debe contener vo_lines.json y los vo_<n>.wav que genera audio/vo.py.
"""
import json
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

MUS = np.zeros((2, N))   # música
SFX = np.zeros((2, N))   # diseño sonoro
VOX = np.zeros((2, N))   # voz


# ───────────────────────── utilidades ─────────────────────────
def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def filt(x, kind, f, order=2):
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def env_ad(d, a, decay, curve=1.0):
    t = tt(d)
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / decay)
    return e ** curve


def place(buf, x, t0, gain=1.0, pan=0.0):
    """Suma x (mono o estéreo) en buf desde t0 (s), con paneo constante."""
    i0 = int(round(t0 * SR))
    if x.ndim == 1:
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * lg * 1.414, x * rg * 1.414])
    s0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(x.shape[1] - s0, N - i0)
    if n > 0:
        buf[:, i0:i0 + n] += gain * x[:, s0:s0 + n]


def reverb(x, decay=1.6, mix=0.3, pre=0.012, tone=5000):
    """Reverb de convolución con IR sintética estéreo."""
    n = int(decay * SR)
    t = np.arange(n) / SR
    ir = []
    for _ in range(2):
        r = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
        r = filt(r, "low", tone)
        r[: int(pre * SR)] = 0
        ir.append(r / np.sqrt((r ** 2).sum()))
    mono = x if x.ndim == 1 else x.mean(0)
    wet = np.stack([signal.fftconvolve(mono, ir[0])[: len(mono)], signal.fftconvolve(mono, ir[1])[: len(mono)]])
    dry = x if x.ndim == 2 else np.stack([x, x])
    return dry * (1 - mix) + wet * mix * 2.2


def sweep_bp(x, f0, f1, q=2.0, steps=64):
    """Paso banda con frecuencia que barre de f0 a f1 (por bloques, suavizado)."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), steps + 1).astype(int)
    win_len = edges[1] - edges[0]
    for k in range(steps):
        f = f0 * (f1 / f0) ** (k / max(steps - 1, 1))
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 - 100)
        a, b = max(edges[k] - win_len, 0), min(edges[k + 1] + win_len, len(x))
        y = filt(x[a:b], "band", [lo, hi])
        out[edges[k]:edges[k + 1]] = y[edges[k] - a: edges[k + 1] - a]
    return out


def add(*xs):
    """suma señales mono de distinta duración"""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[: len(x)] += x
    return out


def sat(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ───────────────────────── instrumentos ─────────────────────────
def kick(gain=1.0, f0=150, f1=44, d=0.45):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = filt(noise(d), "high", 2500) * np.exp(-t * 300) * 0.35
    return sat(body + click, 1.6) * gain


def boom(d=2.2, f0=90, f1=28):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = filt(noise(d), "low", 900) * np.exp(-t * 5) * 0.6
    return sat(s + n, 2.5)


def snare(gain=1.0, d=0.3):
    t = tt(d)
    n = filt(noise(d), "band", [900, 7000]) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return (n + tone) * gain


def clap(gain=1.0):
    d = 0.35
    t = tt(d)
    x = np.zeros(int(d * SR))
    for k, o in enumerate([0, 0.011, 0.023]):
        i = int(o * SR)
        m = len(x) - i
        x[i:] += filt(rng.standard_normal(m), "band", [1000, 5000]) * np.exp(-np.arange(m) / SR * (60 if k < 2 else 16))
    return x * gain


def hat(gain=1.0, open_=False):
    d = 0.25 if open_ else 0.06
    t = tt(d)
    return filt(noise(d), "high", 7500) * np.exp(-t * (14 if open_ else 70)) * gain


def tom(f=95, gain=1.0, d=0.6):
    t = tt(d)
    fr = f * (1 + 0.6 * np.exp(-t * 20))
    return sat(np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 6) + filt(noise(d), "low", 1200) * np.exp(-t * 30) * 0.4, 1.5) * gain


def bass808(f, d, gain=1.0):
    t = tt(d)
    fr = f * (1 + 0.5 * np.exp(-t * 30))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.minimum(t / 0.005, 1) * np.exp(-t * 1.8)
    x[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return sat(x, 2.2) * gain


def pad(freqs, d, gain=1.0, cutoff=1400, att=0.4, rel=0.6):
    t = tt(d)
    x = np.zeros((2, len(t)))
    for i, f in enumerate(freqs):
        for ch, det in enumerate([-0.12, 0.12]):
            for dd in (det, -det * 0.5):
                ff = f * 2 ** (dd / 12)
                saw = 2 * ((t * ff + rng.random()) % 1) - 1
                x[ch] += saw / len(freqs)
    for ch in range(2):
        x[ch] = filt(x[ch], "low", cutoff, 2)
    e = np.minimum(t / att, 1) * np.minimum((d - t) / rel, 1)
    return x * np.clip(e, 0, 1) * gain * 0.35


def bell(f, d=1.2, gain=1.0):
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 3), (2.01, 0.4, 5), (3.03, 0.2, 8), (5.4, 0.08, 14)])
    return x * gain


def riser(d, f0=300, f1=6000, gain=1.0):
    t = tt(d)
    x = sweep_bp(noise(d), f0, f1, q=3) * (t / d) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(110, 880, len(t))) / SR) * (t / d) ** 3 * 0.15
    return (x + tone) * gain


def whoosh(d, f0=400, f1=3000, gain=1.0, shape=1.5):
    t = tt(d)
    e = np.sin(np.pi * t / d) ** shape
    return sweep_bp(noise(d), f0, f1, q=1.6) * e * gain


# ───────────────────────── diseño sonoro ─────────────────────────
def crackle(d, density=30, gain=1.0):
    """chisporroteo de brasas: pops aleatorios + rugido grave"""
    n = int(d * SR)
    x = np.zeros(n)
    k = rng.poisson(density * d)
    for p in rng.integers(0, n - 2000, k):
        L = int(rng.uniform(0.002, 0.012) * SR)
        x[p:p + L] += filt(rng.standard_normal(L), "band", [rng.uniform(800, 2500), 9000]) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1.0)
    roar = filt(noise(d), "low", 260) * 0.5
    return (x + roar) * gain


def sizzle(d, gain=1.0):
    """chisporroteo de la carne: siseo agudo granulado"""
    n = int(d * SR)
    hiss = filt(noise(d), "band", [3000, 14000])
    grain = np.abs(filt(noise(d), "low", 60))
    grain = grain / grain.max()
    pops = np.zeros(n)
    for p in rng.integers(0, n - 800, int(180 * d)):
        L = int(rng.uniform(0.0008, 0.004) * SR)
        pops[p:p + L] += rng.standard_normal(L) * rng.uniform(0.3, 1.2)
    pops = filt(pops, "high", 2500)
    return (hiss * (0.35 + 0.65 * grain) * 0.6 + pops * 0.6) * gain


def flint():
    d = 0.4
    t = tt(d)
    click = filt(noise(d), "high", 3000) * np.exp(-t * 400)
    ping = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * 60) for f in (3150, 4720, 6900)) * 0.15
    return click + ping + crackle(d, 80, 0.3) * np.exp(-t * 6)


def ignition():
    d = 1.6
    t = tt(d)
    wh = sweep_bp(noise(d), 120, 1800, q=1.2) * np.minimum(t / 0.05, 1) * np.exp(-t * 2.2)
    thump = np.sin(2 * np.pi * 55 * t) * np.exp(-t * 6) * 0.9
    roar = filt(noise(d), "low", 400) * np.exp(-t * 1.5) * 0.6
    return sat(wh * 1.4 + thump + roar, 1.5)


def slap():
    d = 0.5
    t = tt(d)
    return filt(noise(d), "low", 1600) * np.exp(-t * 40) * 1.2 + np.sin(2 * np.pi * 85 * t) * np.exp(-t * 14)


def knife_swish():
    return whoosh(0.32, 1500, 7000, 1.0, 1.0)


def knife_scrape(d):
    t = tt(d)
    x = filt(noise(d), "band", [2000, 5200]) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t)))
    ring = np.sin(2 * np.pi * 3420 * t) * 0.06 + np.sin(2 * np.pi * 5130 * t) * 0.03
    return (x * 0.5 + ring) * np.sin(np.pi * t / d) ** 0.5


def chop():
    d = 0.5
    t = tt(d)
    wood = (np.sin(2 * np.pi * 180 * t) + 0.6 * np.sin(2 * np.pi * 427 * t) + 0.3 * np.sin(2 * np.pi * 913 * t)) * np.exp(-t * 28)
    return wood + filt(noise(d), "band", [1500, 8000]) * np.exp(-t * 120) * 0.8


def salt_grains(d, n):
    x = np.zeros(int(d * SR))
    for _ in range(n):
        p = int(rng.uniform(0, d - 0.02) * SR)
        L = int(0.006 * SR)
        f = rng.uniform(4000, 9000)
        x[p:p + L] += np.sin(2 * np.pi * f * np.arange(L) / SR) * np.exp(-np.arange(L) / (L / 5)) * rng.uniform(0.1, 0.6)
    return x


def glass_clink():
    d = 2.2
    t = tt(d)
    x = np.zeros(len(t))
    for f0, g in ((1830, 1.0), (1905, 0.8)):
        for r, a, k in ((1, 1, 2.2), (2.32, 0.5, 3.5), (4.25, 0.3, 5), (6.63, 0.15, 7)):
            x += g * a * np.sin(2 * np.pi * f0 * r * t + rng.random() * 6) * np.exp(-t * k)
    x += filt(noise(d), "high", 4000) * np.exp(-t * 200) * 0.8
    return x * 0.35


def clang():
    d = 2.5
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in ((182, 1, 2.5), (437, 0.6, 3.5), (721, 0.45, 4.5), (1093, 0.3, 6), (1650, 0.2, 8))) * 0.4


def ember_pop(f):
    d = 0.5
    t = tt(d)
    return filt(noise(d), "band", [600, 4000]) * np.exp(-t * 60) * 0.5 + bell(f, d, 0.35)


# ───────────────────────── arreglo ─────────────────────────
B = 0.5  # 120 BPM
D1, F1, A1, AS1, C2 = 36.71, 43.65, 55.0, 58.27, 65.41

def mus_hits():
    # intro: tensión
    place(MUS, filt(noise(1.2), "low", 120) * np.linspace(0, 1, int(1.2 * SR)) ** 2 * 0.8, 0.0)
    place(MUS, pad([73.42, 110.0], 3.2, 0.9, cutoff=500, att=1.2, rel=0.5), 0.0)
    # 1.0–3.0 tambores graves (taiko)
    for t0, f, g in ((1.0, 82, 0.9), (1.5, 70, 0.7), (1.75, 70, 0.5), (2.5, 82, 0.6), (2.75, 95, 0.5)):
        place(MUS, tom(f, g), t0)
    place(MUS, reverb(boom(2.4), 2.2, 0.35), 2.0, 1.1)
    for k in range(8):
        place(MUS, hat(0.25 + 0.05 * k), 2.0 + k * 0.125 + 0.0625, pan=0.3 * (-1) ** k)
    for k in range(8):
        place(MUS, snare(0.15 + 0.08 * k, 0.15), 2.5 + k * 0.0625)
    place(MUS, riser(1.0, 400, 7000, 0.35), 2.0)

    # 3.0–8.0 groove
    kicks = [3.0, 3.75, 4.0, 5.0, 5.75, 6.0, 7.0, 7.375, 7.5]
    for k in kicks:
        place(MUS, kick(1.0), k)
    for s in (3.5, 4.5, 5.5, 6.5, 7.5):
        place(MUS, reverb(add(clap(0.8), snare(0.5)), 0.9, 0.25), s)
    for k in range(40):
        t0 = 3.0 + k * 0.125
        acc = 0.55 if k % 2 == 0 else 0.3
        place(MUS, hat(acc), t0, pan=0.25)
    for k in range(8):  # redoble hacia el 8.0
        place(MUS, snare(0.2 + 0.1 * k, 0.12), 7.5 + k * 0.0625)
    bass_notes = [(3.0, D1, 0.7), (3.75, D1, 0.25), (4.0, D1, 0.95), (5.0, AS1, 0.7), (5.75, AS1, 0.25), (6.0, AS1, 0.95), (7.0, C2, 0.45), (7.5, C2, 0.5)]
    for t0, f, d in bass_notes:
        place(MUS, bass808(f, d, 0.9), t0)
    place(MUS, pad([146.83, 174.61, 220.0, 293.66], 2.0, 0.7, cutoff=1500), 3.0)
    place(MUS, pad([116.54, 146.83, 174.61, 233.08], 2.0, 0.7, cutoff=1500), 5.0)
    place(MUS, pad([130.81, 164.81, 196.0, 261.63], 1.0, 0.7, cutoff=1900), 7.0)
    place(MUS, riser(1.0, 300, 8000, 0.4), 7.0)

    # 8.0–9.25 brindis (más cálido)
    place(MUS, reverb(boom(1.6, 80, 32), 1.8, 0.3), 8.0, 0.8)
    place(MUS, kick(1.0), 8.0)
    for t0 in (8.42, 8.67, 8.92):
        place(MUS, reverb(add(clap(0.7), tom(120, 0.6)), 1.0, 0.3), t0)
    for k in range(10):
        place(MUS, hat(0.35), 8.0 + k * 0.125, pan=-0.25)
    place(MUS, pad([174.61, 220.0, 261.63, 349.23], 1.3, 0.8, cutoff=2200, att=0.1), 8.0)
    place(MUS, bass808(F1 * 2, 1.2, 0.8), 8.0)

    # 9.25–10.25 carta: kicks entrecortados
    for i, t0 in enumerate((9.25, 9.5, 9.75, 10.0)):
        place(MUS, kick(0.9), t0)
        place(MUS, hat(0.5, True), t0 + 0.125)
        place(MUS, bass808([D1, F1, A1, AS1][i] * 2, 0.24, 0.7), t0)
    place(MUS, pad([146.83, 174.61, 220.0, 293.66], 1.0, 0.6, cutoff=2600, att=0.05), 9.25)

    # 10.25–12.0 mapa: construcción
    place(MUS, kick(1.0), 10.25)
    place(MUS, reverb(clap(0.8), 1.0, 0.3), 10.75)
    for t0 in (10.75, 11.25):
        place(MUS, kick(0.9), t0)
    for k in range(14):
        place(MUS, hat(0.3 + 0.02 * k), 10.25 + k * 0.125, pan=0.2)
    # redoble que se acelera
    t0, step = 11.0, 0.125
    while t0 < 11.97:
        place(MUS, snare(0.25 + 0.6 * (t0 - 11.0), 0.12), t0)
        t0 += step
        step = max(0.03, step * 0.86)
    place(MUS, riser(1.75, 250, 9000, 0.5), 10.25)
    place(MUS, pad([146.83, 220.0, 293.66, 349.23], 1.75, 0.6, cutoff=2000), 10.25)
    place(MUS, bass808(D1 * 2, 1.7, 0.7), 10.25)

    # 12.0 impacto + 12.9 sello + acorde final
    place(MUS, reverb(boom(2.5, 100, 30), 2.5, 0.4), 12.0, 1.0)
    place(MUS, kick(1.0), 12.0)
    suck = riser(0.9, 200, 5000, 0.5)
    place(MUS, suck, 12.0)
    place(MUS, reverb(boom(3.0, 110, 26), 3.0, 0.45), STAMP, 1.3)
    place(MUS, kick(1.2, 170, 40, 0.6), STAMP)
    place(MUS, pad([73.42, 146.83, 220.0, 293.66, 329.63, 440.0], 2.1, 0.9, cutoff=2400, att=0.25, rel=0.9), STAMP)
    place(MUS, bass808(D1, 2.0, 1.0), STAMP)
    place(MUS, reverb(bell(587.33, 1.6, 0.25) + bell(880, 1.6, 0.15), 2.0, 0.5), 13.95)


STAMP = 12.9


def sfx():
    place(SFX, filt(noise(0.6), "high", 5000) * np.linspace(0, 1, int(0.6 * SR)) * 0.04, 0.0)
    place(SFX, reverb(flint(), 1.0, 0.3), 0.55, 0.9)
    place(SFX, ignition(), 0.60, 1.0)
    cr = crackle(2.5, 40, 0.5)
    cr *= np.minimum(tt(2.5) / 0.4, 1)
    place(SFX, cr, 0.6, 0.8, pan=-0.2)
    # la carne cae: golpe húmedo + chisporroteo intenso
    place(SFX, slap(), 1.99, 1.0)
    sz = sizzle(2.2, 1.0) * np.exp(-tt(2.2) * 0.9)
    place(SFX, sz, 2.0, 0.9, pan=0.1)
    place(SFX, whoosh(0.25, 300, 2500, 0.6), 1.78)
    # corte
    place(SFX, knife_swish(), 2.95, 0.8, pan=0.4)
    place(SFX, knife_scrape(0.8), 3.15, 0.6)
    place(SFX, reverb(chop(), 0.8, 0.2), 4.0, 1.0)
    place(SFX, sizzle(1.0, 0.25) * np.linspace(1, 0, SR), 4.0)
    place(SFX, salt_grains(1.7, 120), 4.35, 0.5, pan=-0.2)
    place(SFX, salt_grains(1.2, 90), 4.8, 0.45, pan=0.3)
    # humo → tipografía
    place(SFX, whoosh(1.0, 200, 1400, 0.5, 2.0), 6.0, pan=-0.2)
    place(SFX, crackle(2.0, 25, 0.35), 6.0)
    place(SFX, reverb(add(boom(0.9, 70, 35) * 0.4, whoosh(0.25, 1000, 6000, 0.6)), 1.2, 0.35), 6.92)
    # brindis
    place(SFX, whoosh(0.3, 500, 3000, 0.4), 8.0, pan=-0.5)
    place(SFX, whoosh(0.3, 500, 3000, 0.4), 8.0, pan=0.5)
    place(SFX, reverb(glass_clink(), 1.6, 0.35), 8.30, 1.0)
    # carta: barridos
    for t0 in (9.22, 9.47, 9.72, 9.97):
        place(SFX, whoosh(0.16, 800, 5000, 0.6), t0, pan=0.4)
    # mapa: ciudades y locales
    for t0, f in ((10.45, 587.33), (10.7, 698.46), (10.95, 880.0), (11.2, 1174.66)):
        place(SFX, reverb(ember_pop(f), 1.2, 0.35), t0, 0.8)
    for i in range(15):
        place(SFX, filt(noise(0.05), "band", [2000, 8000]) * np.exp(-tt(0.05) * 90) * 0.4, 10.5 + i * 0.055, pan=np.sin(i))
    # sello: vórtice, golpe, metal, vapor
    place(SFX, whoosh(0.9, 150, 2500, 0.6, 2.5), 12.0)
    place(SFX, reverb(clang(), 2.0, 0.35), STAMP, 0.8)
    place(SFX, slap(), STAMP, 0.8)
    st = sizzle(1.6, 1.0) * np.exp(-tt(1.6) * 1.6)
    place(SFX, st, STAMP + 0.02, 0.9)
    place(SFX, filt(noise(1.2), "band", [1500, 9000]) * np.exp(-tt(1.2) * 3) * 0.25, STAMP + 0.05)
    place(SFX, crackle(2.0, 15, 0.25) * np.minimum(tt(2.0) / 0.5, 1), 13.0)


def vo(dirpath):
    meta = json.load(open(f"{dirpath}/vo_lines.json"))
    for L in meta["lines"]:
        x, sr = sf.read(f"{dirpath}/{L['file']}")
        assert sr == SR
        place(VOX, reverb(x, 0.7, 0.12, tone=6000), L["start"], 1.0)


def main(vo_dir, out):
    mus_hits()
    sfx()
    vo(vo_dir)
    # ducking de música bajo la voz
    env = np.abs(VOX).mean(0)
    env = signal.sosfiltfilt(signal.butter(2, 6, fs=SR, output="sos"), env)
    env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    duck = 1 - 0.62 * env
    mix = MUS * 0.5 * duck + SFX * 1.1 * (1 - 0.35 * env) + VOX * 2.6
    mix[:, -int(0.25 * SR):] *= np.linspace(1, 0.0, int(0.25 * SR)) ** 0.5
    g = 1.3 / (np.abs(mix).max() + 1e-9)
    mix = sat(mix * g, 1.2) * 0.9
    tmp = out + ".raw.wav"
    sf.write(tmp, mix.T, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af",
                    "loudnorm=I=-14:TP=-1.0:LRA=9:linear=true,aresample=48000", "-c:a", "pcm_s24le", out], check=True)
    # pistas separadas (con la misma ganancia que en la mezcla) por si quieren remezclar
    for name, b in (("music", MUS * 0.5 * duck), ("sfx", SFX * 1.1 * (1 - 0.35 * env)), ("vo", VOX * 2.6)):
        sf.write(out.replace(".wav", f"_{name}.wav"), np.clip(b * g * 0.9, -1, 1).T, SR, subtype="PCM_24")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
