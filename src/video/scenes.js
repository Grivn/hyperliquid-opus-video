// 2D overlay scenes. Each scene is a pure function of time t (seconds).
import { T, SPB, BAR, BOOT, CUES, W, H, SCENES } from '../timeline.js';
import { DATA } from '../generated/data.js';
import { clamp, lerp, prog, ease, hash1, hash2, hash3, noise1, fmt } from './util.js';
import {
  COL, text, measure, decode, slam, rise, rrect, line, brackets, circle, ring,
  drawSymbol, drawLockup, samplePoints, spark, rgba,
} from './draw.js';

const CX = W / 2, CY = H / 2;
const fk = (t) => Math.floor(t * 30); // decode scramble key (stable across motion-blur sub-frames)

// ---------------------------------------------------------------- shared data
export const STATS = [
  { v: 5.69, pre: '$', suf: 'T', dec: 2, label: 'ALL-TIME VOLUME', cn: '累计交易量' },
  { v: 16.9, pre: '$', suf: 'B', dec: 1, label: 'OPEN INTEREST', cn: '未平仓合约' },
  { v: 2.63, pre: '', suf: 'M', dec: 2, label: 'USERS', cn: '用户' },
  { v: 328, pre: '', suf: '', dec: 0, label: 'PERP MARKETS', cn: '永续合约市场' },
];

let legacyPts = null, symPts = null, swarmPts = null;
export function initScenes() {
  legacyPts = samplePoints(W, H, (g) => legacyDraw(g, T(2) - 0.001, true), 5, 0.9, 3);
  symPts = samplePoints(W, H, (g) => drawSymbol(g, CX, CY, 430, '#ffffff', 1), 7, 0.9, 5);
  swarmPts = samplePoints(W, H, (g) => drawSymbol(g, CX, CY - 10, 540, '#ffffff', 1), 8, 1.0, 9);
  return { legacy: legacyPts.length, sym: symPts.length, swarm: swarmPts.length };
}

function group(ctx, px, py, s, fn, alpha = 1, blur = 0) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.translate(px, py); ctx.scale(s, s); ctx.translate(-px, -py);
  fn();
  ctx.restore();
}
const label = (ctx, s, x, y, o = {}) => text(ctx, s, x, y, { font: 'mono', size: 22, weight: 500, track: 10, color: COL.mint, ...o });
const cn = (ctx, s, x, y, o = {}) => text(ctx, s, x, y, { font: 'cn', size: 28, weight: 400, track: 8, color: COL.grey, ...o });

// ================================================================ 0 BOOT
function boot(ctx, t) {
  const x0 = 250, y0 = 430;
  ctx.save();
  ctx.globalAlpha = 1 - prog(t, T(1) - 0.08, T(1));
  text(ctx, 'HYPERLIQUID L1  //  MAINNET', x0, y0 - 96, { font: 'mono', size: 18, weight: 500, track: 6, color: COL.dim, alpha: prog(t, 0.05, 0.25) });
  line(ctx, x0, y0 - 72, x0 + 1420 * ease.outExpo(prog(t, 0.05, 0.7)), y0 - 72, COL.mint, 1, 0.35);
  const n = Math.floor(clamp((t - BOOT.start) / BOOT.charDt, 0, BOOT.line1.length));
  const s1 = BOOT.line1.slice(0, n);
  const o1 = { font: 'mono', size: 36, weight: 500, color: COL.white };
  text(ctx, s1, x0, y0, o1);
  const cw = measure(ctx, s1, o1);
  if (n < BOOT.line1.length || Math.floor(t / (SPB / 2)) % 2 === 0) { ctx.fillStyle = COL.mint; ctx.fillRect(x0 + cw + 8, y0 - 30, 18, 36); }
  BOOT.rows.forEach((r, i) => {
    if (t < r.at - 0.16) return;
    const p = prog(t, r.at - 0.16, r.at + 0.02);
    const y = y0 + 80 + i * 58;
    text(ctx, decode(r.k.toUpperCase(), p, i, fk(t)), x0 + 40, y, { font: 'mono', size: 26, color: COL.grey, track: 3 });
    text(ctx, '.'.repeat(Math.floor(26 * p)), x0 + 330, y, { font: 'mono', size: 26, color: COL.dim });
    text(ctx, decode(r.v, p, i + 9, fk(t)), x0 + 760, y, { font: 'mono', size: 26, weight: 600, color: COL.white });
    if (t >= r.at) text(ctx, '[  OK  ]', x0 + 1200, y, { font: 'mono', size: 26, weight: 700, color: COL.mint, glow: 16 * Math.exp(-(t - r.at) / 0.12) });
  });
  ctx.restore();
}

// ================================================================ 1 LEGACY
const LEG = { x: 200, label: 318, big: 470, rows: [592, 684, 776] };
const LEG_PHRASES = [['hold custody.', '托管你的资产'], ['gatekeep access.', '设置准入门槛'], ['extract value.', '攫取用户创造的价值']];
function legacyDraw(ctx, t, full) {
  const H0 = CUES.legacyHits;
  const lab = full ? { a: 1 } : rise(t, H0[0] - 0.02, 0.3, 20);
  const lw0 = text(ctx, 'LEGACY FINANCE', LEG.x, LEG.label, { font: 'mono', size: 22, weight: 500, track: 8, color: COL.grey, alpha: lab.a });
  text(ctx, '传统金融', LEG.x + lw0 + 28, LEG.label, { font: 'cn', size: 22, weight: 500, track: 6, color: COL.dim, alpha: lab.a });
  const s = full ? { a: 1, s: 1, b: 0 } : slam(t, H0[0], 0.35, 1.16, 18);
  group(ctx, LEG.x, LEG.big - 50, s.s, () => {
    text(ctx, 'INTERMEDIARIES', LEG.x, LEG.big, { size: 160, weight: 800, track: -5, color: '#D3DDDA' });
  }, s.a, s.b);
  LEG_PHRASES.forEach(([en, zh], i) => {
    const r = full ? { a: 1, d: 0 } : rise(t, H0[i + 1], 0.3, 70);
    if (r.a <= 0) return;
    const st = full ? 1 : prog(t, CUES.legacySlashes[i], CUES.legacySlashes[i] + 0.09);
    const y = LEG.rows[i];
    const dimA = 1 - 0.45 * st;
    const w = text(ctx, en, LEG.x + r.d, y, { size: 66, weight: 500, track: -1, color: COL.white, alpha: r.a * dimA });
    text(ctx, zh, LEG.x + r.d + w + 40, y - 4, { font: 'cn', size: 26, track: 4, color: COL.grey, alpha: r.a * dimA });
    if (st > 0) {
      ctx.save(); ctx.fillStyle = COL.red;
      ctx.fillRect(LEG.x - 12, y - 25, (w + 24) * ease.outExpo(st), 7);
      ctx.restore();
    }
  });
}
function legacy(ctx, t) { legacyDraw(ctx, t, false); }

// ================================================================ 2 TURN
const TURN = [['Open.', '开放'], ['Transparent.', '透明'], ['Credibly neutral.', '可信中立']];
function turn(ctx, t) {
  const tau = t - CUES.shatter;
  if (tau >= 0 && tau < 1.1 && legacyPts) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const k = 3.0;
    const f = (1 - Math.exp(-k * tau)) / k;
    for (let i = 0; i < legacyPts.length; i++) {
      const p = legacyPts[i];
      const r1 = hash1(i * 1.37), r2 = hash1(i * 7.1 + 3), r3 = hash1(i * 3.3);
      const dx = p.x - 880, dy = p.y - 560, d = Math.hypot(dx, dy) + 1;
      const sp = 300 + 1300 * r1 * r1;
      const x = p.x + ((dx / d) * sp + (r2 - 0.5) * 600) * f;
      const y = p.y + ((dy / d) * sp + (r3 - 0.5) * 600 - 150) * f + 200 * tau * tau;
      const a = clamp(1 - tau / (0.35 + 0.6 * r2));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      const sz = 2 + 2.5 * r1;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.restore();
  }
  const lab = rise(t, CUES.turnWords[0] - 0.04, 0.3, 16);
  label(ctx, 'ONE FINANCIAL SYSTEM', CX, 330, { align: 'center', alpha: lab.a * (1 - prog(t, T(3) - 0.1, T(3))) });
  CUES.turnWords.forEach((tw, i) => {
    const next = i < 2 ? CUES.turnWords[i + 1] : T(3);
    if (t < tw || t > next + 0.14) return;
    const s = slam(t, tw, 0.34, 0.8, 22);
    const out = prog(t, next - 0.02, next + 0.12);
    const a = s.a * (1 - out), sc = s.s * (1 + 0.3 * ease.inQuad(out));
    group(ctx, CX, 530, sc, () => {
      if (i < 2) text(ctx, TURN[i][0], CX, 600, { size: 196, weight: 800, track: -6, align: 'center', color: i === 0 ? COL.white : COL.mint });
      else {
        const o1 = { size: 176, weight: 800, track: -6 }, o2 = { font: 'serif', italic: true, size: 214 };
        const w1 = measure(ctx, 'Credibly ', o1), w2 = measure(ctx, 'neutral.', o2);
        const x0 = CX - (w1 + w2) / 2;
        text(ctx, 'Credibly ', x0, 600, { ...o1, color: COL.white });
        text(ctx, 'neutral.', x0 + w1, 600, { ...o2, color: COL.mint });
      }
    }, a, s.b + out * 14);
    cn(ctx, TURN[i][1], CX, 712, { size: 40, weight: 500, track: 22, align: 'center', alpha: a });
  });
}

// ================================================================ 3 BUILD
function build(ctx, t, e) {
  const t0 = T(3), gap = CUES.gaps[0][0];
  const inGap = t >= gap;
  const rp = ease.inOutCubic(prog(t, t0, gap));
  const R = 330;
  if (!inGap) {
    const sn = clamp(e.snare * 1.2);
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI / 2 + (i / 90) * Math.PI * 2;
      const on = i / 90 < rp;
      const len = i % 5 === 0 ? 24 : 12;
      ctx.strokeStyle = on ? COL.mint : 'rgba(151,252,227,0.16)';
      ctx.globalAlpha = on ? 0.5 + 0.5 * sn : 1;
      ctx.lineWidth = i % 5 === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
      ctx.lineTo(CX + Math.cos(a) * (R + len), CY + Math.sin(a) * (R + len));
      ctx.stroke();
    }
    ctx.restore();
    ring(ctx, CX, CY, R - 16, COL.mint, 2, 0.85, -Math.PI / 2, -Math.PI / 2 + rp * Math.PI * 2);
    label(ctx, `SYNCING HYPERCORE   ${String(Math.floor(rp * 100)).padStart(3, '0')}%`, CX, CY + R + 92, { align: 'center', size: 20 });
    const intro = rise(t, T(3, 2), 0.3, 14);
    text(ctx, 'INTRODUCING', CX, CY - R - 72, { font: 'mono', size: 28, weight: 600, track: 24, color: COL.white, align: 'center', alpha: intro.a });
  }
  if (!symPts) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = COL.mint;
  for (let i = 0; i < symPts.length; i++) {
    const p = symPts[i];
    const r1 = hash1(i * 2.17), r2 = hash1(i * 5.3 + 1);
    const d0 = t0 + r1 * BAR * 0.45;
    if (t < d0) continue;
    const q = ease.inOutCubic(prog(t, d0, T(3, 3.2)));
    const ang = r2 * Math.PI * 2, rad = 700 + 700 * hash1(i * 9.1);
    const sx = CX + Math.cos(ang) * rad, sy = CY + Math.sin(ang) * rad * 0.7;
    const spin = (1 - q) * 2.4 * (r1 > 0.5 ? 1 : -1);
    const dx = (sx - p.x) * (1 - q), dy = (sy - p.y) * (1 - q);
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const x = p.x + dx * cs - dy * sn, y = p.y + dx * sn + dy * cs;
    ctx.globalAlpha = (0.2 + 0.8 * q) * clamp((t - d0) / 0.2) * (inGap ? 0.4 : 1);
    const sz = 2.2 + 1.6 * r2;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.restore();
}

