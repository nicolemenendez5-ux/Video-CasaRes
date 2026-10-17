/* Casa RES — "Sellamos tus recuerdos" · motion graphic 15 s
 *
 * Todo el video es una función pura del tiempo: renderFrame(t) dibuja el
 * cuadro t (segundos) sin estado previo, así que se puede renderizar en
 * cualquier orden y el resultado es determinista.
 * Parámetros URL: ?w=1080&h=1920 (9:16) · ?w=1920&h=1080 (16:9)
 */
'use strict';

// ───────────────────────────── setup ─────────────────────────────
const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920);
const PORT = H >= W;
const U = Math.min(W, H) / 1080;
const FPS = 30, DUR = 15;

const COL = {
  black: '#0A0706', char: '#17110E', ember: '#E8571B', amber: '#F29F2E',
  gold: '#D8B46A', goldHi: '#F4D9A0', red: '#DC2C16', cream: '#FEF9EB',
  wine: '#3D0A0F', ink: '#2B2B2B',
};

const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const S = mk(), sctx = S.getContext('2d');   // escena
const P = mk(), pctx = P.getContext('2d');   // capa de foto (para distorsión de calor / corte)

// ───────────────────────────── math ─────────────────────────────
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sstep = (t, a, b) => { const x = ramp(t, a, b); return x * x * (3 - 2 * x); };
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const TAU = Math.PI * 2;

function rnd(i, k = 0) {
  let h = Math.imul((i | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((k | 0) + 0x632BE5AB, 0xC2B2AE35);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(rnd(i, seed), rnd(i + 1, seed), u) * 2 - 1;
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixRGB(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ───────────────────────────── sprites ─────────────────────────────
function glow(r, col, stops = [[0, 1], [0.35, 0.55], [1, 0]]) {
  const c = mk(r * 2, r * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, a] of stops) gr.addColorStop(o, rgba(col, a));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
const FIRE_RAMP = [[0, [255, 250, 230]], [.14, [255, 222, 150]], [.32, [255, 168, 60]], [.55, [240, 96, 24]], [.78, [176, 38, 12]], [1, [60, 10, 6]]];
function fireRGB(h) {
  h = clamp(h);
  for (let i = 1; i < FIRE_RAMP.length; i++) if (h <= FIRE_RAMP[i][0]) {
    const [a, ca] = FIRE_RAMP[i - 1], [b, cb] = FIRE_RAMP[i];
    return mixRGB(ca, cb, (h - a) / (b - a));
  }
  return FIRE_RAMP[FIRE_RAMP.length - 1][1];
}
const FIRE = Array.from({ length: 20 }, (_, i) => glow(48, fireRGB(i / 19)));
const fireSpr = h => FIRE[clamp(Math.round(h * 19), 0, 19)];
const EMBER = glow(24, [255, 190, 110], [[0, 1], [0.15, 0.9], [0.4, 0.25], [1, 0]]);
const SOFT = glow(64, [255, 255, 255], [[0, 1], [0.5, 0.4], [1, 0]]);
const GOLDGLOW = glow(64, [244, 200, 120], [[0, 0.9], [0.3, 0.35], [1, 0]]);

const SMOKE = Array.from({ length: 4 }, (_, v) => {
  const r = 96, c = mk(r * 2, r * 2), g = c.getContext('2d');
  for (let k = 0; k < 22; k++) {
    const a = rnd(k, v * 13) * TAU, d = rnd(k, v * 13 + 1) * r * 0.45, rr = r * (0.25 + 0.3 * rnd(k, v * 13 + 2));
    const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(200,190,180,0.22)'); gr.addColorStop(1, 'rgba(200,190,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  }
  return c;
});

const BOKEH = (() => {
  const r = 64, c = mk(r * 2, r * 2), g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,190,120,0.35)'); gr.addColorStop(0.82, 'rgba(255,170,90,0.45)');
  gr.addColorStop(0.92, 'rgba(255,200,140,0.7)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
})();

// granos de sal: 6 formas × 3 desenfoques
const SALT = (() => {
  const out = [];
  for (let s = 0; s < 6; s++) {
    const row = [];
    for (const blur of [0, 2.5, 7]) {
      const r = 48, c = mk(r * 2, r * 2), g = c.getContext('2d');
      g.filter = blur ? `blur(${blur}px)` : 'none';
      g.translate(r, r);
      const pts = [];
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rnd(k, s) * 0.5; const d = 16 + rnd(k, s + 9) * 10; pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.85]); }
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      g.fillStyle = '#d8d2c8'; g.fill();
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(0, 0); g.closePath();
      g.fillStyle = '#ffffff'; g.fill();
      g.beginPath(); g.moveTo(pts[3][0], pts[3][1]); g.lineTo(pts[4][0], pts[4][1]); g.lineTo(0, 0); g.closePath();
      g.fillStyle = '#a69f95'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(0, 0); g.lineTo(pts[2][0], pts[2][1]); g.stroke();
      row.push(c);
    }
    out.push(row);
  }
  return out;
})();

const GRAIN = Array.from({ length: 6 }, (_, v) => {
  const n = 384, c = mk(n, n), g = c.getContext('2d'), im = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const x = rnd(i, v + 77) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = x; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
});

function spr(g, img, x, y, s, a = 1, rot = 0, sx = 1, sy = 1) {
  if (a <= 0.003 || s <= 0.2) return;
  g.globalAlpha = Math.min(a, 1);
  if (!rot && sx === 1 && sy === 1) g.drawImage(img, x - s, y - s, s * 2, s * 2);
  else { g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.drawImage(img, -s, -s, s * 2, s * 2); g.restore(); }
}

// ───────────────────────────── assets ─────────────────────────────
const K = 3; // las fotos están reescaladas x3; las coordenadas abajo son de la foto original
const IMG = {};
function loadImg(name, src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[name] = i; res(); }; i.onerror = rej; i.src = src; }); }
// zonas de las capturas libres de la interfaz web (menú, flechas, tarjeta)
const SAFE = { steak: [60, 88, 1360, 372], interior: [0, 0, 795, 598] };

/** dibuja la foto con el punto (fx,fy) [px originales] en el centro del cuadro + (ox,oy) */
function photo(g, name, fx, fy, scale, o = {}) {
  const img = IMG[name], [sx, sy, sw, sh] = o.src || SAFE[name];
  const s = scale * U;
  g.save();
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.filter) g.filter = o.filter;
  g.translate(W / 2 + (o.ox || 0), H / 2 + (o.oy || 0));
  if (o.rot) g.rotate(o.rot);
  g.scale(s, s);
  g.drawImage(img, sx * K, sy * K, sw * K, sh * K, sx - fx, sy - fy, sw, sh);
  g.restore();
}

// ───────────────────────────── texto ─────────────────────────────
const F = {
  bc: (sz, w = 800) => `${w} ${sz}px "Barlow Condensed"`,
  ms: (sz, w = 600) => `${w} ${sz}px "Montserrat"`,
  pf: (sz, w = 700) => `italic ${w} ${sz}px "Playfair Display"`,
};
function goldFill(g, x0, y0, x1, y1, t = 0) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const sh = (t * 0.6) % 1;
  gr.addColorStop(0, '#8C6A2E'); gr.addColorStop(clamp(sh - 0.15), '#C9A055');
  gr.addColorStop(sh, '#FFF1CC'); gr.addColorStop(clamp(sh + 0.15), '#D9B66A'); gr.addColorStop(1, '#9C7633');
  return gr;
}
function emberFill(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#FFE6A8'); gr.addColorStop(0.35, '#F7A43A'); gr.addColorStop(0.7, '#E8571B'); gr.addColorStop(1, '#B3260F');
  return gr;
}
function txt(g, s, x, y, font, fill, o = {}) {
  g.save();
  g.font = font; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
  g.letterSpacing = (o.ls || 0) + 'px';
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  // rotación/escala alrededor de (x,y); los degradados usan coordenadas absolutas
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  if (o.scale) g.scale(o.scale, o.scale);
  g.translate(-x, -y);
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.glowR || 30 * U; }
  g.fillStyle = typeof fill === 'function' ? fill(g) : fill;
  g.fillText(s, x, y);
  g.restore();
}
/** texto que entra letra a letra (desde abajo, con fade) */
function txtLetters(g, s, x, y, font, fill, t0, t, o = {}) {
  g.save(); g.font = font; g.letterSpacing = (o.ls || 0) + 'px';
  const total = g.measureText(s).width;
  g.restore();
  let cx = o.align === 'left' ? x : x - total / 2;
  const stag = o.stag || 0.03, dur = o.dur || 0.35;
  for (let i = 0; i < s.length; i++) {
    g.save(); g.font = font; g.letterSpacing = (o.ls || 0) + 'px';
    const ch = s[i], w = g.measureText(ch).width;
    g.restore();
    const p = eOutCubic(ramp(t, t0 + i * stag, t0 + i * stag + dur));
    if (p > 0 && ch !== ' ') {
      txt(g, ch, cx, y + (1 - p) * (o.rise || 40 * U), font, fill, { align: 'left', alpha: p * (o.alpha == null ? 1 : o.alpha), glow: o.glow, glowR: o.glowR });
    }
    cx += w;
  }
}
function measure(s, font, ls = 0) { sctx.save(); sctx.font = font; sctx.letterSpacing = ls + 'px'; const w = sctx.measureText(s).width; sctx.restore(); return w; }

/** puntos dentro de un texto (para que el humo/las brasas formen letras) */
function samplePoints(draw, step) {
  const c = mk(), g = c.getContext('2d');
  draw(g);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
  return pts;
}

