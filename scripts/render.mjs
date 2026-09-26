// Headless-Chrome frame renderer. Usage:
//   node scripts/render.mjs --frames 0,120,7.5s --out dir [--sub 1]
//   node scripts/render.mjs --from 0 --to 3840 --workers 3 --sub 4 --grain 0   (-> build/frames)
//   node scripts/render.mjs --serve   (live preview server; open /src/video/index.html?play)
// Chrome is taken from $CHROME_PATH (defaults to the macOS Google Chrome location).
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const OUT = path.resolve(args.out || path.join(ROOT, 'build', 'frames'));
fs.mkdirSync(OUT, { recursive: true });
const SUB = +(args.sub || 1);
const WORKERS = +(args.workers || 1);
const FPS = 60;
let frames;
if (args.frames) frames = String(args.frames).split(',').map((s) => (s.includes('s') ? Math.round(parseFloat(s) * FPS) : +s));
else { const a = +(args.from || 0), b = +(args.to || 3840); frames = []; for (let i = a; i < b; i++) frames.push(i); }
if (args.skipExisting) frames = frames.filter((f) => !fs.existsSync(path.join(OUT, `f_${String(f).padStart(5, '0')}.png`)));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
if (args.serve) { console.log(`serving http://127.0.0.1:${port}/src/video/index.html?play`); await new Promise(() => {}); }

async function worker(list, id) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--font-render-hinting=none'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[w${id}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`[w${id}] pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/src/video/index.html`, { waitUntil: 'load' });
  const info = await page.evaluate(() => window.__ready);
  if (args.grain !== undefined) await page.evaluate((g) => { window.__grain = g; }, +args.grain);
  const FMT = args.fmt || 'png';
  if (id === 0) console.log('ready', JSON.stringify(info));
  const cdp = await page.createCDPSession();
  const t0 = Date.now();
  let n = 0;
  for (const f of list) {
    await page.evaluate((f, s) => window.renderFrame(f, s), f, SUB);
    const { data } = await cdp.send('Page.captureScreenshot', { format: FMT, quality: FMT === 'jpeg' ? +(args.q || 95) : undefined, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    fs.writeFileSync(path.join(OUT, `f_${String(f).padStart(5, '0')}.${FMT === 'jpeg' ? 'jpg' : 'png'}`), Buffer.from(data, 'base64'));
    n++;
    if (n % 100 === 0) console.log(`[w${id}] ${n}/${list.length}  ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
  }
  await browser.close();
  return { n, ms: (Date.now() - t0) / Math.max(1, n) };
}

const chunks = Array.from({ length: WORKERS }, () => []);
// interleave in blocks so workers finish together
frames.forEach((f, i) => chunks[Math.floor(i / 20) % WORKERS].push(f));
const t0 = Date.now();
const res = await Promise.all(chunks.map((c, i) => (c.length ? worker(c, i) : { n: 0, ms: 0 })));
console.log('done', frames.length, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's', res.map((r) => r.ms.toFixed(0) + 'ms/f').join(' '));
server.close();