// ================================================================ 4 LOGO
function shock(ctx, t, t0, x, y, maxR = 1500) {
  for (let k = 0; k < 2; k++) {
    const p = prog(t, t0 + k * 0.08, t0 + k * 0.08 + 0.75);
    if (p > 0 && p < 1) ring(ctx, x, y, 60 + maxR * ease.outExpo(p), COL.mint, 30 * (1 - p) + 1, (1 - p) * 0.75);
  }
}
function logo(ctx, t, e) {
  const t0 = T(4);
  shock(ctx, t, t0, CX, CY - 40);
  const ex = ease.inExpo(prog(t, T(5, 3), T(6)));
  const symIn = prog(t, t0, t0 + 0.45);
  group(ctx, CX, CY - 40, 1 + ex * 1.4, () => {
    drawLockup(ctx, CX, CY - 40, 1420, {
      symScale: lerp(2.6, 1, ease.outExpo(symIn)) * (1 + 0.04 * clamp(e.kick)),
      symAlpha: prog(t, t0, t0 + 0.04),
      letter: (i) => { const r = rise(t, t0 + 0.1 + (i * SPB) / 8, 0.42, 80); return { a: r.a, dy: r.d, blur: 14 * (1 - r.p) }; },
    });
    const tg = prog(t, T(4, 2), T(4, 2) + 0.45);
    if (t >= T(4, 2)) text(ctx, decode('INFRASTRUCTURE TO HOUSE ALL FINANCE', tg, 3, fk(t)), CX, CY + 175, { size: 40, weight: 500, track: 15, color: COL.mint, align: 'center' });
    const c = rise(t, T(4, 3), 0.35, 16);
    cn(ctx, '承载全部金融的基础设施', CX, CY + 240 + c.d, { size: 30, track: 18, align: 'center', alpha: c.a });
  }, 1 - ex, ex * 18);
}

// ================================================================ 5 TPS
function streams(ctx, t, t0, t1) {
  const a = prog(t, t0, t0 + 0.2) * (1 - prog(t, t1 - 0.1, t1));
  if (a <= 0) return;
  const speed = 1200, lh = 27, scroll = (t - t0) * speed;
  const syms = ['BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'SP500', 'GOLD', 'NVDA', 'EUR', 'TSLA'];
  for (const side of [0, 1]) {
    const x = side ? 1540 : 78;
    const k0 = Math.floor(scroll / lh), k1 = Math.ceil((scroll + H) / lh);
    for (let k = k0; k <= k1; k++) {
      const y = H + k * lh - scroll - H + 20;
      const kk = k + side * 5000;
      const buy = hash1(kk * 1.1) > 0.5;
      const sym = syms[Math.floor(hash1(kk * 2.3) * syms.length)];
      const sz = (0.01 + hash1(kk * 3.7) * 9).toFixed(3);
      const px = Math.floor(hash1(kk * 5.9) * 99999).toString(16).toUpperCase().padStart(5, '0');
      const edge = clamp(Math.min(y - 120, H - 120 - y) / 220);
      text(ctx, `${buy ? 'BUY ' : 'SELL'}  ${sym.padEnd(6)} ${sz.padStart(6)}  0x${px}`, x, y, { font: 'mono', size: 16, color: buy ? COL.mint : COL.red, alpha: a * edge * (0.1 + 0.28 * hash1(kk)) });
    }
  }
}
function tps(ctx, t, e) {
  const t0 = T(6);
  streams(ctx, t, t0, T(7));
  const lab = rise(t, t0, 0.3, 14);
  label(ctx, 'HYPERBFT  THROUGHPUT', CX, 330, { size: 24, track: 12, align: 'center', alpha: lab.a });
  const final = '200,000', size = 260;
  const o = { font: 'mono', size, weight: 700 };
  const cw = measure(ctx, '0', o), commaW = measure(ctx, ',', o) * 0.8;
  let total = 0; for (const ch of final) total += ch === ',' ? commaW : cw;
  let x = CX - total / 2;
  const y = 615;
  const pulse = 1 + 0.035 * clamp(e.kick) * (t > T(6, 1) ? 1 : 0);
  group(ctx, CX, y - size * 0.35, pulse, () => {
    let di = 0;
    for (const ch of final) {
      if (ch === ',') { text(ctx, ',', x - cw * 0.12, y, { ...o, color: COL.white }); x += commaW; continue; }
      const d = +ch, turns = 3 + di;
      const p = ease.outExpo(prog(t, t0 + di * 0.015, T(6, 1)));
      const v = (d + 10 * turns) * p;
      const base = Math.floor(v + 1e-6), fr = v - base;
      const lh = size * 0.9;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 6, y - size * 0.76, cw + 12, size * 0.8); ctx.clip();
      text(ctx, String(base % 10), x, y - fr * lh, { ...o, color: COL.white });
      if (fr > 0.001) text(ctx, String((base + 1) % 10), x, y + (1 - fr) * lh, { ...o, color: COL.white });
      ctx.restore();
      x += cw; di++;
    }
  });
  const sub = rise(t, T(6, 1), 0.35, 20);
  text(ctx, 'ORDERS  /  SECOND', CX, 750 + sub.d, { size: 50, weight: 600, track: 18, align: 'center', color: COL.white, alpha: sub.a });
  cn(ctx, '网络每秒可处理 200,000 笔订单', CX, 815 + sub.d, { size: 30, align: 'center', alpha: sub.a });
}

// ================================================================ 6 BLOCK TIME
function chain(ctx, t, t0, t1) {
  const step = SPB / 4, lt = t - t0;
  const n = Math.floor(lt / step), fr = lt / step - n;
  const spacing = 160, bw = 108, y = 800, xNew = 1700;
  const sh = 1 - ease.outExpo(clamp(fr / 0.55));
  const A = prog(t, t0, t0 + 0.12) * (1 - prog(t, t1 - 0.08, t1));
  if (A <= 0) return;
  ctx.save(); ctx.globalAlpha = A;
  for (let k = n; k >= Math.max(0, n - 7); k--) {
    const x = xNew - spacing * (n - k) + spacing * sh;
    if (k > 0 && k > n - 7) {
      const xp = x - spacing;
      line(ctx, xp + bw / 2, y, x - bw / 2, y, COL.mint, 2, 0.5);
      text(ctx, '0.07s', (xp + x) / 2, y - 12, { font: 'mono', size: 13, color: COL.dim, align: 'center' });
    }
    const flash = k === n ? Math.exp(-(lt - n * step) / 0.09) : 0;
    const final = k < n;
    rrect(ctx, x - bw / 2, y - bw / 2, bw, bw, 16);
    ctx.fillStyle = final ? 'rgba(8,52,45,0.92)' : `rgba(151,252,227,${0.12 + 0.6 * flash})`;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = final ? 'rgba(151,252,227,0.75)' : COL.white; ctx.stroke();
    text(ctx, `#${fmt(4_096_000 + k)}`, x, y - 20, { font: 'mono', size: 14, weight: 600, color: final ? COL.mint : COL.white, align: 'center' });
    for (let b = 0; b < 6; b++) {
      const hh = 6 + 22 * hash2(k, b);
      ctx.fillStyle = final ? 'rgba(151,252,227,0.55)' : 'rgba(242,247,246,0.8)';
      ctx.fillRect(x - 36 + b * 13, y + 36 - hh, 8, hh);
    }
    if (final) {
      ctx.save(); ctx.strokeStyle = COL.mint; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(x + 22, y - 38); ctx.lineTo(x + 30, y - 30); ctx.lineTo(x + 44, y - 46); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
  label(ctx, 'FINALIZED', xNew - spacing, y + 92, { size: 14, track: 6, alpha: A * 0.8, align: 'center' });
  label(ctx, 'PROPOSED', xNew, y + 92, { size: 14, track: 6, color: COL.white, alpha: A * 0.8, align: 'center' });
}
function blocktime(ctx, t) {
  const t0 = T(7);
  const s = slam(t, t0, 0.3, 1.2, 16);
  const lw0 = label(ctx, 'BLOCK TIME', 170, 300, { size: 24, track: 12, alpha: s.a });
  cn(ctx, '出块时间', 170 + lw0 + 30, 300, { size: 24, alpha: s.a });
  group(ctx, 170, 470, s.s, () => {
    const w = text(ctx, '0.07', 162, 560, { size: 300, weight: 800, track: -12, color: COL.white });
    text(ctx, 's', 162 + w + 14, 560, { font: 'serif', italic: true, size: 260, color: COL.mint });
  }, s.a, s.b);
  chain(ctx, t, t0, T(8));
  const f = rise(t, T(7, 2), 0.35, 30);
  const fx = 1180, fy = 470;
  if (f.a > 0) {
    const cp = ease.outExpo(prog(t, T(7, 2), T(7, 2) + 0.25));
    ctx.save(); ctx.globalAlpha = f.a; ctx.strokeStyle = COL.mint; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(fx, fy - 20 + f.d);
    ctx.lineTo(lerp(fx, fx + 20, clamp(cp * 2)), lerp(fy - 20, fy, clamp(cp * 2)) + f.d);
    if (cp > 0.5) ctx.lineTo(lerp(fx + 20, fx + 60, (cp - 0.5) * 2), lerp(fy, fy - 44, (cp - 0.5) * 2) + f.d);
    ctx.stroke(); ctx.restore();
  }
  text(ctx, 'ONE-BLOCK', fx + 90, fy - 50 + f.d, { size: 64, weight: 800, track: -2, color: COL.white, alpha: f.a });
  text(ctx, 'FINALITY', fx + 90, fy + 16 + f.d, { size: 64, weight: 800, track: -2, color: COL.mint, alpha: f.a });
  cn(ctx, '单区块最终确认 · 成交即确定', fx + 92, fy + 70 + f.d, { alpha: f.a });
}

// ================================================================ 7 EVERY
const EVERY = [['ORDER', '下单'], ['CANCEL', '撤单'], ['TRADE', '成交'], ['LIQUIDATION', '清算']];
function glyph(ctx, k, lt) {
  const s = 1.25 - 0.25 * ease.outExpo(clamp(lt / 0.3));
  const a = 0.16 * clamp(lt / 0.08);
  ctx.save(); ctx.translate(CX, 520); ctx.scale(s, s); ctx.rotate(lt * 0.25);
  ctx.strokeStyle = COL.mint; ctx.globalAlpha = a; ctx.lineWidth = 4;
  ctx.beginPath();
  if (k === 0) { ctx.rect(-300, -300, 600, 600); ctx.rect(-200, -200, 400, 400); }
  else if (k === 1) { ctx.moveTo(-320, -320); ctx.lineTo(320, 320); ctx.moveTo(320, -320); ctx.lineTo(-320, 320); }
  else if (k === 2) { ctx.moveTo(-360, -90); ctx.lineTo(300, -90); ctx.lineTo(230, -160); ctx.moveTo(360, 90); ctx.lineTo(-300, 90); ctx.lineTo(-230, 160); }
  else { for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2, r0 = 300 + lt * 260 * hash1(i); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); ctx.arc(0, 0, r0, a0, a0 + 0.35); } }
  ctx.stroke(); ctx.restore();
}
function every(ctx, t) {
  const t0 = T(8);
  const k = clamp(Math.floor((t - t0) / SPB), 0, 3);
  const tk = t0 + k * SPB;
  glyph(ctx, k, t - tk);
  const wipe = ease.outExpo(prog(t, tk, tk + 0.13));
  const o = { size: k === 3 ? 196 : 250, weight: 800, track: -8, align: 'center', color: k % 2 ? COL.mint : COL.white };
  const tw = measure(ctx, EVERY[k][0], o);
  ctx.save();
  ctx.beginPath(); ctx.rect(CX - tw / 2 - 30, 300, (tw + 60) * wipe, 420); ctx.clip();
  text(ctx, EVERY[k][0], CX - (1 - wipe) * 80, 615, o);
  ctx.restore();
  text(ctx, `0${k + 1} / 04`, CX, 330, { font: 'mono', size: 22, weight: 500, track: 10, color: COL.dim, align: 'center' });
  cn(ctx, EVERY[k][1], CX, 722, { size: 46, weight: 500, track: 24, align: 'center', alpha: prog(t, tk + 0.04, tk + 0.18) });
  // summary line
  const parts = ['EVERY ORDER', 'CANCEL', 'TRADE', 'LIQUIDATION', '— ONCHAIN'];
  const o2 = { font: 'mono', size: 22, weight: 600, track: 5 };
  const sep = '  ·  ';
  let full = parts.slice(0, 4).join(sep) + '  ' + parts[4];
  let x = CX - measure(ctx, full, o2) / 2;
  parts.forEach((p, i) => {
    const on = i < 4 ? t >= t0 + i * SPB : t >= T(8, 3.5);
    const w = text(ctx, p, x, 900, { ...o2, color: i === 4 ? COL.mint : COL.white, alpha: on ? 1 : 0.18 });
    x += w + measure(ctx, i < 3 ? sep : '  ', o2);
  });
  cn(ctx, '每一笔下单、撤单、成交与清算，全部在链上完成', CX, 952, { size: 24, align: 'center', alpha: prog(t, T(8, 3.4), T(8, 3.6)) });
}