// ───────────────────────────── sistemas de partículas (sin estado) ─────────────────────────────
/** fuego: emisores en una línea horizontal; active(x, tSpawn) ∈ [0,1] */
function fire(g, t, o) {
  const E = o.E, rate = o.rate || 26, l0 = o.life0 || 0.55, l1 = o.life1 || 1.1;
  const dt = 1 / rate, ht = o.height, sz = o.size || 46 * U;
  g.globalCompositeOperation = 'lighter';
  for (let e = 0; e < E; e++) {
    const ex = lerp(o.x0, o.x1, (e + 0.5) / E) + (rnd(e, o.seed) - 0.5) * (o.x1 - o.x0) / E;
    const j0 = Math.floor((t - l1) / dt), j1 = Math.floor(t / dt);
    for (let j = j0; j <= j1; j++) {
      const id = e * 7919 + j;
      const ts = j * dt + rnd(id, o.seed + 1) * dt, age = t - ts;
      if (age < 0) continue;
      const life = lerp(l0, l1, rnd(id, o.seed + 2));
      if (age > life) continue;
      const act = o.active ? o.active(ex, ts) : 1;
      if (act <= 0) continue;
      const u = age / life;
      const vy = (0.55 + 0.7 * rnd(id, o.seed + 3)) * ht / life;
      const x = ex + (rnd(id, o.seed + 4) - 0.5) * sz * 1.2 + Math.sin(age * 7 + rnd(id, o.seed + 5) * TAU) * sz * 0.5 * u + (o.wind || 0) * u;
      const y = o.y - vy * age * (0.8 + 0.5 * u);
      const s = sz * (0.55 + 0.75 * rnd(id, o.seed + 6)) * act * (u < 0.18 ? lerp(0.55, 1, u / 0.18) : lerp(1, 0.2, (u - 0.18) / 0.82));
      const h = u * 1.05 + (rnd(id, o.seed + 7) - 0.5) * 0.18 + (o.heat || 0);
      spr(g, fireSpr(h), x, y, s, Math.pow(1 - u, 0.6) * act * (o.alpha || 1), 0, 0.85, 1.7);
    }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function embers(g, t, o) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < o.n; i++) {
    const life = 1.6 + rnd(i, o.seed) * 2.6, ph = rnd(i, o.seed + 1) * life;
    const cyc = Math.floor((t + ph) / life), age = (t + ph) - cyc * life, u = age / life;
    const x = lerp(o.x0, o.x1, rnd(i * 31 + cyc, o.seed + 2)) + Math.sin(age * (1 + rnd(i, 5) * 2) + i) * 40 * U + (o.wind || 0) * u;
    const y = lerp(o.y1, o.y0, u * (0.6 + 0.6 * rnd(i, o.seed + 3)));
    const fl = 0.55 + 0.45 * Math.sin(t * (14 + rnd(i, 6) * 18) + i * 2.3);
    spr(g, EMBER, x, y, (o.size || 9 * U) * (0.4 + rnd(i, o.seed + 4)), Math.sin(Math.PI * u) * fl * (o.alpha || 1));
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function smoke(g, t, o) {
  g.globalCompositeOperation = o.blend || 'screen';
  for (let i = 0; i < o.n; i++) {
    const life = o.life * (0.7 + 0.6 * rnd(i, o.seed)), ph = rnd(i, o.seed + 1) * life;
    const cyc = Math.floor((t + ph) / life), age = (t + ph) - cyc * life, u = age / life;
    const x = lerp(o.x0, o.x1, rnd(i * 13 + cyc, o.seed + 2)) + noise(age * 0.8 + i, 3) * 60 * U + (o.wind || 0) * u;
    const y = o.y - u * o.rise * (0.6 + 0.6 * rnd(i, o.seed + 3));
    const s = o.size * (0.5 + u * 1.4) * (0.7 + 0.6 * rnd(i, o.seed + 4));
    spr(g, SMOKE[i % 4], x, y, s, Math.sin(Math.PI * u) * o.alpha, age * 0.3 * (rnd(i, 9) - 0.5) + i);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function sparks(g, t, t0, x, y, o) {
  const age = t - t0; if (age < 0 || age > 1.4) return;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < o.n; i++) {
    const a = o.up ? -Math.PI / 2 + (rnd(i, o.seed) - 0.5) * (o.spread || 2.4) : rnd(i, o.seed) * TAU;
    const v = o.speed * U * (0.25 + 0.75 * Math.pow(rnd(i, o.seed + 1), 1.5));
    const life = (o.life || 0.9) * (0.35 + 0.65 * rnd(i, o.seed + 2));
    if (age > life) continue;
    const u = age / life, dr = 3.2;
    const pos = tt => { const d = v * (1 - Math.exp(-tt * dr)) / dr; return [x + Math.cos(a) * d, y + Math.sin(a) * d + 0.5 * (o.grav || 900) * U * tt * tt]; };
    const [px, py] = pos(age), [qx, qy] = pos(Math.max(0, age - 0.035));
    const c = fireRGB(u * 0.7 + (o.cool || 0));
    g.strokeStyle = rgba(c, (1 - u)); g.lineWidth = (o.w || 3) * U * (1 - u * 0.5);
    g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}
function ring(g, t, t0, x, y, r0, r1, dur, col, w) {
  const u = ramp(t, t0, t0 + dur); if (u <= 0 || u >= 1) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.strokeStyle = rgba(col, (1 - u) * 0.8); g.lineWidth = w * (1 - u) + 1;
  g.beginPath(); g.arc(x, y, lerp(r0, r1, eOutCubic(u)), 0, TAU); g.stroke(); g.restore();
}
function vgrad(g, y0, y1, c0, c1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); }
function radial(g, x, y, r, col, a, blend = 'lighter') {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = blend;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
/** distorsión de calor: copia P a g en franjas con desplazamiento */
function heatShimmer(g, t, amp, yFrom = 0) {
  const step = Math.max(4, Math.round(6 * U));
  for (let y = 0; y < H; y += step) {
    const k = clamp((y - yFrom) / (H - yFrom));
    const off = (Math.sin(y * 0.045 / U + t * 9) * 0.6 + noise(y * 0.02 / U + t * 3, 11) * 0.8) * amp * U * k;
    g.drawImage(P, 0, y, W, step, off, y, W, step);
  }
}

// ═════════════════════════════ ESCENA 1 · 0–3 s · el fuego ═════════════════════════════
const S1 = { spark: 0.55, ign: 0.62, drop0: 1.80, drop: 2.0 };
function grill(g, t, gy, lit) {
  if (lit <= 0) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const k = i / 6, y = gy + 18 * U + Math.pow(k, 1.6) * (H - gy) * 0.95;
    const wdt = (6 + 20 * k) * U, spread = 0.18 + k * 0.5;
    const gr = g.createLinearGradient(0, y - wdt / 2, 0, y + wdt / 2);
    gr.addColorStop(0, rgba([255, 150, 60], 0.85 * lit)); gr.addColorStop(0.3, rgba([90, 30, 12], lit)); gr.addColorStop(1, rgba([8, 5, 4], lit));
    g.strokeStyle = gr; g.lineWidth = wdt;
    g.beginPath(); g.moveTo(W * (0.5 - 0.5 - spread), y); g.lineTo(W * (1 + spread), y); g.stroke();
  }
  g.restore();
}
function scene1(g, t) {
  const gy = PORT ? H * 0.70 : H * 0.76;
  const cx = W / 2;
  const front = tt => eOutCubic(ramp(tt, S1.ign, 1.45)) * W * 0.85;
  const ign = eOutCubic(ramp(t, S1.ign, 1.3));
  const big = sstep(t, 0.9, 1.75);
  const tf = t * 0.62; // fuego en cámara lenta

  // brasa solitaria antes de la chispa
  if (t < S1.spark + 0.1) {
    const a = (0.25 + 0.75 * ramp(t, 0, 0.5)) * (1 - ramp(t, S1.spark, S1.spark + 0.1));
    radial(g, cx, gy, 26 * U, [255, 130, 50], 0.6 * a);
    spr(g, EMBER, cx + Math.sin(t * 3) * 4 * U, gy, 10 * U, a * (0.7 + 0.3 * Math.sin(t * 40)));
    g.globalAlpha = 1;
  }

  const afterDrop = t >= S1.drop;
  if (!afterDrop) {
    // resplandor + parrilla + fuego
    radial(g, cx, gy, W * (0.25 + 0.75 * ign), [232, 87, 27], 0.42 * ign + 0.15 * big);
    radial(g, cx, gy - H * 0.1, W * 0.9, [180, 50, 15], 0.18 * big);
    fire(g, tf, {
      x0: -0.1 * W, x1: 1.1 * W, y: gy, E: PORT ? 18 : 28, seed: 10, rate: 30,
      height: lerp(0.18, PORT ? 0.40 : 0.5, big) * H, size: lerp(38, 60, big) * U,
      active: (x, ts) => clamp((front(ts / 0.62) - Math.abs(x - cx)) / (90 * U)),
    });
    grill(g, t, gy, ign);
    fire(g, tf + 3, {
      x0: -0.05 * W, x1: 1.05 * W, y: gy + 70 * U, E: PORT ? 10 : 16, seed: 40, rate: 18,
      height: 0.12 * H, size: 30 * U, alpha: 0.8,
      active: (x, ts) => clamp((front(ts / 0.62 - 3 / 0.62) - Math.abs(x - cx)) / (90 * U)),
    });
  }
  // chispa del encendido
  radial(g, cx, gy, 220 * U, [255, 230, 180], 1.2 * Math.exp(-Math.max(0, t - S1.spark) * 9) * (t >= S1.spark ? 1 : 0));
  sparks(g, t, S1.spark, cx, gy, { n: 80, seed: 3, speed: 1100, up: true, spread: 2.8, life: 0.75, w: 3.2 });

  // la carne cae sobre la brasa
  if (t >= S1.drop0) {
    const sc = PORT ? 2.4 : 2.05;
    const fx = PORT ? 690 : 720, fy = 262;
    const u = ramp(t, S1.drop0, S1.drop);
    const fall = (1 - eInCubic(u)) * -H * 0.95;
    const settle = afterDrop ? Math.sin((t - S1.drop) * 22) * Math.exp(-(t - S1.drop) * 9) * 16 * U : 0;
    const push = afterDrop ? 1 + 0.07 * eOutCubic(ramp(t, S1.drop, 3.0)) : 1;
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.globalCompositeOperation = 'source-over';
    pctx.clearRect(0, 0, W, H);
    const draw = (oy, a) => photo(pctx, 'steak', fx - (afterDrop ? (t - S1.drop) * 14 : 0), fy, sc * push, { oy: oy + settle, alpha: a });
    if (!afterDrop) { for (let k = 4; k >= 0; k--) draw(fall - k * 70 * U * (u + 0.2), k ? 0.18 : 1); }
    else draw(0, 1);
    // calado arriba/abajo de la franja de foto
    const bandH = SAFE.steak[3] * sc * push * U, top = H / 2 - (fy - SAFE.steak[1]) * sc * push * U + fall + settle;
    pctx.globalAlpha = 1; pctx.globalCompositeOperation = 'destination-out';
    const fade = 150 * U;
    let gr = pctx.createLinearGradient(0, top, 0, top + fade); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    pctx.fillStyle = gr; pctx.fillRect(0, top - 2, W, fade + 2);
    gr = pctx.createLinearGradient(0, top + bandH - fade * 1.4, 0, top + bandH); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000');
    pctx.fillStyle = gr; pctx.fillRect(0, top + bandH - fade * 1.4, W, fade * 1.4 + 2);
    pctx.globalCompositeOperation = 'source-over';
    if (afterDrop) heatShimmer(g, t, 5, H * 0.25); else g.drawImage(P, 0, 0);
    // luz de brasa desde abajo
    if (afterDrop) {
      g.save(); g.globalCompositeOperation = 'soft-light';
      vgrad(g, H * 0.35, H, 'rgba(255,120,40,0)', 'rgba(255,120,40,0.55)'); g.restore();
    }
  }
  if (afterDrop) {
    const pb = PORT ? H * 0.80 : H * 0.92;
    radial(g, cx, pb, W * 0.8, [232, 87, 27], 0.35);
    fire(g, tf, { x0: -0.1 * W, x1: 1.1 * W, y: pb + 60 * U, E: PORT ? 16 : 26, seed: 10, rate: 28, height: (PORT ? 0.26 : 0.32) * H, size: 54 * U });
    smoke(g, t, { n: 16, seed: 21, x0: W * 0.2, x1: W * 0.8, y: H * 0.52, rise: H * 0.45, life: 1.6, size: 110 * U, alpha: 0.30 });
    sparks(g, t, S1.drop, cx, H * 0.56, { n: 70, seed: 8, speed: 1300, up: true, spread: 2.6, life: 0.9, w: 2.6 });
    radial(g, cx, H * 0.56, 500 * U, [255, 200, 120], 0.55 * Math.exp(-(t - S1.drop) * 8));
  }
  embers(g, t, { n: 46, seed: 2, x0: 0, x1: W, y0: -0.05 * H, y1: H * 0.85, size: 8 * U, alpha: 0.4 + 0.6 * ign });

  // firma de marca
  const ea = sstep(t, 2.12, 2.4) * (1 - sstep(t, 2.88, 3.0));
  if (ea > 0) {
    const y = PORT ? H * 0.115 : H * 0.1;
    txt(g, 'CASA RES', cx, y, F.bc(48 * U, 700), goldFill(g, cx - 120 * U, 0, cx + 120 * U, 0, t), { ls: 14 * U, alpha: ea });
    const lw = 90 * U * eOutCubic(ramp(t, 2.12, 2.6));
    g.save(); g.globalAlpha = ea; g.strokeStyle = COL.gold; g.lineWidth = 1.5 * U;
    g.beginPath(); g.moveTo(cx - 170 * U - lw, y); g.lineTo(cx - 170 * U, y); g.moveTo(cx + 170 * U, y); g.lineTo(cx + 170 * U + lw, y); g.stroke(); g.restore();
    txt(g, 'MAESTROS DE LA PARRILLA', cx, y + 56 * U, F.ms(26 * U, 500), COL.cream, { ls: 8 * U, alpha: ea * 0.8 });
  }
}

// ═════════════════════════════ ESCENA 2a · 3–5 s · el corte ═════════════════════════════
function knifeShape(g, Lb) {
  // hoja: lomo arriba (y<0), filo abajo (y>0), punta en +x
  g.beginPath();
  g.moveTo(0, -46 * U);
  g.lineTo(Lb * 0.74, -46 * U);
  g.quadraticCurveTo(Lb * 0.94, -44 * U, Lb, -30 * U);
  g.quadraticCurveTo(Lb * 0.86, 46 * U, Lb * 0.55, 56 * U);
  g.lineTo(0, 56 * U);
  g.closePath();
}
function knife(g, x, y, ang, t, blurA = 0) {
  const Lb = 640 * U;
  g.save(); g.translate(x, y); g.rotate(ang);
  // mango
  g.fillStyle = '#120c09';
  g.beginPath(); g.roundRect(-330 * U, -38 * U, 300 * U, 80 * U, 26 * U); g.fill();
  const hg = g.createLinearGradient(0, -38 * U, 0, 42 * U); hg.addColorStop(0, 'rgba(255,200,140,0.18)'); hg.addColorStop(0.4, 'rgba(0,0,0,0)');
  g.fillStyle = hg; g.beginPath(); g.roundRect(-330 * U, -38 * U, 300 * U, 80 * U, 26 * U); g.fill();
  g.fillStyle = COL.gold;
  for (const rx of [-280, -190, -100]) { g.beginPath(); g.arc(rx * U, 2 * U, 8 * U, 0, TAU); g.fill(); }
  // virola
  const bg = g.createLinearGradient(0, -50 * U, 0, 60 * U); bg.addColorStop(0, '#5b5f63'); bg.addColorStop(0.5, '#d9dde0'); bg.addColorStop(1, '#3d4044');
  g.fillStyle = bg; g.beginPath(); g.roundRect(-36 * U, -50 * U, 40 * U, 108 * U, 8 * U); g.fill();
  // hoja
  knifeShape(g, Lb);
  const st = g.createLinearGradient(0, -46 * U, 0, 56 * U);
  st.addColorStop(0, '#3a3e43'); st.addColorStop(0.18, '#a9afb5'); st.addColorStop(0.45, '#e6eaee'); st.addColorStop(0.62, '#8d939a'); st.addColorStop(0.86, '#cfd5da'); st.addColorStop(1, '#ffffff');
  g.fillStyle = st; g.fill();
  // reflejo cálido + brillo que recorre la hoja
  g.save(); knifeShape(g, Lb); g.clip();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(255,120,40,0.55)'; g.fillRect(0, 0, Lb, 60 * U);
  g.globalCompositeOperation = 'lighter';
  const sx = ((t * 1.6) % 1.6 - 0.3) * Lb;
  const sh = g.createLinearGradient(sx - 120 * U, 0, sx + 120 * U, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,245,225,0.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(0, -50 * U, Lb, 110 * U);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2 * U;
  g.beginPath(); g.moveTo(0, 55 * U); g.lineTo(Lb * 0.55, 55 * U); g.quadraticCurveTo(Lb * 0.86, 45 * U, Lb, -30 * U); g.stroke();
  g.restore();
}
const CUT = { ang: -0.17, t0: 3.0, t1: 4.0, split: 4.0 };
function scene2a(g, t) {
  const cx = W / 2, cy = PORT ? H * 0.46 : H * 0.5;
  const ang = CUT.ang, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const R = Math.hypot(W, H) * 0.5 + 900 * U;

  // macro de la cara del corte (rosado, término perfecto)
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1;
  pctx.fillStyle = '#000'; pctx.fillRect(0, 0, W, H);
  const zoom = 1 + 0.06 * ramp(t, 3.0, 5.0);
  photo(pctx, 'steak', (PORT ? 872 : 860) + (t - 3) * 10, PORT ? 272 : 262, (PORT ? 5.3 : 3.45) * zoom);
  pctx.save(); pctx.globalCompositeOperation = 'soft-light';
  pctx.fillStyle = 'rgba(255,110,40,0.35)'; pctx.fillRect(0, 0, W, H); pctx.restore();
  // brillo de jugos
  pctx.save(); pctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const x = W * rnd(i, 300), y = H * (0.15 + 0.7 * rnd(i, 301));
    spr(pctx, SOFT, x, y, (6 + 10 * rnd(i, 302)) * U, 0.35 * (0.5 + 0.5 * Math.sin(t * 6 + i * 2)));
  }
  pctx.restore(); pctx.globalAlpha = 1;
  smoke(pctx, t, { n: 10, seed: 33, x0: 0, x1: W, y: H * 1.05, rise: H * 0.8, life: 2.4, size: 160 * U, alpha: 0.22 });

  // posición de la punta del cuchillo (rampas de velocidad: rápido-lento-rápido)
  const u = ramp(t, CUT.t0, CUT.t1);
  const p = u + 0.85 * Math.sin(TAU * u) / TAU;
  const sTip = lerp(R * 0.62, -R * 0.62 - 700 * U, p);
  const d = (PORT ? 0.15 : 0.17) * H * eOutExpo(ramp(t, CUT.split, CUT.split + 0.5)) + 12 * U * ramp(t, 4.5, 5.0);

  if (d <= 0.5) {
    g.drawImage(P, 0, 0);
    // ranura incandescente por donde ya pasó el filo
    if (t > CUT.t0) {
      const ax = cx + dx * sTip, ay = cy + dy * sTip, bx = cx + dx * R, by = cy + dy * R;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [w, a, c] of [[26, 0.25, [255, 110, 40]], [9, 0.6, [255, 170, 80]], [2.5, 1, [255, 245, 220]]]) {
        g.strokeStyle = rgba(c, a); g.lineWidth = w * U; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      }
      g.restore();
      sparks(g, t, Math.max(CUT.t0 + 0.1, t - 0.25), ax, ay, { n: 6, seed: Math.floor(t * 30), speed: 500, up: true, life: 0.3, w: 2 });
    }
    // cuchillo (+ estela de movimiento en las partes rápidas)
    const vel = Math.abs(1 + 0.85 * Math.cos(TAU * u));
    const kx = cx + dx * sTip, ky = cy + dy * sTip;
    const along = ang + Math.PI;
    for (let k = 3; k >= 1; k--) if (vel > 0.6) { g.save(); g.globalAlpha = 0.12 * vel; knifeAt(g, kx - dx * k * 55 * U * vel, ky - dy * k * 55 * U * vel, along, t); g.restore(); }
    knifeAt(g, kx, ky, along, t);
  } else {
    // el corte se abre: título en el hueco
    g.fillStyle = '#070505'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, cy); g.rotate(ang);
    const gg = g.createLinearGradient(0, -d, 0, d);
    gg.addColorStop(0, 'rgba(232,87,27,0.55)'); gg.addColorStop(0.5, 'rgba(40,14,8,0.0)'); gg.addColorStop(1, 'rgba(232,87,27,0.55)');
    g.fillStyle = gg; g.fillRect(-R, -d, 2 * R, 2 * d);
    g.restore();
    embers(g, t, { n: 30, seed: 71, x0: 0, x1: W, y0: cy - d * 1.5, y1: cy + d * 1.5, size: 7 * U, alpha: 0.8 });
    titleArte(g, t, cx, cy, ang, d);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(nx * d * side, ny * d * side);
      g.beginPath();
      const ex = dx * R, ey = dy * R, ox = nx * R * 2 * side, oy = ny * R * 2 * side;
      g.moveTo(cx - ex, cy - ey); g.lineTo(cx + ex, cy + ey); g.lineTo(cx + ex + ox, cy + ey + oy); g.lineTo(cx - ex + ox, cy - ey + oy); g.closePath();
      g.clip();
      g.drawImage(P, 0, 0);
      // borde caliente del corte
      const hot = 1 - ramp(t, CUT.split, CUT.split + 0.9);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [w, a, c] of [[40, 0.35 * hot + 0.08, [255, 100, 30]], [10, 0.7 * hot + 0.1, [255, 180, 90]], [3, hot, [255, 245, 220]]]) {
        g.strokeStyle = rgba(c, a); g.lineWidth = w * U; g.beginPath(); g.moveTo(cx - ex, cy - ey); g.lineTo(cx + ex, cy + ey); g.stroke();
      }
      g.restore();
    }
    sparks(g, t, CUT.split, cx, cy, { n: 70, seed: 15, speed: 1200, life: 0.8, w: 2.6, grav: 500 });
  }
  // sal fina empieza a caer
  saltLayer(g, t, 4.35, 5.0, 60, 17, false);
  embers(g, t, { n: 24, seed: 19, x0: 0, x1: W, y0: 0, y1: H, size: 7 * U, alpha: 0.6 });
}
function knifeAt(g, x, y, ang, t) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(1, -1);
  // la línea de corte queda cerca del filo
  knife(g, -640 * U, -40 * U, 0, t);
  g.restore();
}
function titleArte(g, t, cx, cy, ang, d) {
  const p = eOutExpo(ramp(t, CUT.split + 0.06, CUT.split + 0.55));
  if (p <= 0) return;
  g.save(); g.translate(cx, cy); g.rotate(ang);
  const s1 = (PORT ? 132 : 118) * U, s2 = (PORT ? 66 : 58) * U;
  const half = Math.max(W, H) * 0.6 * p;
  g.beginPath(); g.rect(-half, -d, half * 2, d * 2); g.clip();
  txt(g, 'El arte', 0, -s1 * 0.32, F.pf(s1, 700), gg => goldFill(gg, -300 * U, 0, 300 * U, 0, t), { scale: lerp(1.15, 1, p) });
  txt(g, 'DE LOS CORTES', 0, s1 * 0.52, F.bc(s2, 800), COL.cream, { ls: lerp(40, 12, p) * U });
  g.restore();
}

