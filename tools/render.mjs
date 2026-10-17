// Renderiza src/index.html cuadro a cuadro con Chromium (Playwright) y lo
// codifica con ffmpeg.
//
//   node tools/render.mjs video <w> <h> <salida.mp4> [vo_lines.json]
//   node tools/render.mjs stills <w> <h> <dir> <t1,t2,...> [vo_lines.json]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const [mode, w, h, out, arg5, arg6] = process.argv.slice(2);
const voFile = mode === 'stills' ? arg6 : arg5;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/index.html?w=${w}&h=${h}`);
await page.evaluate(() => window.ready);
if (voFile) {
  const vo = JSON.parse(fs.readFileSync(voFile, 'utf8'));
  await page.evaluate(([lines, tag]) => window.setVO(lines, tag), [vo.lines, vo.tag]);
}
const { FPS, DUR } = await page.evaluate(() => window.META);

async function shot(t) {
  await page.evaluate(tt => window.renderFrame(tt), t);
  return page.screenshot({ type: 'jpeg', quality: 96, clip: { x: 0, y: 0, width: +w, height: +h } });
}

if (mode === 'stills') {
  fs.mkdirSync(out, { recursive: true });
  for (const t of arg5.split(',').map(Number)) {
    fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.jpg`), await shot(t));
  }
} else {
  const N = Math.round(FPS * DUR);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-tune', 'grain', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const buf = await shot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0) console.log(`${w}x${h} frame ${i}/${N} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
server.close();