// ================================================================ 8 ORDER BOOK
function book(ctx, t) {
  const t0 = T(9);
  const lt = t - t0;
  const out = prog(t, T(10) - 0.08, T(10));
  ctx.save(); ctx.globalAlpha = 1 - out;
  const hd = rise(t, t0, 0.35, 24);
  text(ctx, 'FULLY ONCHAIN ORDER BOOK', 160, 205 + hd.d, { size: 58, weight: 700, track: -1, color: COL.white, alpha: hd.a });
  cn(ctx, '完全链上的订单簿 · 每一个挂单都公开可查', 162, 256 + hd.d, { size: 26, color: COL.mint, alpha: hd.a });
  text(ctx, 'BTC-USD  ·  PERPETUAL  ·  HYPERCORE', 1760, 205, { font: 'mono', size: 18, weight: 500, track: 4, color: COL.dim, align: 'right', alpha: hd.a });
  // ladder
  const bk = DATA.book, ROWS = 10, rh = 30, px0 = 160, pw = 720, top = 318;
  const asks = bk.asks.slice(0, ROWS), bids = bk.bids.slice(0, ROWS);
  const q8 = Math.floor(lt / (SPB / 2));
  const jit = (side, i) => 1 + 0.5 * (hash3(side, i, q8) - 0.5) * (i > 0 ? 1 : 0.3);
  const cumA = [], cumB = [];
  asks.reduce((a, l, i) => (cumA[i] = a + l[1] * jit(1, i)), 0);
  bids.reduce((a, l, i) => (cumB[i] = a + l[1] * jit(2, i)), 0);
  const mx = Math.max(cumA[ROWS - 1], cumB[ROWS - 1]);
  const midY = top + ROWS * rh + 32;
  text(ctx, 'PRICE (USD)', px0, top - 16, { font: 'mono', size: 15, color: COL.dim, track: 2 });
  text(ctx, 'SIZE (BTC)', px0 + 470, top - 16, { font: 'mono', size: 15, color: COL.dim, track: 2, align: 'right' });
  text(ctx, 'TOTAL', px0 + pw, top - 16, { font: 'mono', size: 15, color: COL.dim, track: 2, align: 'right' });
  const flashRow = Math.floor(hash1(q8 * 1.7) * ROWS * 2);
  const flashA = Math.exp(-(lt - q8 * (SPB / 2)) / 0.12);
  const rowFn = (side, i) => {
    const lv = side === 1 ? asks[i] : bids[i];
    const cum = side === 1 ? cumA[i] : cumB[i];
    const y = side === 1 ? midY - 32 - (i + 1) * rh + rh : midY + 32 + i * rh + rh;
    const r = rise(t, t0 + 0.05 + i * (SPB / 10), 0.3, side === 1 ? -20 : 20);
    if (r.a <= 0) return;
    const rgb = side === 1 ? COL.redRGB : COL.mintRGB;
    ctx.save(); ctx.globalAlpha *= r.a;
    const bwid = (cum / mx) * pw * 0.92;
    ctx.fillStyle = rgba(rgb, 0.13); ctx.fillRect(px0 + pw - bwid, y - rh + 5 + r.d, bwid, rh - 4);
    if (flashRow === i + (side === 1 ? 0 : ROWS)) { ctx.fillStyle = rgba(rgb, 0.35 * flashA); ctx.fillRect(px0, y - rh + 5 + r.d, pw, rh - 4); }
    text(ctx, fmt(lv[0], 0), px0, y - 6 + r.d, { font: 'mono', size: 20, weight: 500, color: side === 1 ? COL.red : COL.mint });
    text(ctx, (lv[1] * jit(side, i)).toFixed(4), px0 + 470, y - 6 + r.d, { font: 'mono', size: 20, color: COL.white, align: 'right' });
    text(ctx, cum.toFixed(3), px0 + pw, y - 6 + r.d, { font: 'mono', size: 20, color: COL.grey, align: 'right' });
    ctx.restore();
  };
  for (let i = 0; i < ROWS; i++) { rowFn(1, i); rowFn(2, i); }
  const mid = (asks[0][0] + bids[0][0]) / 2;
  const mr = rise(t, t0, 0.3, 0);
  line(ctx, px0, midY - 26, px0 + pw, midY - 26, COL.mint, 1, 0.25 * mr.a);
  line(ctx, px0, midY + 30, px0 + pw, midY + 30, COL.mint, 1, 0.25 * mr.a);
  text(ctx, fmt(mid, 1), px0, midY + 14, { font: 'mono', size: 34, weight: 700, color: COL.white, alpha: mr.a });
  text(ctx, `SPREAD  ${fmt(asks[0][0] - bids[0][0], 0)}`, px0 + pw, midY + 12, { font: 'mono', size: 16, color: COL.dim, align: 'right', alpha: mr.a });
  // depth chart
  const dx0 = 990, dx1 = 1760, dy0 = 320, dy1 = 660, dmid = (dx0 + dx1) / 2;
  const rev = ease.outExpo(prog(t, t0 + 0.08, t0 + 0.6));
  brackets(ctx, dx0 - 10, dy0 - 20, dx1 - dx0 + 20, dy1 - dy0 + 40, 16, COL.mint, 0.35 * rev);
  text(ctx, 'DEPTH', dx0 + 6, dy0 + 6, { font: 'mono', size: 14, track: 4, color: COL.dim, alpha: rev });
  const A16 = bk.asks, B16 = bk.bids;
  const span = Math.max(A16[A16.length - 1][0] - mid, mid - B16[B16.length - 1][0]);
  let cA = 0, cB = 0;
  const ca = A16.map((l) => (cA += l[1])), cb = B16.map((l) => (cB += l[1]));
  const cmx = Math.max(cA, cB);
  const X = (p) => dmid + ((p - mid) / span) * (dx1 - dmid);
  const Y = (c) => dy1 - (c / cmx) * (dy1 - dy0 - 30);
  ctx.save();
  ctx.beginPath(); ctx.rect(dmid - (dmid - dx0) * rev, dy0 - 20, (dx1 - dx0) * rev, dy1 - dy0 + 40); ctx.clip();
  for (const [side, L, C] of [[2, B16, cb], [1, A16, ca]]) {
    const rgb = side === 1 ? COL.redRGB : COL.mintRGB;
    ctx.beginPath(); ctx.moveTo(dmid, dy1);
    L.forEach((l, i) => { const xx = X(l[0]); ctx.lineTo(xx, Y(i ? C[i - 1] : 0)); ctx.lineTo(xx, Y(C[i])); });
    ctx.lineTo(X(L[L.length - 1][0]), dy1); ctx.closePath();
    ctx.fillStyle = rgba(rgb, 0.18); ctx.fill();
    ctx.strokeStyle = rgba(rgb, 0.9); ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
  // trades tape
  const tx0 = 990, ty0 = 730;
  text(ctx, 'TRADES', tx0, ty0, { font: 'mono', size: 14, track: 4, color: COL.dim, alpha: rev });
  text(ctx, 'SETTLED ONCHAIN', 1760, ty0, { font: 'mono', size: 14, track: 4, color: COL.mint, align: 'right', alpha: rev });
  const tr = DATA.trades;
  const slide = ease.outExpo(clamp((lt - q8 * (SPB / 2)) / 0.12));
  ctx.save(); ctx.beginPath(); ctx.rect(tx0 - 10, ty0 + 12, 800, 240); ctx.clip();
  for (let r = -1; r < 7; r++) {
    const idx = q8 - r;
    if (idx < 0) continue;
    const trd = tr[((idx % tr.length) + tr.length) % tr.length];
    const y = ty0 + 46 + (r + slide) * 32;
    const buy = trd[2] > 0;
    const a = (r === -1 ? slide : 1) * rev * (1 - r * 0.1);
    const px = trd[0] + (hash2(idx, 3) - 0.5) * 6;
    text(ctx, fmt(Math.round(px), 0), tx0, y, { font: 'mono', size: 20, weight: 500, color: buy ? COL.mint : COL.red, alpha: a });
    text(ctx, (trd[1] * (0.5 + hash2(idx, 9))).toFixed(5), tx0 + 330, y, { font: 'mono', size: 20, color: COL.white, align: 'right', alpha: a });
    text(ctx, buy ? 'BUY' : 'SELL', tx0 + 470, y, { font: 'mono', size: 18, color: buy ? COL.mint : COL.red, alpha: a * 0.8 });
    text(ctx, `0x${Math.floor(hash2(idx, 5) * 0xffffff).toString(16).padStart(6, '0')}…`, 1760, y, { font: 'mono', size: 18, color: COL.dim, align: 'right', alpha: a });
  }
  ctx.restore();
  ctx.restore();
}

// ================================================================ 9 CHART
function chart(ctx, t) {
  const t0 = T(10);
  const all = DATA.btc15, N = 150, cs = all.slice(all.length - N);
  const x0 = 160, x1 = 1600, y0 = 300, y1 = 880;
  let lo = Infinity, hi = -Infinity;
  for (const c of cs) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[1]); }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const Y = (p) => y1 - ((p - lo) / (hi - lo)) * (y1 - y0);
  const step = (x1 - x0) / N, cw = step * 0.62;
  const lt = t - t0;
  const q = Math.floor(lt / (SPB / 4));
  const shown = clamp((q + 1) * 10, 0, N);
  const out = prog(t, T(11) - 0.08, T(11));
  ctx.save(); ctx.globalAlpha = 1 - out;
  const ga = prog(t, t0, t0 + 0.15);
  for (let i = 0; i <= 5; i++) {
    const p = lo + ((hi - lo) * i) / 5, y = Y(p);
    line(ctx, x0, y, x1, y, COL.mint, 1, 0.08 * ga);
    text(ctx, fmt(p, 0), x1 + 24, y + 6, { font: 'mono', size: 16, color: COL.dim, alpha: ga });
  }
  for (let i = 0; i < shown; i++) {
    const [o, h, l, c] = cs[i];
    const up = c >= o;
    const x = x0 + i * step + step / 2;
    const born = t0 + Math.floor(i / 10) * (SPB / 4);
    const g = ease.outBack(clamp((t - born) / 0.12));
    const col = up ? COL.mint : COL.red;
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    const mid = (Y(o) + Y(c)) / 2;
    ctx.beginPath(); ctx.moveTo(x, mid + (Y(h) - mid) * g); ctx.lineTo(x, mid + (Y(l) - mid) * g); ctx.stroke();
    const bh = Math.max(2, Math.abs(Y(o) - Y(c))) * g;
    ctx.fillRect(x - cw / 2, mid - bh / 2, cw, bh);
  }
  // EMA
  if (shown > 2) {
    ctx.save(); ctx.strokeStyle = 'rgba(242,247,246,0.75)'; ctx.lineWidth = 2; ctx.beginPath();
    let ema = cs[0][3];
    for (let i = 0; i < shown; i++) {
      ema = ema + (2 / 21) * (cs[i][3] - ema);
      const x = x0 + i * step + step / 2;
      i ? ctx.lineTo(x, Y(ema)) : ctx.moveTo(x, Y(ema));
    }
    ctx.stroke(); ctx.restore();
    const last = cs[shown - 1][3], ly = Y(last), lx = x0 + (shown - 1) * step + step / 2;
    ctx.save(); ctx.setLineDash([6, 6]); line(ctx, lx, ly, x1, ly, COL.mint, 1, 0.8); ctx.restore();
    line(ctx, lx, y0, lx, y1, COL.white, 1, 0.18);
    rrect(ctx, x1 + 10, ly - 18, 130, 36, 6); ctx.fillStyle = COL.mint; ctx.fill();
    text(ctx, fmt(last, 0), x1 + 75, ly + 7, { font: 'mono', size: 18, weight: 700, color: COL.deep, align: 'center' });
    circle(ctx, lx, Y(cs[shown - 1][3]), 5, COL.white, 1);
  }
  text(ctx, 'BTC-USD PERP  ·  15M CANDLES  ·  HYPERLIQUID MARKET DATA', x0, y1 + 50, { font: 'mono', size: 16, track: 3, color: COL.dim, alpha: ga });
  // words
  const WORDS = [['TRANSPARENT.', COL.white], ['EFFICIENT.', COL.white], ['RESILIENT.', COL.mint]];
  let x = x0;
  WORDS.forEach(([w, c], i) => {
    const s = slam(t, t0 + i * SPB, 0.28, 1.25, 12);
    const o = { size: 72, weight: 800, track: -2 };
    const ww = measure(ctx, w, o);
    group(ctx, x + ww / 2, 200, s.s, () => text(ctx, w, x, 225, { ...o, color: c }), s.a, s.b);
    x += ww + 34;
  });
  const c = rise(t, T(10, 3), 0.3, 10);
  cn(ctx, '透明 · 高效 · 稳健', x0 + 2, 268 + c.d, { size: 26, color: COL.mint, alpha: c.a });
  ctx.restore();
}