// ═════════════════════════════ sal en grano (2a / 2b) ═════════════════════════════
function saltLayer(g, t, t0, t1, n, seed, heavy) {
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const z = rnd(i, seed);                       // profundidad: 0 = cerca
    const ts = lerp(t0, t1, rnd(i, seed + 1)) - (heavy ? 0.4 : 0);
    const age = t - ts; if (age < 0) continue;
    const near = z < 0.14, far = z > 0.72;
    const sz = (near ? 46 + 34 * rnd(i, seed + 2) : far ? 9 + 6 * rnd(i, seed + 2) : 18 + 16 * rnd(i, seed + 2)) * U;
    const vy = (near ? 520 : far ? 140 : 260) * U * (0.8 + 0.4 * rnd(i, seed + 3));
    const x = W * (rnd(i, seed + 4) * 1.1 - 0.05) + Math.sin(age * 2 + i) * 10 * U;
    let y = -60 * U + vy * age;
    let rot = rnd(i, seed + 5) * TAU + age * (rnd(i, seed + 6) - 0.5) * 3;
    const land = heavy && !near && !far ? H * (0.42 + 0.5 * rnd(i, seed + 7)) : Infinity;
    if (y > land) {
      const ta = (y - land) / vy;
      y = land - Math.abs(Math.sin(ta * 18)) * 14 * U * Math.exp(-ta * 7);
      rot = rnd(i, seed + 5) * TAU + (land + 60 * U) / vy * (rnd(i, seed + 6) - 0.5) * 3;
    }
    if (y > H + 80 * U) continue;
    const img = SALT[i % 6][near ? 2 : far ? 1 : 0];
    spr(g, img, x, y, sz, near ? 0.75 : 0.95, rot);
    // destello
    const tw = Math.sin(t * 9 + i * 1.7);
    if (!near && tw > 0.86) {
      const a = (tw - 0.86) / 0.14;
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,248,230,${a})`; g.lineWidth = 1.6 * U;
      const r = sz * 1.8;
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
      spr(g, SOFT, x, y, sz * 0.9, a * 0.6); g.restore();
    }
  }
  g.globalAlpha = 1;
}
function callout(g, t, t0, ax, ay, lx, ly, label, align) {
  const p1 = eOutBack(ramp(t, t0, t0 + 0.2)), p2 = eOutCubic(ramp(t, t0 + 0.08, t0 + 0.32));
  if (p1 <= 0) return;
  g.save();
  g.strokeStyle = COL.gold; g.fillStyle = COL.goldHi; g.lineWidth = 2 * U;
  g.beginPath(); g.arc(ax, ay, 7 * U * p1, 0, TAU); g.fill();
  const pr = (t - t0) % 0.9 / 0.9;
  g.globalAlpha = 1 - pr; g.beginPath(); g.arc(ax, ay, 7 * U + pr * 26 * U, 0, TAU); g.stroke(); g.globalAlpha = 1;
  const ex = lerp(ax, lx, p2), ey = lerp(ay, ly, p2);
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke();
  const tw = measure(label, F.ms(32 * U, 600), 5 * U) + 20 * U;
  const p3 = eOutCubic(ramp(t, t0 + 0.3, t0 + 0.55));
  const hx = lx + (align === 'left' ? -1 : 1) * tw * p3;
  if (p2 >= 1) { g.beginPath(); g.moveTo(lx, ly); g.lineTo(hx, ly); g.stroke(); }
  g.restore();
  const n = Math.floor(label.length * ramp(t, t0 + 0.32, t0 + 0.62));
  if (n > 0) txt(g, label.slice(0, n), align === 'left' ? lx - 10 * U : lx + 10 * U, ly - 26 * U, F.ms(32 * U, 600), COL.cream, { align: align === 'left' ? 'right' : 'left', ls: 5 * U });
}

// ═════════════════════════════ ESCENA 2b · 5–6 s · sal en cámara lenta ═════════════════════════════
function scene2b(g, t) {
  const z = 1 + 0.05 * ramp(t, 5, 6);
  pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.globalAlpha = 1; pctx.fillStyle = '#000'; pctx.fillRect(0, 0, W, H);
  if (PORT) photo(pctx, 'steak', 655, 200, 6.0 * z, { src: [540, 36, 232, 424] });
  else photo(pctx, 'steak', 720 - (t - 5) * 12, 312, 3.6 * z);
  g.drawImage(P, 0, 0);
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,120,50,0.4)'; g.fillRect(0, 0, W, H); g.restore();
  vgrad(g, 0, H * 0.3, 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
  smoke(g, t, { n: 12, seed: 52, x0: 0, x1: W, y: H, rise: H * 0.9, life: 2.2, size: 150 * U, alpha: 0.28 });
  saltLayer(g, t, 4.7, 5.85, 190, 23, true);
  if (PORT) {
    callout(g, t, 5.12, W * 0.30, H * 0.64, W * 0.18, H * 0.53, 'SAL EN GRANO', 'right');
    callout(g, t, 5.32, W * 0.68, H * 0.30, W * 0.80, H * 0.21, 'SELLADO A LA BRASA', 'left');
  } else {
    callout(g, t, 5.12, W * 0.36, H * 0.66, W * 0.24, H * 0.52, 'SAL EN GRANO', 'right');
    callout(g, t, 5.32, W * 0.62, H * 0.34, W * 0.74, H * 0.20, 'SELLADO A LA BRASA', 'left');
  }
  embers(g, t, { n: 22, seed: 29, x0: 0, x1: W, y0: 0, y1: H, size: 7 * U, alpha: 0.6 });
}

// ═════════════════════════════ ESCENA 2c · 6–8 s · el humo se vuelve tipografía ═════════════════════════════
let SMOKE_TXT = null;
const ST = { line1: 'ENCENDEMOS', line2: 'el fuego' };
function stLayout() {
  return PORT
    ? { s1: 168 * U, s2: 150 * U, y1: H * 0.40, y2: H * 0.495 }
    : { s1: 190 * U, s2: 160 * U, y1: H * 0.40, y2: H * 0.585 };
}
function drawSmokeTitle(g, t, crisp) {
  const L = stLayout(), cx = W / 2;
  txt(g, ST.line1, cx, L.y1, F.bc(L.s1, 800), crisp ? (gg => goldFill(gg, cx - 380 * U, 0, cx + 380 * U, 0, t)) : '#fff', { ls: 6 * U });
  txt(g, ST.line2, cx, L.y2, F.pf(L.s2, 700), crisp ? (gg => emberFill(gg, 0, L.y2 - L.s2 * 0.5, 0, L.y2 + L.s2 * 0.4)) : '#fff');
}
function scene2c(g, t) {
  if (!SMOKE_TXT) SMOKE_TXT = samplePoints(gg => drawSmokeTitle(gg, 0, false), Math.max(4, Math.round(6 * U)));
  const gy = H * 0.98, cx = W / 2;
  radial(g, cx, gy, W * 0.9, [232, 87, 27], 0.5);
  fire(g, t * 0.7, { x0: -0.1 * W, x1: 1.1 * W, y: gy + 40 * U, E: PORT ? 16 : 26, seed: 61, rate: 26, height: 0.22 * H, size: 50 * U });
  smoke(g, t, { n: 22, seed: 62, x0: -0.1 * W, x1: 1.1 * W, y: H * 1.02, rise: H * 1.0, life: 3.0, size: 190 * U, alpha: 0.30 });

  // partículas de humo que viajan hasta su letra
  const crisp = sstep(t, 6.82, 7.1);
  const pts = SMOKE_TXT;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty] = pts[i];
    const ts = 6.0 + 0.18 * rnd(i, 401), ta = 6.5 + 0.32 * (tx / W) + 0.1 * rnd(i, 402);
    const u = eInOutCubic(ramp(t, ts, ta));
    if (u <= 0) continue;
    const sx = tx + (rnd(i, 403) - 0.5) * W * 0.7, sy = H * (1.02 + 0.25 * rnd(i, 404));
    const ph = rnd(i, 405) * TAU, sw = (120 + 160 * rnd(i, 406)) * U * Math.sin(Math.PI * u);
    const x = lerp(sx, tx, u) + Math.cos(ph + u * 5) * sw, y = lerp(sy, ty, u) + Math.sin(ph + u * 5) * sw * 0.5;
    const settled = t > ta ? 1 : 0;
    const a = (1 - crisp) * (0.18 + 0.5 * u);
    if (u < 0.9) spr(g, SMOKE[i % 4], x, y, (34 * (1 - u) + 8) * U, 0.22 * (1 - u) * (1 - crisp));
    spr(g, fireSpr(0.35 + 0.4 * (1 - u) + 0.1 * Math.sin(t * 20 + i)), x, y, (settled ? 7 : 9) * U, a);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (crisp > 0) {
    const heat = sstep(t, 7.7, 8.0);
    g.save(); g.globalAlpha = crisp;
    const push = 1 + 0.04 * ramp(t, 6.9, 8.0);
    g.translate(cx, H / 2); g.scale(push, push); g.translate(-cx, -H / 2);
    g.shadowColor = rgba([255, 130, 40], 0.9); g.shadowBlur = (24 + 50 * heat) * U;
    drawSmokeTitle(g, t, true);
    g.restore();
    // las letras sueltan brasas hacia arriba
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const [tx, ty] = pts[Math.floor(rnd(i, 501) * pts.length)];
      const life = 0.7 + 0.6 * rnd(i, 502), t0 = 7.0 + rnd(i, 503) * 0.9;
      const age = t - t0; if (age < 0 || age > life) continue;
      const u = age / life;
      spr(g, EMBER, tx + Math.sin(age * 4 + i) * 20 * U + age * 40 * U, ty - age * 180 * U, 7 * U, Math.sin(Math.PI * u));
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    radial(g, cx, H * 0.45, W * 0.7, [255, 150, 60], 0.25 * heat);
  }
  embers(g, t, { n: 36, seed: 63, x0: 0, x1: W, y0: 0, y1: H, size: 8 * U, alpha: 0.8 });
}

// ═════════════════════════════ ESCENA 3a · 8–9.25 s · brindis ═════════════════════════════
function glassPath(g, s) {
  const rw = 92 * s, rm = 122 * s;
  g.beginPath();
  g.moveTo(-rw, 0);
  g.bezierCurveTo(-rw - 18 * s, 60 * s, -rm, 105 * s, -rm + 4 * s, 160 * s);
  g.bezierCurveTo(-rm + 8 * s, 228 * s, -62 * s, 268 * s, 0, 270 * s);
  g.bezierCurveTo(62 * s, 268 * s, rm - 8 * s, 228 * s, rm - 4 * s, 160 * s);
  g.bezierCurveTo(rm, 105 * s, rw + 18 * s, 60 * s, rw, 0);
}
function glass(g, x, y, rot, s, t, slosh, draw) {
  g.save(); g.translate(x, y); g.rotate(rot);
  // vino
  g.save(); glassPath(g, s); g.closePath(); g.clip();
  g.fillStyle = 'rgba(255,235,210,0.05)'; g.fillRect(-200 * s, 0, 400 * s, 280 * s);
  g.rotate(-rot + slosh);
  const lvl = 150 * s;
  const wg = g.createLinearGradient(0, lvl - 60 * s, 0, lvl + 150 * s);
  wg.addColorStop(0, '#9b1c22'); wg.addColorStop(0.4, '#6a0f16'); wg.addColorStop(1, '#2a0508');
  g.fillStyle = wg; g.fillRect(-300 * s, lvl - 40 * s, 600 * s, 400 * s);
  g.strokeStyle = 'rgba(255,170,150,0.6)'; g.lineWidth = 3 * s;
  g.beginPath(); g.moveTo(-300 * s, lvl - 40 * s); g.lineTo(300 * s, lvl - 40 * s); g.stroke();
  g.restore();
  // trazo dorado (se dibuja)
  g.strokeStyle = COL.goldHi; g.lineWidth = 4.5 * s; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(244,190,110,0.9)'; g.shadowBlur = 18 * s;
  const L = 1400 * s; g.setLineDash([L, L]); g.lineDashOffset = L * (1 - draw);
  glassPath(g, s); g.stroke();
  g.beginPath(); g.ellipse(0, 0, 92 * s, 10 * s, 0, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(0, 270 * s); g.lineTo(0, 470 * s); g.stroke();
  g.beginPath(); g.ellipse(0, 474 * s, 92 * s, 12 * s, 0, 0, TAU); g.stroke();
  g.setLineDash([]); g.shadowBlur = 0;
  // reflejo
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 5 * s;
  g.beginPath(); g.moveTo(-rwOff(s), 40 * s); g.bezierCurveTo(-110 * s, 100 * s, -108 * s, 150 * s, -96 * s, 200 * s); g.stroke();
  g.restore();
}
const rwOff = s => 84 * s;
const CLINK = 8.30;
function scene3a(g, t) {
  // interior real de Casa RES desenfocado
  const bl = lerp(14, 5, eOutCubic(ramp(t, 8.0, 8.9))) * U;
  if (PORT) photo(g, 'interior', 420 + (t - 8) * 14, 300, 3.45, { filter: `blur(${bl}px) brightness(0.62) saturate(1.15)` });
  else photo(g, 'interior', 400 + (t - 8) * 14, 300, 2.55, { filter: `blur(${bl}px) brightness(0.62) saturate(1.15)` });
  g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,130,50,0.45)'; g.fillRect(0, 0, W, H); g.restore();
  // bokeh
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i++) {
    const x = W * rnd(i, 600) + Math.sin(t * 0.8 + i) * 30 * U, y = H * rnd(i, 601) - (t - 8) * (20 + 40 * rnd(i, 602)) * U;
    spr(g, BOKEH, x, y, (24 + 70 * rnd(i, 603)) * U, 0.35 + 0.35 * Math.sin(t * 2 + i));
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  // copas que chocan
  const s = (PORT ? 1.15 : 0.95) * U, cx = W / 2, cy = PORT ? H * 0.40 : H * 0.36;
  const app = eInOutCubic(ramp(t, 8.0, CLINK));
  const rec = t > CLINK ? Math.sin((t - CLINK) * 16) * Math.exp(-(t - CLINK) * 7) * 14 * U + 10 * U * ramp(t, CLINK, CLINK + 0.3) : 0;
  const tilt = 0.24;
  const reach = 96 * s;
  const lx = lerp(-W * 0.35, cx - reach, app) - rec, rx = lerp(W * 1.35, cx + reach, app) + rec;
  const sl = t > CLINK ? 0.18 * Math.sin((t - CLINK) * 18) * Math.exp(-(t - CLINK) * 3.5) : 0;
  const draw = eOutCubic(ramp(t, 7.98, 8.35));
  glass(g, lx, cy + 30 * s, tilt, s, t, sl, draw);
  glass(g, rx, cy + 30 * s, -tilt, s, t, -sl, draw);
  // destello del choque
  if (t >= CLINK) {
    const cyc = cy + 8 * s;
    radial(g, cx, cyc, 260 * U, [255, 230, 170], 0.9 * Math.exp(-(t - CLINK) * 7));
    ring(g, t, CLINK, cx, cyc, 10 * U, 420 * U, 0.6, [255, 215, 150], 6 * U);
    sparks(g, t, CLINK, cx, cyc, { n: 46, seed: 81, speed: 900, life: 0.7, w: 2.2, grav: 300, cool: -0.1 });
  }
  // palabras al ritmo
  const words = [['COMPARTE', 8.42, 'bc'], ['BRINDA', 8.67, 'bc'], ['celebra', 8.92, 'pf']];
  words.forEach(([w, t0, f], i) => {
    const p = eOutExpo(ramp(t, t0, t0 + 0.25));
    if (p <= 0) return;
    let x, y, sz;
    if (PORT) { x = cx; y = H * (0.085 + 0.075 * i); sz = 104 * U; }
    else { x = W * (0.22 + 0.28 * i); y = H * 0.13; sz = 104 * U; }
    const font = f === 'pf' ? F.pf(sz * 1.02, 700) : F.bc(sz, 800);
    const fill = f === 'pf' ? (gg => emberFill(gg, 0, y - sz / 2, 0, y + sz / 2)) : i === 1 ? (gg => goldFill(gg, x - 200 * U, 0, x + 200 * U, 0, t)) : COL.cream;
    txt(g, w, x, y, font, fill, { scale: lerp(1.5, 1, p), alpha: p, ls: f === 'pf' ? 0 : 6 * U });
  });
  embers(g, t, { n: 24, seed: 83, x0: 0, x1: W, y0: 0, y1: H, size: 7 * U, alpha: 0.6 });
}

// ═════════════════════════════ ESCENA 3b · 9.25–10.25 s · la carta ═════════════════════════════
function iconCup(g, s, p) {
  stroked(g, p, gg => { gg.moveTo(-90 * s, -30 * s); gg.lineTo(-74 * s, 70 * s); gg.quadraticCurveTo(-70 * s, 92 * s, -46 * s, 92 * s); gg.lineTo(46 * s, 92 * s); gg.quadraticCurveTo(70 * s, 92 * s, 74 * s, 70 * s); gg.lineTo(90 * s, -30 * s); gg.closePath(); });
  stroked(g, p, gg => { gg.moveTo(88 * s, -6 * s); gg.bezierCurveTo(150 * s, -10 * s, 150 * s, 60 * s, 80 * s, 52 * s); });
  stroked(g, p, gg => { gg.ellipse(0, 110 * s, 150 * s, 18 * s, 0, 0, TAU); });
  for (let k = -1; k <= 1; k++) stroked(g, p, gg => { gg.moveTo(k * 36 * s, -50 * s); gg.bezierCurveTo(k * 36 * s - 22 * s, -80 * s, k * 36 * s + 22 * s, -105 * s, k * 36 * s, -140 * s); });
}
function iconBoard(g, s, p) {
  stroked(g, p, gg => { gg.roundRect(-170 * s, -60 * s, 300 * s, 150 * s, 26 * s); });
  stroked(g, p, gg => { gg.roundRect(130 * s, -12 * s, 70 * s, 54 * s, 20 * s); });
  for (const [x, y] of [[-120, -10], [-70, 30], [-20, -15]]) stroked(g, p, gg => { gg.rect((x - 18) * s, (y - 18) * s, 36 * s, 36 * s); });
  for (const [x, y] of [[40, 20], [80, -20], [70, 50]]) stroked(g, p, gg => { gg.arc(x * s, y * s, 24 * s, 0, TAU); });
  stroked(g, p, gg => { gg.moveTo(-150 * s, -120 * s); gg.lineTo(60 * s, -30 * s); });
}
function iconBowl(g, s, p) {
  stroked(g, p, gg => { gg.moveTo(-160 * s, 0); gg.bezierCurveTo(-150 * s, 120 * s, 150 * s, 120 * s, 160 * s, 0); gg.closePath(); });
  stroked(g, p, gg => { gg.moveTo(-60 * s, 92 * s); gg.lineTo(-70 * s, 120 * s); gg.lineTo(70 * s, 120 * s); gg.lineTo(60 * s, 92 * s); });
  for (const [x, a] of [[-90, -0.5], [-30, -0.15], [40, 0.25], [100, 0.6]]) stroked(g, p, gg => {
    gg.save(); gg.translate(x * s, -10 * s); gg.rotate(a);
    gg.moveTo(0, 0); gg.bezierCurveTo(-40 * s, -40 * s, -20 * s, -110 * s, 0, -130 * s); gg.bezierCurveTo(20 * s, -110 * s, 40 * s, -40 * s, 0, 0); gg.moveTo(0, 0); gg.lineTo(0, -110 * s);
    gg.restore();
  });
  stroked(g, p, gg => { gg.arc(10 * s, -40 * s, 26 * s, 0, TAU); });
}
function iconWine(g, s, p) {
  stroked(g, p, gg => { gg.moveTo(-104 * s, 130 * s); gg.lineTo(-104 * s, -10 * s); gg.bezierCurveTo(-104 * s, -60 * s, -80 * s, -70 * s, -80 * s, -110 * s); gg.lineTo(-80 * s, -170 * s); gg.lineTo(-48 * s, -170 * s); gg.lineTo(-48 * s, -110 * s); gg.bezierCurveTo(-48 * s, -70 * s, -24 * s, -60 * s, -24 * s, -10 * s); gg.lineTo(-24 * s, 130 * s); gg.closePath(); });
  stroked(g, p, gg => { gg.rect(-104 * s, 10 * s, 80 * s, 70 * s); });
  stroked(g, p, gg => { gg.moveTo(30 * s, -40 * s); gg.lineTo(44 * s, 130 * s); gg.lineTo(126 * s, 130 * s); gg.lineTo(140 * s, -40 * s); gg.closePath(); });
  stroked(g, p, gg => { gg.moveTo(100 * s, -40 * s); gg.lineTo(130 * s, -120 * s); gg.lineTo(160 * s, -120 * s); });
  stroked(g, p, gg => { gg.arc(140 * s, -40 * s, 30 * s, Math.PI, TAU); });
  stroked(g, p, gg => { gg.moveTo(36 * s, 20 * s); gg.lineTo(134 * s, 20 * s); });
}
let STROKE_STYLE = '#fff';
function stroked(g, p, path) {
  g.save(); g.beginPath(); path(g);
  const L = 900 * U; g.setLineDash([L, L]); g.lineDashOffset = L * (1 - p);
  g.strokeStyle = STROKE_STYLE; g.lineWidth = 7 * U; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(); g.restore();
}
const MENU = [
  { w: 'DESAYUNOS', bg: COL.cream, fg: COL.ink, ic: COL.red, icon: iconCup, box: true },
  { w: 'PICADAS', bg: COL.red, fg: COL.cream, ic: COL.cream, icon: iconBoard },
  { w: 'ENSALADAS', bg: COL.char, fg: COL.goldHi, ic: COL.gold, icon: iconBowl },
  { w: 'VINOS Y JUGOS', bg: COL.wine, fg: COL.cream, ic: COL.goldHi, icon: iconWine },
];
const M0 = 9.25, MD = 0.25;
function menuCard(g, i, t, lt) {
  const m = MENU[i];
  g.fillStyle = m.bg; g.fillRect(0, 0, W, H);
  if (i >= 2) { radial(g, W / 2, H * 0.4, W * 0.7, [232, 87, 27], 0.18); embers(g, t, { n: 20, seed: 90 + i, x0: 0, x1: W, y0: 0, y1: H, size: 7 * U, alpha: 0.7 }); }
  const ix = PORT ? W / 2 : W * 0.30, iy = PORT ? H * 0.37 : H * 0.48;
  const wx = PORT ? W / 2 : W * 0.63, wy = PORT ? H * 0.555 : H * 0.53;
  STROKE_STYLE = m.ic;
  g.save(); g.translate(ix, iy); const pop = eOutBack(ramp(lt, 0, 0.18)); g.scale(pop, pop);
  m.icon(g, (PORT ? 1.25 : 1.15) * U, eOutCubic(ramp(lt, 0.0, 0.17)));
  g.restore();
  const p = eOutExpo(ramp(lt, 0.02, 0.16));
  let sz = (PORT ? 150 : 170) * U;
  const maxW = PORT ? W * 0.86 : W * 0.5;
  const mw = measure(m.w, F.bc(sz, 800), 4 * U); if (mw > maxW) sz *= maxW / mw;
  if (m.box) {
    const bw = measure(m.w, F.bc(sz, 800), 4 * U) + 40 * U;
    g.fillStyle = COL.red; g.fillRect(wx - bw / 2 * p, wy - sz * 0.52, bw * p, sz * 1.0);
    txt(g, m.w, wx, wy, F.bc(sz, 800), COL.cream, { ls: 4 * U, alpha: p, scale: lerp(1.3, 1, p) });
  } else txt(g, m.w, wx, wy, F.bc(sz, 800), m.fg, { ls: 4 * U, alpha: p, scale: lerp(1.3, 1, p) });
  // rótulo y contador
  const ey = PORT ? H * 0.2 : H * 0.2, ex = PORT ? W / 2 : wx;
  txt(g, 'MÁS QUE PARRILLA', ex, ey, F.bc(58 * U, 700), m.fg, { ls: 12 * U, alpha: 0.85 });
  txt(g, `0${i + 1} / 04`, ex, ey + 64 * U, F.ms(28 * U, 500), m.fg, { ls: 6 * U, alpha: 0.6 });
}
function scene3b(g, t) {
  const i = clamp(Math.floor((t - M0) / MD), 0, 3), lt = t - M0 - i * MD;
  const slide = 1 - eOutExpo(ramp(lt, 0, 0.14));
  if (i > 0 && slide > 0.001) {
    g.save(); g.translate(-W * (1 - slide) * 0.35, 0); menuCard(g, i - 1, t, MD); g.restore();
  }
  g.save(); g.translate(W * slide, 0); menuCard(g, i, t, lt); g.restore();
}

// ═════════════════════════════ ESCENA 3c · 10.25–12 s · mapa ═════════════════════════════
const ECU = [[-78.83, 1.43], [-79.2, 1.08], [-79.65, 0.98], [-80.1, 0.83], [-80.03, 0.6], [-80.03, 0.36], [-80.06, 0.07], [-80.27, -0.2], [-80.43, -0.6], [-80.55, -0.8], [-80.77, -0.92], [-80.92, -1.05], [-80.74, -1.36], [-80.81, -1.56], [-80.75, -1.98], [-81.01, -2.2], [-80.9, -2.25], [-80.68, -2.4], [-80.39, -2.63], [-80.25, -2.72], [-79.95, -2.42], [-79.8, -2.6], [-79.83, -3.0], [-80.0, -3.27], [-80.23, -3.42], [-80.25, -3.65], [-80.45, -4.02], [-80.33, -4.42], [-79.95, -4.4], [-79.65, -4.45], [-79.45, -4.6], [-79.25, -4.95], [-79.05, -5.0], [-78.9, -4.75], [-78.68, -4.55], [-78.55, -4.1], [-78.35, -3.75], [-78.2, -3.4], [-77.85, -2.98], [-76.65, -2.57], [-75.55, -1.55], [-75.25, -0.95], [-75.3, -0.15], [-75.65, 0.0], [-76.05, 0.25], [-76.45, 0.28], [-77.0, 0.33], [-77.42, 0.4], [-77.67, 0.8], [-78.15, 0.98], [-78.6, 1.25]];
const CITIES = [
  { n: 'QUITO', lon: -78.47, lat: -0.18, t: 10.45, side: 1 },
  { n: 'MANTA', lon: -80.72, lat: -0.96, t: 10.7, side: -1 },
  { n: 'GUAYAQUIL', lon: -79.89, lat: -2.19, t: 10.95, side: -1 },
  { n: 'CUENCA', lon: -79.0, lat: -2.9, t: 11.2, side: 1 },
];
// 15 locales aproximados (centros comerciales y aeropuerto), solo como puntos de luz
const LOCS = [
  [-78.49, -0.15], [-78.48, -0.12], [-78.50, -0.10], [-78.43, -0.20], [-78.45, -0.31], [-78.36, -0.12], [-78.53, -0.25], [-78.47, -0.19],
  [-79.90, -2.17], [-79.88, -2.15], [-79.93, -2.20], [-79.86, -2.13],
  [-80.72, -0.96], [-79.01, -2.91], [-78.99, -2.88],
];
function mapGeo() {
  const h = PORT ? H * 0.40 : H * 0.80, k = h / 6.5;
  const cx = PORT ? W * 0.52 : W * 0.30, cy = PORT ? H * 0.555 : H * 0.47;
  const lon0 = -78.1, lat0 = -1.78;
  return { k, P: (lon, lat) => [cx + (lon - lon0) * k, cy - (lat - lat0) * k] };
}
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
let MAPDOTS = null;
function scene3c(g, t) {
  const { k, P: pj } = mapGeo();
  const poly = ECU.map(([a, b]) => pj(a, b));
  if (!MAPDOTS) {
    MAPDOTS = []; const st = 15 * U;
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    for (let y = Math.min(...ys); y < Math.max(...ys); y += st) for (let x = Math.min(...xs); x < Math.max(...xs); x += st) if (inPoly(x, y, poly)) MAPDOTS.push([x, y]);
  }
  g.fillStyle = '#0d0907'; g.fillRect(0, 0, W, H);
  radial(g, poly[0][0], H * 0.5, Math.max(W, H) * 0.7, [120, 35, 10], 0.35);
  // retícula sutil
  g.save(); g.strokeStyle = 'rgba(216,180,106,0.07)'; g.lineWidth = 1;
  for (let x = (t * 10 * U) % (60 * U); x < W; x += 60 * U) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 60 * U) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.restore();

  const cities = CITIES.map(c => ({ ...c, p: pj(c.lon, c.lat) }));
  const origin = cities[0].p;
  // puntos del mapa: aparecen en onda y se encienden como brasa cerca de cada ciudad
  for (const [x, y] of MAPDOTS) {
    const dd = Math.hypot(x - origin[0], y - origin[1]);
    const ap = ramp(t, 10.25 + dd / (1600 * U), 10.4 + dd / (1600 * U));
    if (ap <= 0) continue;
    let heat = 0;
    for (const c of cities) {
      const r = Math.hypot(x - c.p[0], y - c.p[1]);
      const rr = 150 * U * eOutCubic(ramp(t, c.t, c.t + 0.5));
      heat = Math.max(heat, clamp(1 - r / Math.max(rr, 1)) * ramp(t, c.t, c.t + 0.05));
    }
    heat = Math.min(1, heat + 0.25 * sstep(t, 11.6, 12.0));
    const fl = 0.8 + 0.2 * Math.sin(t * 12 + x * 0.05);
    g.fillStyle = heat > 0.02 ? rgba(fireRGB(0.6 - 0.45 * heat), ap * (0.35 + 0.65 * heat * fl)) : `rgba(216,180,106,${0.28 * ap})`;
    const r = (2.4 + 2.2 * heat) * U;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // contorno dorado
  g.save(); g.strokeStyle = COL.gold; g.lineWidth = 2.5 * U; g.lineJoin = 'round';
  g.shadowColor = 'rgba(244,190,110,0.8)'; g.shadowBlur = 14 * U;
  const L = 6000 * U; g.setLineDash([L, L]); g.lineDashOffset = L * (1 - eInOutCubic(ramp(t, 10.25, 10.85)));
  g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  g.restore();
  // locales
  let count = 0;
  LOCS.forEach(([lo, la], i) => {
    const tp = 10.5 + i * 0.055; if (t < tp) return; count++;
    const [x, y] = pj(lo, la), p = eOutBack(ramp(t, tp, tp + 0.15));
    radial(g, x, y, 34 * U, [255, 150, 60], 0.6 * p);
    g.fillStyle = COL.goldHi; g.beginPath(); g.arc(x, y, 4.5 * U * p, 0, TAU); g.fill();
  });
  // ciudades
  for (const c of cities) {
    if (t < c.t) continue;
    const [x, y] = c.p, p = eOutBack(ramp(t, c.t, c.t + 0.2));
    radial(g, x, y, 200 * U * Math.exp(-(t - c.t) * 4) + 60 * U, [255, 140, 50], 0.8);
    ring(g, t, c.t, x, y, 8 * U, 120 * U, 0.7, [255, 190, 110], 4 * U);
    ring(g, t, c.t + 0.45, x, y, 8 * U, 90 * U, 0.7, [255, 190, 110], 3 * U);
    sparks(g, t, c.t, x, y, { n: 18, seed: 200 + c.n.length, speed: 500, life: 0.55, w: 2, grav: 200 });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 9 * U * p, 0, TAU); g.fill();
    const lx = x + c.side * 70 * U, ly = y - 34 * U;
    g.save(); g.strokeStyle = COL.gold; g.lineWidth = 2 * U; g.globalAlpha = p;
    g.beginPath(); g.moveTo(x, y); g.lineTo(lerp(x, lx, eOutCubic(ramp(t, c.t, c.t + 0.15))), lerp(y, ly, eOutCubic(ramp(t, c.t, c.t + 0.15)))); g.stroke(); g.restore();
    txtLetters(g, c.n, lx + c.side * 10 * U - (c.side < 0 ? measure(c.n, F.bc(46 * U, 700), 4 * U) : 0), ly - 4 * U, F.bc(46 * U, 700), COL.cream, c.t + 0.08, t, { align: 'left', ls: 4 * U, stag: 0.02, dur: 0.2, rise: 16 * U });
  }
  // titular +15
  const hx = PORT ? W / 2 : W * 0.70;
  const hy = PORT ? H * 0.145 : H * 0.34;
  const n = Math.min(15, count);
  if (t > 10.5) {
    const p = eOutExpo(ramp(t, 10.5, 10.75));
    const szN = (PORT ? 230 : 270) * U;
    txt(g, `+${n}`, hx, hy, F.bc(szN, 800), gg => emberFill(gg, 0, hy - szN / 2, 0, hy + szN / 2), { alpha: p, scale: lerp(1.4, 1, p) * (n === 15 ? 1 + 0.08 * Math.exp(-(t - 11.32) * 8) * (t > 11.32 ? 1 : 0) : 1), glow: 'rgba(255,120,40,0.7)', glowR: 40 * U });
  }
  const tl = 11.3;
  const szL = (PORT ? 74 : 84) * U;
  const ly1 = hy + (PORT ? 150 : 175) * U;
  const pl = eOutExpo(ramp(t, tl, tl + 0.3));
  if (pl > 0) {
    txt(g, 'LOCALES', hx, ly1, F.bc(szL, 800), COL.cream, { ls: lerp(40, 14, pl) * U, alpha: pl });
    txt(g, 'cerca de ti', hx, ly1 + szL * 0.95, F.pf(szL * 0.9, 700), gg => goldFill(gg, hx - 200 * U, 0, hx + 200 * U, 0, t), { alpha: eOutExpo(ramp(t, tl + 0.1, tl + 0.4)) });
  }
  // cinta con los centros comerciales
  const tick = 'CCI  •  QUICENTRO NORTE  •  CONDADO  •  SCALA  •  SAN LUIS  •  MALL DEL SOL  •  SAN MARINO  •  MALL DEL RÍO  •  MALL DEL PACÍFICO  •  AEROPUERTO DE QUITO  •  ';
  const ta = sstep(t, 10.55, 10.8);
  if (ta > 0) {
    const ty = PORT ? H * 0.318 : ly1 + szL * 2.1;
    const x0 = PORT ? 0 : W * 0.48, x1 = PORT ? W : W * 0.94;
    const fnt = F.ms(24 * U, 600), tw = measure(tick, fnt, 3 * U);
    g.save(); g.beginPath(); g.rect(x0, ty - 30 * U, x1 - x0, 60 * U); g.clip();
    g.strokeStyle = 'rgba(216,180,106,0.5)'; g.lineWidth = 1.2 * U;
    g.beginPath(); g.moveTo(x0, ty - 28 * U); g.lineTo(x1, ty - 28 * U); g.moveTo(x0, ty + 28 * U); g.lineTo(x1, ty + 28 * U); g.stroke();
    const off = ((t - 10.4) * 260 * U) % tw;
    for (let x = x0 - off; x < x1; x += tw) txt(g, tick, x, ty + 1 * U, fnt, COL.goldHi, { align: 'left', ls: 3 * U, alpha: ta * 0.9 });
    const fl = g.createLinearGradient(x0, 0, x1, 0);
    fl.addColorStop(0, '#0d0907'); fl.addColorStop(0.08, 'rgba(13,9,7,0)'); fl.addColorStop(0.92, 'rgba(13,9,7,0)'); fl.addColorStop(1, '#0d0907');
    g.fillStyle = fl; g.fillRect(x0, ty - 30 * U, x1 - x0, 60 * U);
    g.restore();
  }
  embers(g, t, { n: 30, seed: 97, x0: 0, x1: W, y0: 0, y1: H, size: 7 * U, alpha: 0.7 });
  const heat = sstep(t, 11.55, 12.0);
  radial(g, W / 2, H / 2, Math.max(W, H) * 0.8, [255, 120, 40], 0.4 * heat);
}

// ═════════════════════════════ ESCENA 4 · 12–15 s · el sello ═════════════════════════════
const EP = {
  A: [0, 0], B: [.36, 0], C: [.68, 0], D: [1, 0], E: [0, .30], F: [1, .24], HL: [.07, .26], HR: [.93, .21],
  P: [.44, .17], Q: [.63, .20], L1: [.03, .47], T1: [.18, .40], T2: [.5, .37], T3: [.82, .38], R1: [.97, .45],
  B1: [.15, .53], B2: [.5, .52], B3: [.85, .53], M: [.5, .67], J1: [.27, .77], J2: [.73, .77],
  N1: [.41, .80], N2: [.59, .80], S1: [.39, .91], S2: [.61, .91], G: [0, .63], Hh: [1, .65], I: [0, 1], K: [.5, 1], Lb: [1, 1],
};
const CELLS = [
  ['A B P HL E', '#F4B323'], ['B C Q P', '#F7C744'], ['C D F HR Q', '#EFA21F'], ['E HL L1 G', '#E9781F'],
  ['HL T1 L1', '#FBE3A2'], ['P Q T2 T1 HL', '#EC8A22'], ['Q HR T3 T2', '#E36A1D'], ['HR R1 T3', '#FBE3A2'],
  ['F Hh R1 HR', '#E2621C'], ['L1 T1 B1', '#F6C031'], ['T1 T2 B2 B1', '#F9CF45'], ['T2 T3 B3 B2', '#F3B62B'],
  ['T3 R1 B3', '#F6C031'], ['B1 B2 M J1', '#8C1D17'], ['B2 B3 J2 M', '#6E1612'], ['J1 M N1 S1', '#A1261B'],
  ['M J2 S2 N2', '#7D1914'], ['M N2 N1', '#5A110F'], ['N1 N2 S2 S1', '#4A0E0C'], ['L1 B1 J1 G', '#D2421E'],
  ['G J1 S1 K I', '#C0301B'], ['R1 Hh J2 B3', '#CF3B1D'], ['Hh Lb K S2 J2', '#B12619'], ['S1 S2 K', '#93201A'],
].map(([k, c]) => ({ pts: k.split(' ').map(n => EP[n]), c }));

function logoLayout() {
  return PORT
    ? { E: 400 * U, cx: W / 2, cy: H * 0.272 }
    : { E: 300 * U, cx: W * 0.30, cy: H * 0.36 };
}
function cellPath(g, cell, x0, y0, E) {
  g.beginPath(); cell.pts.forEach(([u, v], i) => i ? g.lineTo(x0 + u * E, y0 + v * E) : g.moveTo(x0 + u * E, y0 + v * E)); g.closePath();
}
let LOGOPTS = null;
const STAMP = 12.9;
function emblem(g, t, cx, cy, E) {
  const x0 = cx - E / 2, y0 = cy - E / 2;
  const heat = 1 - eOutCubic(ramp(t, STAMP, STAMP + 0.9));
  // relleno tipo vitral
  CELLS.forEach((cell, i) => {
    const mx = cell.pts.reduce((a, p) => a + p[0], 0) / cell.pts.length, my = cell.pts.reduce((a, p) => a + p[1], 0) / cell.pts.length;
    const dd = Math.hypot(mx - 0.5, my - 0.5);
    const a = eOutCubic(ramp(t, STAMP + 0.12 + dd * 0.5, STAMP + 0.4 + dd * 0.5));
    if (a <= 0) return;
    cellPath(g, cell, x0, y0, E);
    g.globalAlpha = a; g.fillStyle = cell.c; g.fill();
    if (heat > 0) { g.globalAlpha = a * heat * 0.8; g.fillStyle = '#FF7A2A'; g.fill(); }
    g.globalAlpha = 1;
  });
  // líneas: blanco incandescente → dorado
  const lc = heat > 0.5 ? mixRGB([255, 140, 50], [255, 246, 220], (heat - 0.5) * 2) : mixRGB(hexRGB('#1a120d'), [255, 140, 50], heat * 2);
  const fill = eOutCubic(ramp(t, STAMP + 0.12, STAMP + 0.9));
  g.save(); g.lineJoin = 'round';
  // trazo de hierro de marcar: incandescente → plomo oscuro del vitral
  g.strokeStyle = rgba(lc); g.lineWidth = lerp(4.5, 3, fill) * U;
  if (heat > 0.05) { g.shadowColor = rgba([255, 150, 60], heat); g.shadowBlur = 40 * U * heat; }
  for (const cell of CELLS) { cellPath(g, cell, x0, y0, E); g.stroke(); }
  g.lineWidth = 5 * U; g.strokeRect(x0, y0, E, E);
  g.restore();
}
function scene4(g, t) {
  const { E, cx, cy } = logoLayout();
  if (!LOGOPTS) {
    LOGOPTS = [];
    const st = 8 * U;
    for (let y = cy - E / 2; y < cy + E / 2; y += st) for (let x = cx - E / 2; x < cx + E / 2; x += st) LOGOPTS.push([x, y]);
  }
  g.fillStyle = COL.black; g.fillRect(0, 0, W, H);
  radial(g, cx, cy, Math.max(W, H) * 0.6, [140, 40, 12], 0.35 + 0.25 * Math.exp(-Math.max(0, t - STAMP) * 3));
  // brasas al fondo
  const fy = H * 1.02;
  radial(g, W / 2, fy, W * 0.8, [232, 87, 27], 0.35);
  fire(g, t * 0.6, { x0: -0.1 * W, x1: 1.1 * W, y: fy + 50 * U, E: PORT ? 14 : 22, seed: 120, rate: 22, height: 0.14 * H, size: 44 * U, alpha: 0.75 });
  smoke(g, t, { n: 10, seed: 121, x0: 0, x1: W, y: H * 1.05, rise: H * 0.5, life: 3.2, size: 180 * U, alpha: 0.12 });

  // el humo gira y se condensa en el emblema
  if (t < STAMP + 0.1) {
    const fade = 1 - ramp(t, STAMP - 0.04, STAMP + 0.06);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LOGOPTS.length; i++) {
      const [tx, ty] = LOGOPTS[i];
      // tres brazos de espiral alrededor del emblema
      const q = rnd(i, 701), arm = i % 3;
      const a0 = arm * TAU / 3 + q * 4.2 + (rnd(i, 700) - 0.5) * 0.16, r0 = Math.min(W, H) * (0.3 + 0.8 * q) + (rnd(i, 703) - 0.5) * 24 * U;
      const sx = cx + Math.cos(a0) * r0, sy = cy + Math.sin(a0) * r0;
      const u = eInOutCubic(ramp(t, 12.0 + 0.12 * rnd(i, 702), STAMP - 0.02));
      const spin = (1 - u) * 3.2 + (t - 12.0) * 1.5 * (1 - u);
      const ox = sx - tx, oy = sy - ty;
      const x = tx + (ox * Math.cos(spin) - oy * Math.sin(spin)) * (1 - u), y = ty + (ox * Math.sin(spin) + oy * Math.cos(spin)) * (1 - u);
      const fin = ramp(t, 11.98, 12.06);
      if (u < 0.85 && i % 9 === 0) spr(g, SMOKE[i % 4], x, y, (90 * (1 - u) + 20) * U, 0.12 * (1 - u) * fade * fin);
      spr(g, fireSpr(0.2 + 0.4 * (1 - u)), x, y, 9 * U, (0.6 + 0.4 * u) * fade * fin);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  // golpe del sello
  if (t >= STAMP - 0.04) {
    const s = t < STAMP ? 1.25 : 1 + 0.25 * Math.max(0, Math.cos((t - STAMP) * 30)) * Math.exp(-(t - STAMP) * 14);
    g.save(); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
    emblem(g, t, cx, cy, E);
    g.restore();
    ring(g, t, STAMP, cx, cy, E * 0.55, Math.max(W, H) * 0.9, 0.7, [255, 160, 70], 14 * U);
    ring(g, t, STAMP + 0.06, cx, cy, E * 0.55, Math.max(W, H) * 0.6, 0.6, [255, 220, 170], 5 * U);
    sparks(g, t, STAMP, cx, cy, { n: 110, seed: 130, speed: 1700, life: 1.0, w: 3, grav: 700 });
    radial(g, cx, cy, E * 2.4, [255, 220, 160], 1.0 * Math.exp(-(t - STAMP) * 6));
    // vapor del hierro caliente
    if (t > STAMP) smoke(g, t - STAMP, { n: 14, seed: 133, x0: cx - E * 0.6, x1: cx + E * 0.6, y: cy - E * 0.2, rise: E * 1.4, life: 1.4, size: 110 * U, alpha: 0.32 * (1 - ramp(t, STAMP + 0.5, 13.9)) });
  }
  // logotipo
  const wy = cy + E / 2 + (PORT ? 95 : 85) * U;
  const pw = eOutExpo(ramp(t, 13.02, 13.4));
  if (pw > 0) {
    g.save(); g.beginPath(); g.rect(cx - E, cy + E / 2 + 6 * U, E * 2, 400 * U * pw); g.clip();
    txt(g, 'CASA', cx, wy - 6 * U - (1 - pw) * 40 * U, F.ms(70 * U, 300), COL.cream, { ls: 10 * U, alpha: pw });
    txt(g, 'RES', cx, wy + 92 * U - (1 - pw) * 60 * U, F.ms(132 * U, 300), COL.cream, { ls: 14 * U, alpha: pw });
    g.restore();
  }
  const pm = eOutCubic(ramp(t, 13.25, 13.6));
  if (pm > 0) {
    const my = wy + 186 * U, lw = 70 * U * pm;
    g.save(); g.strokeStyle = COL.gold; g.globalAlpha = pm; g.lineWidth = 1.5 * U;
    g.beginPath(); g.moveTo(cx - 196 * U - lw, my); g.lineTo(cx - 196 * U, my); g.moveTo(cx + 196 * U, my); g.lineTo(cx + 196 * U + lw, my); g.stroke(); g.restore();
    txt(g, 'MAESTROS DE LA PARRILLA', cx, my, F.bc(30 * U, 700), gg => goldFill(gg, cx - 200 * U, 0, cx + 200 * U, 0, t), { ls: 6 * U, alpha: pm });
  }
  // eslogan y llamado a la acción
  const tx = PORT ? W / 2 : W * 0.66, al = 'center';
  const tgY = PORT ? H * 0.625 : H * 0.34;
  const tgS = (PORT ? 80 : 92) * U;
  txtLetters(g, 'Sellamos tus', tx - (PORT ? 0 : 0), tgY - tgS * 0.62, F.pf(tgS * 0.82, 400), COL.cream, VO_TAG - 0.08, t, { stag: 0.035, dur: 0.4, rise: 30 * U });
  txtLetters(g, 'recuerdos', tx, tgY + tgS * 0.42, F.pf(tgS * 1.18, 700), gg => emberFill(gg, 0, tgY, 0, tgY + tgS), VO_TAG + 0.55, t, { stag: 0.04, dur: 0.45, rise: 40 * U, glow: 'rgba(255,120,40,0.6)', glowR: 26 * U });
  const cA = eOutCubic(ramp(t, 13.95, 14.25));
  if (cA > 0) {
    const cy1 = PORT ? H * 0.715 : H * 0.6;
    txt(g, 'ENCUÉNTRANOS EN TU', tx, cy1 + (1 - cA) * 20 * U, F.bc(40 * U, 600), COL.cream, { ls: 6 * U, alpha: cA * 0.9, align: al });
    txt(g, 'CENTRO COMERCIAL FAVORITO', tx, cy1 + 46 * U + (1 - cA) * 20 * U, F.bc(40 * U, 600), COL.cream, { ls: 6 * U, alpha: cA * 0.9, align: al });
    const pb = eOutBack(ramp(t, 14.1, 14.38));
    if (pb > 0) {
      const by = cy1 + 130 * U, fnt = F.ms(34 * U, 600), bw = measure('@casaresecuador', fnt, 1 * U) + 70 * U, bh = 70 * U;
      g.save(); g.translate(tx, by); g.scale(pb, pb);
      g.fillStyle = COL.red; g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.fill();
      g.restore();
      txt(g, '@casaresecuador', tx, by + 1 * U, fnt, '#fff', { ls: 1 * U, alpha: clamp(pb), scale: pb });
      txt(g, 'casares.ec', tx, by + 74 * U, F.ms(26 * U, 500), COL.goldHi, { ls: 4 * U, alpha: eOutCubic(ramp(t, 14.25, 14.5)) * 0.9 });
    }
  }
  embers(g, t, { n: 40, seed: 140, x0: 0, x1: W, y0: 0, y1: H, size: 8 * U, alpha: 0.75 });
}

// ═════════════════════════════ subtítulos ═════════════════════════════
let VO = [];              // [{start,end,text}] — lo inyecta el renderizador
let VO_TAG = 13.5;        // inicio de "Sellamos" (para sincronizar el eslogan)
window.setVO = (lines, tag) => { VO = lines; if (tag) VO_TAG = tag; };
function subtitles(g, t) {
  for (let li = 0; li < VO.length; li++) {
    const L = VO[li];
    const next = VO[li + 1], out = next ? Math.min(L.end + 0.25, next.start - 0.06) : L.end + 0.25;
    if (L.noSub || t < L.start - 0.08 || t > out) continue;
    const a = sstep(t, L.start - 0.08, L.start + 0.04) * (1 - sstep(t, out - 0.12, out));
    const sz = (PORT ? 52 : 44) * U, fnt = F.ms(sz, 700);
    const words = L.text.split(' ');
    const wts = words.map(w => w.length + 2), tot = wts.reduce((p, c) => p + c, 0);
    let acc = 0; const wt = words.map((w, i) => { const s = L.start + (L.end - L.start) * acc / tot; acc += wts[i]; return s; });
    // líneas
    const maxW = PORT ? W * 0.82 : W * 0.62, space = measure(' ', fnt);
    const lines = [[]]; let lw = 0;
    words.forEach((w, i) => { const ww = measure(w, fnt); if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += ww + space; });
    const lh = sz * 1.32, y0 = (PORT ? H * 0.765 : H * 0.885) - (lines.length - 1) * lh / 2;
    // caja
    const widths = lines.map(l => l.reduce((p, i) => p + measure(words[i], fnt) + space, -space));
    const bw = Math.max(...widths) + 44 * U, bh = lines.length * lh + 26 * U;
    const pop = lerp(0.94, 1, eOutBack(ramp(t, L.start - 0.08, L.start + 0.12)));
    g.save(); g.globalAlpha = a; g.translate(W / 2, y0 + (lines.length - 1) * lh / 2); g.scale(pop, pop);
    g.fillStyle = 'rgba(10,7,6,0.62)'; g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, 16 * U); g.fill();
    g.fillStyle = COL.ember; g.fillRect(-bw / 2 + 18 * U, bh / 2 - 4 * U, (bw - 36 * U) * clamp((t - L.start) / (L.end - L.start)), 3 * U);
    g.restore();
    lines.forEach((l, k) => {
      let x = W / 2 - widths[k] / 2;
      const y = y0 + k * lh;
      l.forEach(i => {
        const on = t >= wt[i];
        const col = on ? (t < (wt[i + 1] || L.end) ? '#FFC873' : COL.cream) : 'rgba(254,249,235,0.55)';
        txt(g, words[i], x, y + 2 * U, fnt, col, { align: 'left', alpha: a });
        x += measure(words[i], fnt) + space;
      });
    });
  }
}

// ═════════════════════════════ cámara y post ═════════════════════════════
const HITS = [[0.55, 0.25], [2.0, 1.0], [3.0, 0.7], [4.0, 0.9], [5.0, 0.55], [6.0, 0.45], [8.0, 0.8], [9.25, 0.35], [9.5, 0.3], [9.75, 0.3], [10.0, 0.3], [10.25, 0.6], [12.0, 0.6], [STAMP, 1.3]];
function camera(t) {
  let zoom = 1, sh = 0, blur = 0, flash = 0;
  for (const [ti, k] of HITS) {
    if (t < ti) continue;
    const a = t - ti;
    zoom += k * 0.09 * Math.exp(-a * 7);
    sh += k * 16 * U * Math.exp(-a * 9);
    blur += k * Math.exp(-a * 12);
    flash += k * 0.45 * Math.exp(-a * 14);
  }
  // pre-golpe: zoom inverso que acelera hacia el corte (speed ramp)
  for (const ti of [3.0, 8.0, 12.0]) { const a = ti - t; if (a > 0 && a < 0.35) { zoom += 0.06 * eInExpo(1 - a / 0.35); blur += 0.6 * eInExpo(1 - a / 0.35); } }
  return { zoom, sx: noise(t * 40, 1) * sh, sy: noise(t * 40, 2) * sh, blur: Math.min(blur, 1.2), flash: Math.min(flash, 0.9) };
}
function drawScene(g, t) {
  if (t < 3.0) scene1(g, t);
  else if (t < 5.0) scene2a(g, t);
  else if (t < 6.0) scene2b(g, t);
  else if (t < 8.0) scene2c(g, t);
  else if (t < M0) scene3a(g, t);
  else if (t < 10.25) scene3b(g, t);
  else if (t < 12.0) scene3c(g, t);
  else scene4(g, t);
}
function renderFrame(t) {
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over'; sctx.filter = 'none';
  sctx.fillStyle = COL.black; sctx.fillRect(0, 0, W, H);
  drawScene(sctx, t);

  const c = camera(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2 + c.sx, H / 2 + c.sy); ctx.scale(c.zoom, c.zoom);
  ctx.drawImage(S, -W / 2, -H / 2);
  if (c.blur > 0.03) for (let i = 1; i <= 4; i++) {
    const s = 1 + 0.022 * i * c.blur; ctx.globalAlpha = 0.2 * Math.min(1, c.blur);
    ctx.drawImage(S, -W / 2 * s, -H / 2 * s, W * s, H * s);
  }
  ctx.restore(); ctx.globalAlpha = 1;
  // destello
  if (c.flash > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,190,120,${c.flash * 0.55})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  // etalonaje cálido + viñeta
  const menu = t >= M0 && t < 10.25;
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,150,70,0.18)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.58);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${menu ? 0.35 : 0.7})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // grano
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
  const gi = GRAIN[Math.floor(t * FPS) % GRAIN.length];
  ctx.fillStyle = ctx.createPattern(gi, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  subtitles(ctx, t);
}

window.renderFrame = renderFrame;
window.META = { W, H, FPS, DUR };
window.ready = (async () => {
  await Promise.all([loadImg('steak', 'assets/steak_3x.jpg'), loadImg('interior', 'assets/interior_3x.jpg')]);
  const specs = [F.bc(40, 500), F.bc(40, 700), F.bc(40, 800), F.ms(40, 200), F.ms(40, 300), F.ms(40, 500), F.ms(40, 600), F.ms(40, 700), F.pf(40, 400), F.pf(40, 700)];
  await Promise.all(specs.map(s => document.fonts.load(s, 'ÁÉÍÓÚÑ abc')));
  return true;
})();
