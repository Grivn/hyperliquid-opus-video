// Canvas-2D design system: palette, type, kinetic text helpers, shapes, logo.
import { clamp, prog, ease, hash2, lerp } from './util.js';
import { LOGO } from '../generated/logo.js';

export const COL = {
  mint: '#97FCE3',
  mintRGB: '151,252,227',
  white: '#F2F7F6',
  grey: '#9DB3AD',
  dim: '#5F7D75',
  deep: '#03211C',
  ink: '#021512',
  panel: 'rgba(5, 33, 29, 0.86)',
  red: '#FF5C74',
  redRGB: '255,92,116',
};
export const FONT = {
  sans: 'Geist, sans-serif',
  mono: '"Geist Mono", monospace',
  serif: '"Instrument Serif", serif',
  cn: '"PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif',
};

export const rgba = (rgb, a) => `rgba(${rgb},${a})`;

function setFont(ctx, o) {
  const fam = FONT[o.font || 'sans'];
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size || 40}px ${fam}`;
  ctx.letterSpacing = `${o.track || 0}px`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
}
export function measure(ctx, s, o = {}) {
  ctx.save(); setFont(ctx, o);
  const w = ctx.measureText(s).width - (o.track || 0);
  ctx.restore();
  return w;
}
/** Draw text. Options: size weight font italic color alpha align base track blur scale sx sy rot stroke lw glow. */
export function text(ctx, s, x, y, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= 0.003 || !s) return 0;
  ctx.save();
  setFont(ctx, o);
  ctx.globalAlpha *= clamp(a);
  if (o.blur > 0.4) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  const sc = o.scale === undefined ? 1 : o.scale;
  ctx.scale(sc * (o.sx || 1), sc * (o.sy || 1));
  // letterSpacing adds trailing space; compensate for centered/right text
  const tr = o.track || 0;
  const dx = o.align === 'center' ? tr / 2 : o.align === 'right' ? tr : 0;
  if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.mint; ctx.shadowBlur = o.glow; }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.strokeText(s, dx, 0); }
  if (o.color !== 'none') { ctx.fillStyle = o.color || COL.white; ctx.fillText(s, dx, 0); }
  ctx.restore();
  return measure(ctx, s, o);
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\|_';
/** Scramble-decode: chars resolve left to right as p goes 0 -> 1. */
export function decode(str, p, seed = 0, frameKey = 0) {
  if (p >= 1) return str;
  let out = '';
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const c = str[i];
    if (c === ' ') { out += ' '; continue; }
    const at = (i / n) * 0.75;
    if (p >= at + 0.25) out += c;
    else if (p >= at) out += GLYPHS[Math.floor(hash2(i + seed * 31, frameKey) * GLYPHS.length)];
    else out += ' ';
  }
  return out;
}

/** Standard "slam" entrance: returns alpha, scale, blur for an element entering at t0. */
export function slam(t, t0, dur = 0.3, from = 1.25, blur = 16) {
  if (t < t0) return { a: 0, s: from, b: blur, p: 0 };
  const p = prog(t, t0, t0 + dur);
  const e = ease.outExpo(p);
  return { a: prog(t, t0, t0 + 0.05), s: lerp(from, 1, e), b: blur * (1 - e), p };
}
/** Slide/fade entrance. */
export function rise(t, t0, dur = 0.35, dist = 40) {
  if (t < t0) return { a: 0, d: dist, p: 0 };
  const p = prog(t, t0, t0 + dur);
  const e = ease.outExpo(p);
  return { a: prog(t, t0, t0 + dur * 0.5), d: dist * (1 - e), p };
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export function line(ctx, x1, y1, x2, y2, color, lw = 1, alpha = 1) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
export function brackets(ctx, x, y, w, h, len, color, alpha = 1, lw = 2) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke(); ctx.restore();
}
export function circle(ctx, x, y, r, fill, alpha = 1) {
  if (alpha <= 0.003 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
export function ring(ctx, x, y, r, color, lw = 2, alpha = 1, a0 = 0, a1 = Math.PI * 2) {
  if (alpha <= 0.003 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); ctx.restore();
}

// ---------- logo ----------
export const SYM = new Path2D(LOGO.symbol.d);
export const LETTERS = LOGO.letters.map((l) => ({ path: new Path2D(l.d), bbox: l.bbox }));
const SB = LOGO.symbol.bbox;
export const SYM_W = SB[2] - SB[0], SYM_H = SB[3] - SB[1];
export const SYM_C = [(SB[0] + SB[2]) / 2, (SB[1] + SB[3]) / 2];
// lockup bbox (mark + wordmark)
export const LOCK = { x0: SB[0], y0: SB[1], x1: 853.67, y1: 174.5 };
LOCK.w = LOCK.x1 - LOCK.x0; LOCK.h = LOCK.y1 - LOCK.y0;
LOCK.cx = (LOCK.x0 + LOCK.x1) / 2; LOCK.cy = (LOCK.y0 + LOCK.y1) / 2;

export function drawSymbol(ctx, cx, cy, h, color = COL.mint, alpha = 1, glow = 0) {
  if (alpha <= 0.003) return;
  const s = h / SYM_H;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-SYM_C[0], -SYM_C[1]);
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow / s; }
  ctx.fillStyle = color; ctx.fill(SYM);
  ctx.restore();
}

/**
 * Mark + wordmark lockup centred at (cx, cy) with total width w.
 * o: { symScale, symAlpha, symColor, wordColor, letter(i) -> {a, dy, blur} }
 */
export function drawLockup(ctx, cx, cy, w, o = {}) {
  const s = w / LOCK.w;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-LOCK.cx, -LOCK.cy);
  // mark
  const ss = o.symScale === undefined ? 1 : o.symScale;
  const sa = o.symAlpha === undefined ? 1 : o.symAlpha;
  if (sa > 0.003) {
    ctx.save();
    ctx.globalAlpha *= sa;
    ctx.translate(SYM_C[0], SYM_C[1]); ctx.scale(ss, ss); ctx.translate(-SYM_C[0], -SYM_C[1]);
    ctx.fillStyle = o.symColor || COL.mint; ctx.fill(SYM);
    ctx.restore();
  }
  LETTERS.forEach((L, i) => {
    const st = o.letter ? o.letter(i) : { a: 1, dy: 0, blur: 0 };
    if (st.a <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= st.a;
    if (st.blur > 0.4) ctx.filter = `blur(${(st.blur * s).toFixed(1)}px)`;
    ctx.translate(0, st.dy / s);
    ctx.fillStyle = o.wordColor || COL.white;
    ctx.fill(L.path);
    ctx.restore();
  });
  ctx.restore();
}

/** Sample filled points of something drawn by fn(ctx) into a w*h offscreen canvas. */
export function samplePoints(w, h, fn, step = 6, jitter = 0.8, seed = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  fn(g);
  const d = g.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 110) {
      const jx = (hash2(x + seed, y) - 0.5) * step * jitter, jy = (hash2(y + seed * 7, x) - 0.5) * step * jitter;
      pts.push({ x: x + jx, y: y + jy, r: d[i], g: d[i + 1], b: d[i + 2] });
    }
  }
  return pts;
}

/** Sparkline path in rect. */
export function spark(ctx, vals, x, y, w, h, color, lw = 2, alpha = 1, upto = 1) {
  if (!vals || vals.length < 2 || alpha <= 0.003) return;
  let mn = Infinity, mx = -Infinity;
  for (const v of vals) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const rg = mx - mn || 1;
  const n = Math.max(2, Math.floor(vals.length * upto));
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = x + (i / (vals.length - 1)) * w, py = y + h - ((vals[i] - mn) / rg) * h;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}