// ================================================================ 10 CUSTODY
function custody(ctx, t, e) {
  const t0 = T(11);
  const lb = (t - t0) / SPB;
  const col = ease.inExpo(prog(t, T(11, 3.4), T(12)));
  const ox = 600, oy = 560;
  group(ctx, ox, oy, 1 - col * 0.7, () => {
    const rings = [[270, 72, 1], [205, 48, -1], [140, 3, 1]];
    rings.forEach(([r, ticks, dir], k) => {
      const b = Math.floor(clamp(lb, 0, 2.99));
      const f = ease.outBack(clamp((lb - b) / 0.35));
      const locked = lb >= 2;
      const ang = locked ? 0 : dir * ((b + f) * (0.7 + k * 0.35)) + 0.4 * dir;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
      ctx.strokeStyle = locked ? COL.mint : 'rgba(151,252,227,0.55)';
      ctx.lineWidth = k === 2 ? 5 : 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2;
        const len = k === 2 ? 26 : i % 6 === 0 ? 20 : 9;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len)); ctx.stroke();
      }
      ctx.fillStyle = COL.mint; ctx.fillRect(-5, -r - 16, 10, 16);
      ctx.restore();
    });
    const lockA = prog(t, T(11, 2), T(11, 2) + 0.12);
    const fl = t >= T(11, 2) ? Math.exp(-(t - T(11, 2)) / 0.2) : 0;
    ring(ctx, ox, oy, 300 + 60 * (1 - fl), COL.mint, 3, fl * 0.8);
    // padlock
    ctx.save(); ctx.translate(ox, oy + 10);
    ctx.strokeStyle = lockA > 0 ? COL.mint : COL.white; ctx.fillStyle = lockA > 0 ? COL.mint : 'rgba(242,247,246,0.9)'; ctx.lineWidth = 12;
    const shackle = (1 - lockA) * 18;
    ctx.beginPath(); ctx.arc(0, -30 - shackle, 38, Math.PI, 0); ctx.lineTo(38, -12 - shackle); ctx.moveTo(-38, -30 - shackle); ctx.lineTo(-38, -12); ctx.stroke();
    rrect(ctx, -58, -18, 116, 88, 12); ctx.fill();
    ctx.fillStyle = COL.deep; ctx.beginPath(); ctx.arc(0, 18, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-4, 20, 8, 28);
    ctx.restore();
  }, 1 - col);
  const tx = 960;
  const s = slam(t, t0, 0.3, 1.15, 14);
  group(ctx, tx, 480, s.s, () => text(ctx, 'NON-CUSTODIAL', tx, 520, { size: 104, weight: 800, track: -4, color: COL.white }), s.a * (1 - col), s.b);
  const r1 = rise(t, T(11, 1), 0.35, 24);
  text(ctx, 'Hyperliquid does not take custody of user funds.', tx + 4, 600 + r1.d, { size: 36, weight: 400, color: COL.grey, alpha: r1.a * (1 - col) });
  cn(ctx, '非托管：Hyperliquid 不托管用户资金', tx + 4, 660 + r1.d, { alpha: r1.a * (1 - col), color: COL.mint });
  const r2 = rise(t, T(11, 2), 0.35, 16);
  text(ctx, 'OPTIONAL QUALIFIED CUSTODY', tx + 4, 760 + r2.d, { font: 'mono', size: 15, track: 5, color: COL.dim, alpha: r2.a * (1 - col) });
  text(ctx, 'ANCHORAGE · BITGO · FALCONX · FIREBLOCKS · KOMAINU', tx + 4, 792 + r2.d, { font: 'mono', size: 17, weight: 500, track: 3, color: COL.grey, alpha: r2.a * (1 - col) });
}

// ================================================================ 11 ARCHITECTURE
const ISO = { cx: 1170, cy: 700, u: 74 };
const iso = (x, y, z) => [ISO.cx + (x - z) * 0.866 * ISO.u, ISO.cy + (x + z) * 0.5 * ISO.u - y * ISO.u];
function slab(ctx, x, y, z, w, d, h, p, fillA, glow) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, ya = y, yb = y + h;
  const P = (a, b, c) => iso(a, b, c);
  const top = [P(x0, yb, z0), P(x1, yb, z0), P(x1, yb, z1), P(x0, yb, z1)];
  const right = [P(x1, yb, z0), P(x1, yb, z1), P(x1, ya, z1), P(x1, ya, z0)];
  const left = [P(x0, yb, z1), P(x1, yb, z1), P(x1, ya, z1), P(x0, ya, z1)];
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  if (fillA > 0) {
    ctx.save(); ctx.globalAlpha *= fillA;
    poly(right, 'rgba(3,26,22,0.95)'); poly(left, 'rgba(5,38,33,0.95)'); poly(top, `rgba(10,62,54,0.96)`);
    ctx.restore();
  }
  const edges = [[top[0], top[1]], [top[1], top[2]], [top[2], top[3]], [top[3], top[0]], [right[1], right[2]], [right[2], right[3]], [right[0], right[3]], [left[0], left[3]], [left[3], left[2]]];
  ctx.save(); ctx.strokeStyle = COL.mint; ctx.lineWidth = 2; ctx.globalAlpha *= 0.9;
  if (glow) { ctx.shadowColor = COL.mint; ctx.shadowBlur = glow; }
  ctx.beginPath();
  edges.forEach(([a, b]) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], p), lerp(a[1], b[1], p)); });
  ctx.stroke(); ctx.restore();
  return { top, right, left };
}
function arch(ctx, t, e) {
  const t0 = T(12);
  const out = prog(t, T(14) - 0.12, T(14));
  ctx.save(); ctx.globalAlpha = 1 - out;
  const h = rise(t, t0, 0.4, 24);
  const o1 = { size: 76, weight: 700, track: -2 };
  const w1 = text(ctx, 'Two engines. ', 160, 210 + h.d, { ...o1, color: COL.white, alpha: h.a });
  text(ctx, 'One', 160 + w1, 210 + h.d, { font: 'serif', italic: true, size: 92, color: COL.mint, alpha: h.a });
  const w2 = measure(ctx, 'One', { font: 'serif', italic: true, size: 92 });
  text(ctx, ' consensus.', 160 + w1 + w2, 210 + h.d, { ...o1, color: COL.white, alpha: h.a });
  cn(ctx, '双引擎，同一共识 · 同一状态', 164, 262 + h.d, { alpha: h.a });
  // slabs
  const pB = ease.outCubic(prog(t, t0, t0 + 0.45));
  const fB = prog(t, t0 + 0.25, t0 + 0.5);
  const kick = clamp(e.kick) * 0.6;
  const drop = (t1) => { const q = prog(t, t1, t1 + 0.4); return { y: (1 - ease.outBack(q)) * 5, a: prog(t, t1, t1 + 0.1), q }; };
  const dC = drop(T(12, 2)), dE = drop(T(12, 3));
  const beam = prog(t, T(13), T(13) + 0.2);
  const b0 = slab(ctx, 0, 0, 0, 8.6, 5.2, 0.55, pB, fB, 10 + 14 * kick);
  // beams down to consensus
  if (beam > 0) {
    for (const xx of [-2.2, 2.2]) {
      const a = iso(xx, 0.55, 0), b = iso(xx, 1.6, 0);
      const pulse = 0.4 + 0.6 * clamp(e.kick);
      ctx.save(); ctx.strokeStyle = COL.mint; ctx.globalAlpha = beam * pulse; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
    }
  }
  const tC = dC.a > 0 ? slab(ctx, -2.2, 1.6 + dC.y, 0, 3.6, 4.0, 0.9, 1, dC.a, 8) : null;
  const tE = dE.a > 0 ? slab(ctx, 2.2, 1.6 + dE.y, 0, 3.6, 4.0, 0.9, 1, dE.a, 8) : null;
  // packets between Core and EVM
  if (beam > 0) {
    for (let i = 0; i < 6; i++) {
      const ph = ((t * 0.9 + i / 6) % 1);
      const dir = i % 2 ? 1 : -1;
      const u = dir > 0 ? ph : 1 - ph;
      const p = iso(lerp(-0.4, 0.4, u), 2.5, lerp(-1.2, 1.2, (i % 3) / 2));
      ctx.save(); ctx.globalAlpha = beam * Math.sin(ph * Math.PI); ctx.fillStyle = COL.white; ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); ctx.restore();
    }
  }
  // labels
  const lb = (x, y, ttl, sub, zh, a) => {
    text(ctx, ttl, x, y, { size: 40, weight: 700, color: COL.white, alpha: a, align: 'center' });
    text(ctx, sub, x, y + 30, { font: 'mono', size: 15, track: 4, color: COL.mint, alpha: a, align: 'center' });
    cn(ctx, zh, x, y + 62, { size: 20, alpha: a * 0.9, align: 'center' });
  };
  lb(520, 760, 'HyperBFT', 'CONSENSUS · ONE-BLOCK FINALITY', '共识层 · 单区块最终确认', fB);
  if (tC) lb(560, 390 - dC.y * 20, 'HyperCore', 'PERPS · SPOT · ORDER BOOKS', '永续 · 现货 · 链上订单簿', dC.a);
  if (tE) lb(1560, 390 - dE.y * 20, 'HyperEVM', 'SMART CONTRACTS · APPS', '智能合约 · 应用生态', dE.a);
  const r = rise(t, T(13, 1), 0.35, 14);
  label(ctx, 'ONE STATE · SECURED BY THE SAME CONSENSUS', 160, 960 + r.d, { size: 18, track: 6, alpha: r.a });
  ctx.restore();
}

// ================================================================ 12 VALIDATORS
function validators(ctx, t, e) {
  const t0 = T(14), gap = CUES.gaps[1][0];
  const inGap = t >= gap;
  const cx = 1260, cy = 540, Rx = 430, Ry = 170;
  const lb = (t - t0) / SPB;
  let r, p;
  if (t < T(15)) { r = Math.floor(lb); p = lb - r; }
  else { const q = (t - T(15)) / (SPB / 2); r = 4 + Math.floor(q); p = q - Math.floor(q); }
  const spin = t * 0.35 + ease.inQuad(prog(t, T(15), gap)) * 3;
  const L = (r * 11 + 3) % 27;
  const dist = (i) => Math.min(Math.abs(i - L), 27 - Math.abs(i - L));
  const vt = (i) => (i === L ? 0 : 0.16 + 0.55 * (dist(i) / 13.5) + 0.06 * hash2(i, r));
  const times = [...Array(27).keys()].map(vt).sort((a, b) => a - b);
  const pc = times[18];
  const voted = [...Array(27).keys()].filter((i) => p >= vt(i)).length;
  const A = (1 - prog(t, T(15, 1.6), T(15, 2.1)) * 0.9) * (inGap ? 0 : 1) * prog(t, t0, t0 + 0.2);
  if (A > 0) {
    const nodes = [...Array(27).keys()].map((i) => {
      const a = spin + (i / 27) * Math.PI * 2;
      return { i, x: cx + Math.cos(a) * Rx, y: cy + Math.sin(a) * Ry, d: (Math.sin(a) + 1) / 2 };
    });
    const lead = nodes[L];
    ctx.save(); ctx.globalAlpha = A;
    // proposal lines
    const lp = clamp(p / 0.2);
    for (const n of nodes) {
      if (n.i === L) continue;
      const v = p >= vt(n.i);
      ctx.strokeStyle = v ? COL.mint : 'rgba(242,247,246,0.5)';
      ctx.globalAlpha = A * (v ? 0.55 : 0.18) * (1 - clamp((p - 0.85) / 0.15));
      ctx.lineWidth = v ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(lead.x, lead.y); ctx.lineTo(lerp(lead.x, n.x, lp), lerp(lead.y, n.y, lp)); ctx.stroke();
    }
    ctx.globalAlpha = A;
    ctx.save(); ctx.strokeStyle = 'rgba(151,252,227,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    nodes.sort((a, b) => a.d - b.d).forEach((n) => {
      const v = p >= vt(n.i);
      const isL = n.i === L;
      const rad = (isL ? 14 : 9) * (0.7 + 0.5 * n.d);
      circle(ctx, n.x, n.y, rad + (isL ? 10 * (1 - p) : 0), COL.mint, isL ? 0.25 : 0);
      circle(ctx, n.x, n.y, rad, v || isL ? COL.mint : '#2A5A50', 0.5 + 0.5 * n.d);
      text(ctx, `V${String(n.i + 1).padStart(2, '0')}`, n.x, n.y - rad - 10, { font: 'mono', size: 12, color: v ? COL.mint : COL.dim, align: 'center', alpha: 0.35 + 0.65 * n.d });
    });
    // commit
    const ca = p >= pc ? Math.exp(-(p - pc) * 5) : 0;
    text(ctx, p >= pc ? 'COMMITTED' : 'VOTING…', cx, cy - 6, { font: 'mono', size: 30, weight: 700, track: 8, color: p >= pc ? COL.mint : COL.white, align: 'center', glow: 20 * ca });
    text(ctx, `BLOCK #${fmt(4_096_120 + r)}`, cx, cy + 30, { font: 'mono', size: 16, track: 4, color: COL.grey, align: 'center' });
    // quorum bar
    const qx = cx - 324, qy = cy + 250;
    for (let i = 0; i < 27; i++) {
      ctx.fillStyle = i < voted ? (i < 18 ? 'rgba(151,252,227,0.75)' : COL.mint) : 'rgba(151,252,227,0.14)';
      ctx.fillRect(qx + i * 24, qy, 18, 22);
    }
    line(ctx, qx + 18 * 24 - 3, qy - 14, qx + 18 * 24 - 3, qy + 36, COL.white, 2, 0.9);
    text(ctx, '2/3', qx + 18 * 24 - 3, qy - 22, { font: 'mono', size: 14, weight: 700, color: COL.white, align: 'center' });
    text(ctx, `QUORUM ${voted}/27`, qx, qy + 58, { font: 'mono', size: 15, track: 4, color: COL.grey });
    ctx.restore();
  }
  // left copy
  const tA = 1 - prog(t, T(15), T(15, 0.5));
  if (tA > 0 && !inGap) {
    const s = slam(t, t0, 0.3, 1.15, 14);
    group(ctx, 150, 300, s.s, () => text(ctx, 'HyperBFT', 150, 330, { size: 104, weight: 800, track: -4, color: COL.white }), s.a * tA, s.b);
    const lines = [['27 validators', '27 个活跃验证者'], ['>2/3 of stake commits each block', '超过 2/3 质押权重确认每个区块'], ['Delegated proof-of-stake', '委托权益证明（DPoS）']];
    lines.forEach(([en, zh], i) => {
      const r2 = rise(t, T(14, i + 1), 0.35, 20);
      text(ctx, en, 154, 430 + i * 104 + r2.d, { size: 36, weight: 500, color: i === 0 ? COL.mint : COL.white, alpha: r2.a * tA });
      cn(ctx, zh, 156, 470 + i * 104 + r2.d, { size: 22, alpha: r2.a * tA });
    });
  }
  // build statement
  const s2 = slam(t, T(15, 2), 0.3, 0.85, 20);
  if (s2.a > 0) {
    group(ctx, CX, 520, s2.s, () => {
      const o1 = { size: 120, weight: 800, track: -4 }, o2 = { font: 'serif', italic: true, size: 150 };
      const a1 = 'Now, trade ', a2 = 'everything.';
      const w1 = measure(ctx, a1, o1), w2 = measure(ctx, a2, o2);
      const x0 = CX - (w1 + w2) / 2;
      text(ctx, a1, x0, 560, { ...o1, color: COL.white });
      text(ctx, a2, x0 + w1, 560, { ...o2, color: COL.mint });
    }, s2.a, s2.b);
    const c = rise(t, T(15, 2.5), 0.3, 10);
    cn(ctx, '现在，交易一切。', CX, 650 + c.d, { size: 38, track: 20, align: 'center', alpha: c.a, color: COL.white });
  }
}

// ================================================================ 13 EVERYTHING
const CATS = [
  { k: 'crypto', en: 'CRYPTO', zh: '加密资产', at: T(16, 0) },
  { k: 'equities', en: 'EQUITIES', zh: '美股', at: T(16, 2) },
  { k: 'commodities', en: 'COMMODITIES', zh: '大宗商品', at: T(17, 0) },
  { k: 'fx', en: 'FX', zh: '外汇', at: T(17, 1) },
  { k: 'indices', en: 'INDICES', zh: '指数', at: T(17, 2) },
  { k: 'all', en: 'ALL ONCHAIN.', zh: '全部链上', at: T(17, 3) },
];
function fmtPx(v) {
  if (v >= 10000) return fmt(v, 0);
  if (v >= 1000) return fmt(v, 1);
  if (v >= 100) return fmt(v, 2);
  if (v >= 10) return fmt(v, 3);
  return fmt(v, 4);
}
function everything(ctx, t, e) {
  const t0 = T(16);
  const lt = t - t0;
  const cols = 6, rows = 4, tw = 272, th = 160, gx = 14, gy = 14;
  const gx0 = (W - (cols * tw + (cols - 1) * gx)) / 2, gy0 = 300;
  const ci = CATS.filter((c) => t >= c.at).length - 1;
  const cur = CATS[Math.max(0, ci)];
  const q8 = Math.floor(lt / (SPB / 2));
  // category title
  const s = slam(t, cur.at, 0.26, 1.18, 12);
  group(ctx, 110, 200, s.s, () => {
    const w = text(ctx, cur.en, gx0, 238, { size: 112, weight: 800, track: -4, color: cur.k === 'all' ? COL.mint : COL.white });
    cn(ctx, cur.zh, gx0 + w + 30, 232, { size: 40, weight: 500, track: 10, color: COL.mint });
  }, s.a, s.b);
  text(ctx, `${fmt(DATA.counts.perpMain + DATA.counts.perpHip3)} PERP MARKETS · ONE ACCOUNT`, W - gx0, 236, { font: 'mono', size: 18, track: 4, color: COL.grey, align: 'right', alpha: prog(t, t0 + 0.2, t0 + 0.5) });
  DATA.tiles.slice(0, 24).forEach((tile, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = gx0 + c * (tw + gx), y = gy0 + r * (th + gy);
    const born = t0 + (c + r) * (SPB / 8);
    const g = ease.outBack(clamp((t - born) / 0.24));
    if (g <= 0) return;
    const hl = cur.k === 'all' || tile.cat === cur.k;
    const dim = hl ? 1 : 0.32;
    // live tick
    const tick = Math.floor(hash2(i, q8) * 3) === 0 && lt > 0.4;
    const tickT = t0 + q8 * (SPB / 2);
    const fl = tick ? Math.exp(-(t - tickT) / 0.15) : 0;
    const drift = 1 + (hash2(i, q8) - 0.5) * 0.0016 * (lt > 0.4 ? 1 : 0);
    const up = tile.chg >= 0;
    ctx.save();
    ctx.translate(x + tw / 2, y + th / 2); ctx.scale(1, g); ctx.translate(-(x + tw / 2), -(y + th / 2));
    ctx.globalAlpha = dim * clamp((t - born) / 0.08);
    rrect(ctx, x, y, tw, th, 14);
    ctx.fillStyle = hl && cur.k !== 'all' ? 'rgba(10,64,56,0.92)' : 'rgba(4,30,26,0.88)'; ctx.fill();
    if (fl > 0.01) { ctx.fillStyle = rgba(up ? COL.mintRGB : COL.redRGB, 0.22 * fl); ctx.fill(); }
    ctx.lineWidth = hl && cur.k !== 'all' ? 2 : 1; ctx.strokeStyle = hl && cur.k !== 'all' ? COL.mint : 'rgba(151,252,227,0.2)'; ctx.stroke();
    text(ctx, tile.label, x + 20, y + 44, { size: 30, weight: 700, track: -0.5, color: hl && cur.k !== 'all' ? COL.mint : COL.white });
    text(ctx, tile.cat.toUpperCase(), x + 20, y + 68, { font: 'mono', size: 12, track: 3, color: COL.dim });
    text(ctx, fmtPx(tile.px * drift), x + 20, y + 118, { font: 'mono', size: 30, weight: 500, color: COL.white });
    text(ctx, `${up ? '+' : ''}${tile.chg.toFixed(2)}%`, x + 20, y + 146, { font: 'mono', size: 17, color: up ? COL.mint : COL.red });
    text(ctx, `${tile.lev}x`, x + tw - 18, y + 42, { font: 'mono', size: 14, color: COL.grey, align: 'right' });
    spark(ctx, tile.spark, x + 150, y + 92, 102, 50, up ? COL.mint : COL.red, 2, 0.9, clamp((t - born) / 0.5));
    ctx.restore();
  });
  text(ctx, `LIVE MARKET SNAPSHOT · HYPERLIQUID API · ${DATA.asOf.slice(0, 10)}`, gx0, gy0 + rows * (th + gy) + 22, { font: 'mono', size: 14, track: 3, color: COL.dim, alpha: prog(t, t0 + 0.3, t0 + 0.6) });
}

// ================================================================ 14 ALWAYS (24/7)
const CITIES = [['NEW YORK', 40.7, -74], ['LONDON', 51.5, -0.1], ['DUBAI', 25.2, 55.3], ['SINGAPORE', 1.35, 103.8], ['HONG KONG', 22.3, 114.2], ['TOKYO', 35.7, 139.7], ['SÃO PAULO', -23.5, -46.6], ['SYDNEY', -33.9, 151.2], ['SEOUL', 37.6, 127.0], ['FRANKFURT', 50.1, 8.7]];
export function globeParams(t) {
  return { cx: 1340, cy: 560, R: 380, yaw: -1.2 + (t - T(18)) * 0.42, pitch: 0.38 };
}
function globeProject(G, lat, lon) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180 + G.yaw;
  let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
  const c = Math.cos(G.pitch), s = Math.sin(G.pitch);
  const y2 = y * c - z * s, z2 = y * s + z * c;
  return { x: G.cx + x * G.R, y: G.cy - y2 * G.R, z: z2 };
}
function always(ctx, t, e) {
  const t0 = T(18);
  const G = globeParams(t);
  const ga = prog(t, t0, t0 + 0.3) * (1 - prog(t, T(20) - 0.1, T(20)));
  // city markers
  CITIES.forEach(([name, lat, lon], i) => {
    const p = globeProject(G, lat, lon);
    if (p.z < 0.12) return;
    const beat = Math.floor((t - t0) / SPB);
    const hot = beat % CITIES.length === i || (beat + 5) % CITIES.length === i;
    const bt = t0 + beat * SPB;
    const pr = hot ? prog(t, bt, bt + 0.5) : 1;
    const a = ga * clamp((p.z - 0.12) / 0.2);
    ring(ctx, p.x, p.y, 6 + 40 * ease.outExpo(pr), COL.mint, 2, a * (1 - pr));
    circle(ctx, p.x, p.y, 5, COL.white, a);
    line(ctx, p.x, p.y, p.x + 26, p.y - 26, COL.mint, 1, a * 0.7);
    text(ctx, name, p.x + 30, p.y - 30, { font: 'mono', size: 14, weight: 600, track: 3, color: COL.white, alpha: a });
    text(ctx, 'OPEN', p.x + 30, p.y - 12, { font: 'mono', size: 12, track: 3, color: COL.mint, alpha: a * 0.9 });
  });
  const s = slam(t, t0, 0.3, 1.2, 16);
  group(ctx, 150, 470, s.s, () => text(ctx, '24/7', 142, 520, { size: 280, weight: 800, track: -14, color: COL.white }), s.a, s.b);
  const r1 = rise(t, T(18, 2), 0.35, 20), r2 = rise(t, T(19, 0), 0.35, 20), r3 = rise(t, T(19, 1), 0.35, 12);
  text(ctx, 'One account.', 150, 640 + r1.d, { size: 64, weight: 700, track: -2, color: COL.white, alpha: r1.a });
  text(ctx, 'Markets that never close.', 150, 720 + r2.d, { size: 64, weight: 700, track: -2, color: COL.mint, alpha: r2.a });
  cn(ctx, '一个账户 · 全天候交易 · 永不休市', 154, 782 + r3.d, { alpha: r3.a });
  // ticker crawl
  const cr = prog(t, T(18, 2), T(18, 2) + 0.3) * (1 - prog(t, T(20) - 0.1, T(20)));
  if (cr > 0) {
    const y = 930;
    ctx.save(); ctx.globalAlpha = cr;
    ctx.fillStyle = 'rgba(2,20,17,0.85)'; ctx.fillRect(0, y - 34, W, 52);
    line(ctx, 0, y - 34, W, y - 34, COL.mint, 1, 0.35); line(ctx, 0, y + 18, W, y + 18, COL.mint, 1, 0.35);
    const items = DATA.tiles.map((tl) => [tl.label, fmtPx(tl.px), tl.chg]);
    const o = { font: 'mono', size: 20, weight: 500 };
    let x = W - (t - T(18, 2)) * 420;
    let guard = 0;
    while (x < W && guard++ < 200) {
      for (const [lb, px, ch] of items) {
        if (x > W) break;
        const w1 = text(ctx, lb, x, y, { ...o, color: COL.white });
        const w2 = text(ctx, px, x + w1 + 12, y, { ...o, color: COL.grey });
        const w3 = text(ctx, `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%`, x + w1 + w2 + 24, y, { ...o, color: ch >= 0 ? COL.mint : COL.red });
        x += w1 + w2 + w3 + 70;
      }
    }
    ctx.restore();
  }
}

// ================================================================ 15 BUILDERS
const ORBITS = [
  { rx: 220, ry: 112, sp: 0.35, names: ['Trade[XYZ]', 'Felix', 'Ventuals', 'Paragon', 'HyENA'] },
  { rx: 360, ry: 190, sp: -0.22, names: ['HyperLend', 'Morpho', 'Kinetiq', 'Rysk', 'dreamcash', 'EntropyIO'] },
  { rx: 500, ry: 270, sp: 0.14, names: ['Wallets', 'Frontends', 'Trading bots', 'Terminals', 'Vaults', 'Apps'] },
];
const BLOCKS = [
  { at: T(20, 0), h: 'BUILDER CODES', b: 'Tap into Hyperliquid liquidity.\nCharge fees on every order.', zh: '接入 Hyperliquid 流动性，按单收取费用' },
  { at: T(20, 2), h: 'HIP-3', b: 'Builder-deployed\nperpetual markets.', zh: '由开发者部署的永续合约市场' },
  { at: T(21, 0), h: 'HYPEREVM', b: 'Smart contracts on the\nsame chain as the order books.', zh: '与订单簿同链运行的智能合约' },
  { at: T(21, 2), h: null, b: 'Builders own their users.\nHyperliquid provides the liquidity.', zh: '开发者拥有用户，Hyperliquid 提供流动性与执行' },
];
function builders(ctx, t, e) {
  const t0 = T(20);
  const hx = 1330, hy = 580;
  const A = prog(t, t0, t0 + 0.25) * (1 - prog(t, T(22) - 0.1, T(22))) * (1 - 0.55 * ease.inOutCubic(prog(t, T(21, 1.8), T(21, 2.2))));
  ctx.save(); ctx.globalAlpha = A;
  let idx = 0;
  ORBITS.forEach((o, k) => {
    ctx.save(); ctx.strokeStyle = 'rgba(151,252,227,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.ellipse(hx, hy, o.rx, o.ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    o.names.forEach((nm, j) => {
      const born = t0 + 0.12 + idx * (SPB / 4);
      idx++;
      const g = ease.outBack(clamp((t - born) / 0.25));
      if (g <= 0) return;
      const a = o.sp * (t - t0) + (j / o.names.length) * Math.PI * 2 + k;
      const x = hx + Math.cos(a) * o.rx, y = hy + Math.sin(a) * o.ry;
      const depth = (Math.sin(a) + 1) / 2;
      ctx.save(); ctx.globalAlpha = A * (0.45 + 0.55 * depth) * clamp((t - born) / 0.1);
      line(ctx, hx, hy, x, y, COL.mint, 1, 0.14);
      const ph = ((t - t0) * 1.2 + j * 0.37 + k * 0.21) % 1;
      circle(ctx, lerp(x, hx, ph), lerp(y, hy, ph), 3, COL.mint, 0.9 * Math.sin(ph * Math.PI));
      const o2 = { font: k === 2 ? 'mono' : 'sans', size: k === 2 ? 15 : 20, weight: k === 2 ? 500 : 600 };
      const w = measure(ctx, nm, o2) + 30;
      ctx.translate(x, y); ctx.scale(g * (0.85 + 0.2 * depth), g * (0.85 + 0.2 * depth));
      rrect(ctx, -w / 2, -18, w, 36, 18);
      ctx.fillStyle = k === 0 ? 'rgba(151,252,227,0.16)' : 'rgba(5,36,31,0.92)'; ctx.fill();
      ctx.strokeStyle = k === 0 ? COL.mint : 'rgba(151,252,227,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      text(ctx, nm, 0, 7, { ...o2, color: k === 2 ? COL.grey : COL.white, align: 'center' });
      ctx.restore();
    });
  });
  const pulse = 1 + 0.06 * clamp(e.kick);
  circle(ctx, hx, hy, 86 * pulse, COL.mint, 0.08);
  ring(ctx, hx, hy, 86 * pulse, COL.mint, 2, 0.6);
  drawSymbol(ctx, hx, hy, 70 * pulse, COL.mint, 1);
  text(ctx, 'LIQUIDITY', hx, hy + 120, { font: 'mono', size: 14, track: 6, color: COL.mint, align: 'center' });
  ctx.restore();
  // copy blocks
  const bi = BLOCKS.filter((b) => t >= b.at).length - 1;
  if (bi < 0) return;
  const B = BLOCKS[bi];
  const r = rise(t, B.at, 0.34, 40);
  const out = bi < 3 ? prog(t, BLOCKS[bi + 1].at - 0.08, BLOCKS[bi + 1].at) : prog(t, T(22) - 0.1, T(22));
  const a = r.a * (1 - out);
  let y = 380;
  label(ctx, `0${Math.min(bi + 1, 3)} / 03  ·  BUILD ON HYPERLIQUID`, 150, 330, { size: 16, track: 6, color: COL.dim, alpha: A });
  if (B.h) {
    text(ctx, B.h, 150, 440 + r.d, { size: 84, weight: 800, track: -3, color: COL.mint, alpha: a });
    y = 520;
    B.b.split('\n').forEach((ln, i) => text(ctx, ln, 152, y + i * 50 + r.d, { size: 40, weight: 500, color: COL.white, alpha: a }));
    cn(ctx, B.zh, 154, y + 120 + r.d, { alpha: a });
  } else {
    B.b.split('\n').forEach((ln, i) => text(ctx, ln, 150, 480 + i * 72 + r.d, { font: 'serif', italic: true, size: 64, color: i ? COL.mint : COL.white, alpha: a }));
    cn(ctx, B.zh, 154, 640 + r.d, { alpha: a });
  }
}

// ================================================================ 16 SCALE
function scale(ctx, t, e) {
  const t0 = T(22);
  const out = prog(t, T(24) - 0.1, T(24));
  ctx.save(); ctx.globalAlpha = 1 - out;
  // volume bars
  const v = DATA.weeklyVolumeB, n = v.length;
  const bx0 = 150, bx1 = 1770, base = 930, maxH = 330;
  const mx = Math.max(...v);
  const bw = (bx1 - bx0) / n;
  for (let i = 0; i < n; i++) {
    const born = t0 + (i / n) * (BAR * 0.8);
    const g = ease.outExpo(clamp((t - born) / 0.3));
    if (g <= 0) break;
    const h = (v[i] / mx) * maxH * g;
    const grd = ctx.createLinearGradient(0, base - h, 0, base);
    grd.addColorStop(0, 'rgba(151,252,227,0.95)'); grd.addColorStop(1, 'rgba(151,252,227,0.06)');
    ctx.fillStyle = grd;
    ctx.fillRect(bx0 + i * bw + 1, base - h, Math.max(1, bw - 2.5), h);
  }
  line(ctx, bx0, base + 1, bx1, base + 1, COL.mint, 1, 0.4 * prog(t, t0, t0 + 0.2));
  [['2023', 0], ['2024', 29], ['2025', 81], ['2026', 133]].forEach(([y, i]) => text(ctx, y, bx0 + i * bw, base + 30, { font: 'mono', size: 15, track: 3, color: COL.dim, alpha: prog(t, t0 + 0.2, t0 + 0.4) }));
  text(ctx, 'WEEKLY TRADING VOLUME  ·  JUN 2023 → APR 2026', bx0, base - maxH - 30, { font: 'mono', size: 15, track: 4, color: COL.dim, alpha: prog(t, t0 + 0.1, t0 + 0.4) });
  // stats
  const at = [T(22, 0), T(22, 2), T(23, 0), T(23, 2)];
  STATS.forEach((s, i) => {
    const x = 150 + i * 420;
    const r = rise(t, at[i], 0.35, 30);
    if (r.a <= 0) return;
    const p = ease.outExpo(prog(t, at[i], at[i] + 0.6));
    const val = s.v * p;
    const str = s.pre + (s.dec ? val.toFixed(s.dec) : fmt(Math.round(val), 0)) + s.suf;
    line(ctx, x, 262 + r.d, x + 360, 262 + r.d, COL.mint, 2, r.a * 0.8);
    text(ctx, str, x, 372 + r.d, { size: 98, weight: 800, track: -4, color: COL.white, alpha: r.a });
    label(ctx, s.label, x + 2, 418 + r.d, { size: 17, track: 6, alpha: r.a });
    cn(ctx, s.zh || s.cn, x + 2, 456 + r.d, { size: 24, alpha: r.a });
  });
  text(ctx, 'SOURCE: HYPERLIQUID API · SNAPSHOT 2026-09-26', 1770, base + 30, { font: 'mono', size: 13, track: 3, color: COL.dim, align: 'right', alpha: prog(t, t0 + 0.3, t0 + 0.6) });
  ctx.restore();
}

// ================================================================ 17 NOBODY
const NOBODY = [['NO', ' PRIVATE INVESTORS.', '没有私人投资者'], ['NO', ' PAID MARKET MAKERS.', '没有付费做市商'], ['NO', ' INSIDERS.', '没有内部人士']];
function nobody(ctx, t, e) {
  const out = prog(t, T(25) - 0.08, T(25));
  NOBODY.forEach(([a, b, zh], i) => {
    const t1 = CUES.nobodyHits[i];
    const s = slam(t, t1, 0.3, 1.14, 16);
    const y = 400 + i * 160;
    group(ctx, 160, y - 40, s.s, () => {
      const w = text(ctx, a, 160, y, { size: 112, weight: 800, track: -4, color: COL.mint });
      text(ctx, b, 160 + w, y, { size: 112, weight: 800, track: -4, color: COL.white });
    }, s.a * (1 - out), s.b);
    cn(ctx, zh, 164, y + 52, { size: 28, alpha: s.a * (1 - out) });
  });
  const r = rise(t, T(24, 3.4), 0.3, 10);
  label(ctx, '31% OF HYPE SUPPLY AIRDROPPED TO USERS AT GENESIS', 160, 930 + r.d, { size: 18, track: 5, alpha: r.a * (1 - out) });
  cn(ctx, '创世时 31% 的 HYPE 直接空投给社区用户', 162, 968 + r.d, { size: 22, alpha: r.a * (1 - out) });
}

// ================================================================ 18 FLYWHEEL
function flywheel(ctx, t, e) {
  const t0 = T(25);
  const out = prog(t, T(26) - 0.08, T(26));
  ctx.save(); ctx.globalAlpha = 1 - out;
  const h = rise(t, t0, 0.35, 20);
  text(ctx, 'Revenue flows back to the network.', 160, 230 + h.d, { size: 66, weight: 700, track: -2, color: COL.white, alpha: h.a });
  cn(ctx, '协议收入回流网络', 164, 282 + h.d, { color: COL.mint, alpha: h.a });
  const N = [
    { x: 330, en: 'PROTOCOL REVENUE', zh: '协议收入', icon: '$', at: T(25, 0) },
    { x: 790, en: 'ASSISTANCE FUND', zh: '援助基金', icon: 'AF', at: T(25, 1) },
    { x: 1250, en: 'BUYS HYPE', zh: '自动回购', icon: 'HYPE', at: T(25, 2) },
    { x: 1640, en: 'BURNED', zh: '永久销毁', icon: '', at: T(25, 3) },
  ];
  const y = 590, R = 78;
  N.forEach((n, i) => {
    const g = ease.outBack(clamp((t - n.at) / 0.3));
    if (i > 0) {
      const p = N[i - 1];
      const lp = ease.outExpo(prog(t, n.at - SPB * 0.5, n.at));
      const xa = p.x + R + 10, xb = n.x - R - 10;
      line(ctx, xa, y, lerp(xa, xb, lp), y, COL.mint, 2, 0.5);
      if (lp > 0.9) for (let k = 0; k < 6; k++) {
        const ph = ((t * 1.6 + k / 6) % 1);
        circle(ctx, lerp(xa, xb, ph), y, 4, COL.mint, Math.sin(ph * Math.PI));
      }
    }
    if (g <= 0) return;
    ctx.save(); ctx.translate(n.x, y); ctx.scale(g, g);
    circle(ctx, 0, 0, R, 'rgba(5,40,34,0.95)', 1);
    ring(ctx, 0, 0, R, COL.mint, 3, 0.9);
    if (i === 3) {
      for (let k = 0; k < 26; k++) {
        const ph = (((t - n.at) * (0.8 + hash1(k)) + hash1(k * 3)) % 1);
        const xx = (hash1(k * 7) - 0.5) * 70, yy = 30 - ph * 110;
        circle(ctx, xx * (1 - ph * 0.5), yy, 5 * (1 - ph), k % 3 ? COL.mint : COL.white, (1 - ph) * clamp((t - n.at) / 0.2));
      }
    } else text(ctx, n.icon, 0, n.icon.length > 2 ? 12 : 20, { size: n.icon.length > 2 ? 34 : 58, weight: 800, color: COL.mint, align: 'center' });
    ctx.restore();
    text(ctx, n.en, n.x, y + R + 50, { font: 'mono', size: 18, weight: 600, track: 5, color: COL.white, align: 'center', alpha: clamp((t - n.at) / 0.15) });
    cn(ctx, n.zh, n.x, y + R + 84, { size: 22, align: 'center', alpha: clamp((t - n.at) / 0.15) });
  });
  const s99 = slam(t, T(25, 0.5), 0.3, 1.3, 12);
  group(ctx, 560, y - 50, s99.s, () => text(ctx, '99%', 560, y - 34, { size: 76, weight: 800, track: -3, color: COL.mint, align: 'center' }), s99.a, s99.b);
  const r = rise(t, T(25, 2), 0.35, 14);
  text(ctx, '99% of protocol revenue goes to the Assistance Fund, which buys HYPE — and burns it.', 160, 900 + r.d, { size: 30, weight: 400, color: COL.grey, alpha: r.a });
  cn(ctx, '99% 的协议收入进入援助基金，自动回购 HYPE 并永久销毁', 162, 944 + r.d, { size: 24, alpha: r.a });
  ctx.restore();
}

// ================================================================ 19 OWNED
function owned(ctx, t, e) {
  const t0 = T(26), gap = CUES.gaps[2][0];
  const inGap = t >= gap;
  // swarm
  if (swarmPts) {
    const conv = ease.inOutCubic(prog(t, T(27), T(27, 3.3)));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < swarmPts.length; i++) {
      const p = swarmPts[i];
      const r1 = hash1(i * 1.91), r2 = hash1(i * 4.7 + 2);
      const lt = t - t0;
      const fx = (hash1(i * 3.1) * 1.2 - 0.1) * W + noise1(lt * 0.4 + i) * 120 + lt * 30 * (r2 - 0.5);
      const fy = (hash1(i * 6.3) * 1.2 - 0.1) * H + noise1(lt * 0.4 + i + 50) * 120;
      const x = lerp(fx, p.x, conv), y = lerp(fy, p.y, conv);
      const a = (0.25 + 0.5 * r1) * prog(t, t0, t0 + 0.5) * (inGap ? 0.5 : 1) * (0.5 + 0.5 * conv);
      ctx.globalAlpha = a;
      ctx.fillStyle = r1 > 0.85 ? COL.white : COL.mint;
      const sz = 2 + 2.2 * r2 * (1 - conv * 0.3);
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.restore();
  }
  if (inGap) return;
  const fade = 1 - prog(t, T(27, 1), T(27, 2.2));
  if (fade <= 0) return;
  const words = [['OWNED', 's'], ['BY', 's'], ['THOSE', 's'], ['WHO', 's'], ['build', 'i'], ['AND', 's'], ['use', 'i'], ['IT.', 's']];
  const oS = { size: 132, weight: 800, track: -5 }, oI = { font: 'serif', italic: true, size: 160 };
  const lines = [words.slice(0, 3), words.slice(3)];
  lines.forEach((ln, li) => {
    const ws = ln.map(([w, k]) => measure(ctx, w, k === 's' ? oS : oI));
    const sp = 34;
    const tot = ws.reduce((a, b) => a + b, 0) + sp * (ln.length - 1);
    let x = CX - tot / 2;
    ln.forEach(([w, k], j) => {
      const wi = li === 0 ? j : 3 + j;
      const r = rise(t, t0 + wi * (SPB / 2), 0.35, 40);
      text(ctx, w, x, (li ? 640 : 480) + r.d, { ...(k === 's' ? oS : oI), color: k === 'i' ? COL.mint : COL.white, alpha: r.a * fade, blur: 10 * (1 - r.p) });
      x += ws[j] + sp;
    });
  });
  const c = rise(t, T(26, 3.5), 0.35, 12);
  cn(ctx, '金融网络，应属于建设它、使用它的人', CX, 760 + c.d, { size: 36, track: 12, align: 'center', alpha: c.a * fade, color: COL.white });
}

// ================================================================ 20 MONTAGE
export const CARDS = [
  { big: '200K', sub: 'ORDERS PER SECOND', zh: '每秒 20 万笔订单', st: 'dark' },
  { big: '0.07s', sub: 'BLOCK TIME', zh: '出块时间', st: 'grid' },
  { big: '0 GAS', sub: 'GAS-FREE TRADING', zh: '交易免 Gas', st: 'mint' },
  { big: '24/7', sub: 'MARKETS NEVER CLOSE', zh: '永不休市', st: 'dark' },
  { big: '328', sub: 'PERP MARKETS', zh: '永续合约市场', st: 'ribbon' },
  { big: '$5.69T', sub: 'ALL-TIME VOLUME', zh: '累计交易量', st: 'dark' },
  { big: '2.63M', sub: 'USERS', zh: '用户', st: 'mint' },
  { big: '1 CHAIN', sub: 'TO HOUSE ALL FINANCE', zh: '一条链，承载全部金融', st: 'dark' },
];
export function cardAt(t) {
  const k = Math.floor((t - T(28)) / SPB);
  return k >= 0 && k < 8 ? k : -1;
}
function montage(ctx, t, e) {
  const k = cardAt(t);
  if (k < 0) return;
  const C = CARDS[k], tk = T(28) + k * SPB, lt = t - tk;
  const mint = C.st === 'mint';
  if (mint) { ctx.fillStyle = COL.mint; ctx.fillRect(0, 0, W, H); }
  if (C.st === 'grid') {
    ctx.save(); ctx.strokeStyle = 'rgba(151,252,227,0.12)'; ctx.lineWidth = 1;
    const off = (lt * 120) % 80;
    for (let x = -80 + off; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }
  const ink = mint ? COL.deep : COL.white;
  const acc = mint ? COL.deep : COL.mint;
  const sc = lerp(1.14, 1, ease.outExpo(clamp(lt / 0.32)));
  const dir = k % 2 ? 1 : -1;
  const o = { size: 300, weight: 800, track: -14 };
  let w = measure(ctx, C.big, o);
  const fit = Math.min(1, 1500 / w);
  group(ctx, CX, 500, sc * fit, () => text(ctx, C.big, CX + dir * 40 * (1 - ease.outExpo(clamp(lt / 0.25))), 600, { ...o, align: 'center', color: ink }), clamp(lt / 0.04), 0);
  text(ctx, C.sub, CX, 700, { font: 'mono', size: 30, weight: 600, track: 14, align: 'center', color: acc, alpha: clamp((lt - 0.04) / 0.08) });
  cn(ctx, C.zh, CX, 762, { size: 34, track: 14, align: 'center', color: mint ? 'rgba(3,33,28,0.75)' : COL.grey, alpha: clamp((lt - 0.06) / 0.08) });
  text(ctx, `0${k + 1}`, 110, 170, { font: 'mono', size: 20, weight: 700, track: 4, color: acc });
  text(ctx, '/08', 142, 170, { font: 'mono', size: 20, weight: 500, track: 4, color: mint ? 'rgba(3,33,28,0.5)' : COL.dim });
  brackets(ctx, 90, 120, W - 180, H - 240, 30, acc, 0.6, 2);
}

// ================================================================ 21 FINALE
function finale(ctx, t, e) {
  const t0 = T(30);
  shock(ctx, t, t0, CX, CY - 50, 1700);
  const push = 1 + 0.045 * ease.inOutSine(prog(t, t0 + 0.6, 64));
  ctx.save(); ctx.translate(CX, CY); ctx.scale(push, push); ctx.translate(-CX, -CY);
  finaleInner(ctx, t, e, t0);
  ctx.restore();
}
function finaleInner(ctx, t, e, t0) {
  const symIn = prog(t, t0, t0 + 0.55);
  drawLockup(ctx, CX, CY - 50, 1260, {
    symScale: lerp(1.9, 1, ease.outExpo(symIn)) * (1 + 0.02 * Math.sin((t - t0) * 2)),
    symAlpha: prog(t, t0, t0 + 0.05),
    letter: (i) => { const r = rise(t, t0 + 0.15 + (i * SPB) / 8, 0.5, 60); return { a: r.a, dy: r.d, blur: 12 * (1 - r.p) }; },
  });
  const tg = prog(t, T(30, 2), T(30, 2) + 0.5);
  if (t >= T(30, 2)) text(ctx, decode('INFRASTRUCTURE TO HOUSE ALL FINANCE', tg, 5, fk(t)), CX, CY + 150, { size: 38, weight: 500, track: 15, color: COL.white, align: 'center', alpha: 0.92 });
  const c = rise(t, T(30, 3), 0.4, 14);
  cn(ctx, '承载全部金融的基础设施', CX, CY + 212 + c.d, { size: 30, track: 18, align: 'center', color: COL.mint, alpha: c.a });
  const u = rise(t, CUES.url, 0.45, 20);
  if (u.a > 0) {
    const pw = 400, ph = 70, px = CX - pw / 2, py = CY + 300 + u.d;
    ctx.save(); ctx.globalAlpha = u.a;
    rrect(ctx, px, py, pw, ph, 35); ctx.fillStyle = 'rgba(151,252,227,0.1)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COL.mint; ctx.stroke();
    ctx.clip();
    const sh = prog(t, CUES.url + 0.2, CUES.url + 1.0);
    const sx = lerp(px - 120, px + pw + 120, ease.inOutCubic(sh));
    const g = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
    g.addColorStop(0, 'rgba(151,252,227,0)'); g.addColorStop(0.5, 'rgba(151,252,227,0.35)'); g.addColorStop(1, 'rgba(151,252,227,0)');
    ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
    ctx.restore();
    text(ctx, 'hyperliquid.xyz', CX, py + 46, { font: 'mono', size: 30, weight: 600, track: 2, color: COL.mint, align: 'center', alpha: u.a });
  }
}

// ---------------------------------------------------------------- registry
export const DRAW = { boot, legacy, turn, build, logo, tps, blocktime, every, book, chart, custody, arch, validators, everything, always, builders, scale, nobody, flywheel, owned, montage, finale };

const HUD_NAMES = {
  boot: 'BOOT', legacy: 'LEGACY FINANCE', turn: 'THESIS', build: 'SYNC', logo: 'HYPERLIQUID', tps: 'THROUGHPUT', blocktime: 'BLOCK TIME',
  every: 'ONCHAIN', book: 'ORDER BOOK', chart: 'MARKETS', custody: 'CUSTODY', arch: 'ARCHITECTURE', validators: 'CONSENSUS',
  everything: 'TRADE EVERYTHING', always: '24/7', builders: 'BUILDERS', scale: 'SCALE', nobody: 'COMMUNITY', flywheel: 'ASSISTANCE FUND',
  owned: 'OWNERSHIP', montage: 'RECAP', finale: 'HYPERLIQUID',
};
export function sceneAt(t) {
  const bar = t / BAR;
  for (let i = 0; i < SCENES.length; i++) if (bar >= SCENES[i].from && bar < SCENES[i].to) return { ...SCENES[i], idx: i };
  return { ...SCENES[SCENES.length - 1], idx: SCENES.length - 1 };
}

export function drawHUD(ctx, t, e) {
  const sc = sceneAt(t);
  let a = prog(t, 0.2, 0.6) * (1 - prog(t, T(30) - 0.1, T(30)));
  if (sc.id === 'logo' || sc.id === 'montage') a *= 0.45;
  if (CUES.gaps.some(([g0, g1]) => t >= g0 && t < g1)) a = 0;
  if (a <= 0.003) return;
  const mint = sc.id === 'montage' && CARDS[cardAt(t)] && CARDS[cardAt(t)].st === 'mint';
  const c = mint ? COL.deep : COL.mint;
  const cw = mint ? COL.deep : COL.white;
  ctx.save(); ctx.globalAlpha = a;
  const m = 44, L = 26;
  brackets(ctx, m, m, W - 2 * m, H - 2 * m, L, c, 0.6, 2);
  drawSymbol(ctx, 88, 78, 15, c, 0.95);
  text(ctx, 'HYPERLIQUID', 108, 84, { font: 'mono', size: 15, weight: 600, track: 4, color: cw, alpha: 0.85 });
  text(ctx, '/ MAINNET', 232, 84, { font: 'mono', size: 15, weight: 400, track: 4, color: c, alpha: 0.7 });
  const blocks = Math.floor(t / 0.07);
  text(ctx, `BLOCKS +${String(blocks).padStart(5, '0')}`, W - 88, 84, { font: 'mono', size: 15, weight: 500, track: 4, color: cw, align: 'right', alpha: 0.8 });
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  text(ctx, `T+${tc}`, 88, H - 70, { font: 'mono', size: 15, track: 4, color: cw, alpha: 0.8 });
  text(ctx, `${String(sc.idx + 1).padStart(2, '0')} — ${HUD_NAMES[sc.id]}`, 260, H - 70, { font: 'mono', size: 15, track: 4, color: c, alpha: 0.8 });
  const beat = Math.floor(t / SPB) % 4, bp = (t / SPB) % 1;
  for (let i = 0; i < 4; i++) {
    const on = i === beat;
    ctx.fillStyle = c; ctx.globalAlpha = a * (on ? 0.35 + 0.65 * (1 - bp) : 0.22);
    ctx.fillRect(W - 88 - (3 - i) * 20 - 12, H - 82, 12, 12);
  }
  ctx.globalAlpha = a;
  text(ctx, '128 BPM', W - 180, H - 70, { font: 'mono', size: 15, track: 4, color: cw, align: 'right', alpha: 0.6 });
  ctx.restore();
}
