// Frame driver: per-time GL state, post-processing, overlay composition.
import { W, H, FPS, DURATION, SPB, BAR, T, CUES, SCENES } from '../timeline.js';
import { EVENTS } from '../generated/events.js';
import { DATA } from '../generated/data.js';
import { GL } from './gl.js';
import { clamp, lerp, prog, ease, makePulse, noise1, hash1, keys } from './util.js';
import { DRAW, drawHUD, initScenes, sceneAt, globeParams, CARDS, cardAt } from './scenes.js';

const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const ov = document.createElement('canvas');
ov.width = W; ov.height = H;
const ctx = ov.getContext('2d');
const gl = new GL(canvas, W, H);
gl.setGlobe(DATA.globe);

const P = {
  kick: makePulse(EVENTS.kick, 0.11),
  clap: makePulse(EVENTS.clap, 0.09),
  snare: makePulse(EVENTS.snare, 0.05),
  stab: makePulse(EVENTS.stab, 0.12),
  hit: makePulse(EVENTS.hit, 0.2),
  impact: makePulse(EVENTS.impact, 0.32),
  flash: makePulse(EVENTS.impact, 0.055),
  hitFlash: makePulse(EVENTS.hit, 0.08),
};
const inGap = (t) => CUES.gaps.some(([a, b]) => t >= a && t < b);

// ---------- per-scene look ----------
const MINT = [0.592, 0.988, 0.89];
const GREY = [0.62, 0.7, 0.68];
function look(t) {
  const sc = sceneAt(t);
  const lt = t - T(sc.from);
  const lb = lt / SPB;
  const S = {
    bg0: [0.003, 0.022, 0.019], bg1: [0.012, 0.1, 0.086], bgCenter: [0.5, 0.6], bgAmt: 1,
    fov: 48, camPos: [0, 2.5, 26], camTarget: [0, 0, -6],
    color: MINT, color2: [0.95, 1, 0.98],
    ribA: 0.6, ribAmp: 1, ribWidth: 2.3, ribScatter: 0.35, ribSize: 3.1, ribSpread: 3.3, ribDisperse: 0, ribTilt: 0.07, ribGrey: 0,
    dustA: 0.22, floorA: 0, floorY: -6, globeA: 0,
  };
  const drift = (a, b, sp = 1) => [lerp(a[0], b[0], ease.inOutSine(clamp(lt / (sp * (T(sc.to) - T(sc.from)))))),
    lerp(a[1], b[1], ease.inOutSine(clamp(lt / (sp * (T(sc.to) - T(sc.from)))))), lerp(a[2], b[2], ease.inOutSine(clamp(lt / (sp * (T(sc.to) - T(sc.from))))))];
  switch (sc.id) {
    case 'boot':
      S.ribA = 0.3 * prog(t, 0.5, 1.8); S.ribGrey = 0.4; S.dustA = 0.12;
      S.camPos = drift([0, 2, 36], [0, 2, 31]); S.bgAmt = lerp(0.3, 0.85, prog(t, 0, 1.8));
      break;
    case 'legacy':
      S.ribA = 0.32; S.ribGrey = 1; S.dustA = 0.1; S.ribAmp = 0.7;
      S.camPos = drift([-10, 1, 24], [-7, 1.5, 22]); S.camTarget = [4, 0, -8]; S.bgAmt = 0.7;
      break;
    case 'turn':
      S.ribA = 0.6; S.ribGrey = 1 - ease.outCubic(prog(lt, 0, 0.8));
      S.camPos = drift([0, 4, 26], [0, 3, 21]);
      break;
    case 'build':
      S.ribA = 0.8; S.dustA = lerp(0.3, 0.9, prog(lb, 0, 3.5));
      S.camPos = drift([0, 1.6, 22], [0, 0.4, 9]); S.camTarget = [0, 0, -12]; S.fov = lerp(48, 62, ease.inQuad(prog(lb, 0, 3.5)));
      S.ribScatter = lerp(0.35, 1.2, prog(lb, 1, 3.5));
      break;
    case 'logo':
      S.ribA = 0.72; S.ribAmp = 1.15; S.dustA = 0.3;
      S.camPos = drift([-5, 5.5, 33], [5, 4, 30]); S.camTarget = [0, -1.2, -8];
      break;
    case 'tps':
      S.ribA = 0.22; S.dustA = 0.95; S.camPos = [0, 0.5, 14]; S.camTarget = [0, 0.2, -40]; S.fov = 64;
      break;
    case 'blocktime':
      S.ribA = 0.32; S.camPos = drift([16, 3, 18], [13, 2, 17]); S.camTarget = [-4, 0, -8];
      break;
    case 'every':
      S.ribA = 0.38; S.camPos = drift([-11, -2.5, 16], [-8, -1.5, 16]); S.camTarget = [2, 1, -8];
      break;
    case 'book':
    case 'chart':
      S.ribA = 0.14; S.floorA = 0.3; S.floorY = -4.5; S.camPos = drift([0, 7, 25], [2, 6, 23]); S.camTarget = [0, -2, -10];
      break;
    case 'custody':
      S.ribA = 0.38; S.camPos = drift([7, 1, 20], [4, 1.5, 19]); S.camTarget = [-2, 0, -8];
      S.ribDisperse = ease.inQuad(prog(lb, 3.2, 4)) * 0.3;
      break;
    case 'arch':
      S.ribA = 0.16; S.floorA = 0.55; S.floorY = -5; S.camPos = drift([0, 15, 22], [3, 14, 20]); S.camTarget = [0, -3, -8];
      break;
    case 'validators':
      S.ribA = lerp(0.25, 0.7, prog(lb, 4, 7.5)); S.floorA = 0.3 * (1 - prog(lb, 4, 6)); S.floorY = -5;
      S.camPos = drift([0, 7, 25], [0, 2, 14]); S.dustA = lerp(0.2, 0.8, prog(lb, 4, 7.5));
      break;
    case 'everything':
      S.ribA = 0.3; S.camPos = drift([0, 2, 30], [0, 3, 27]);
      break;
    case 'always':
      S.ribA = 0.12; S.globeA = 1 * prog(lt, 0, 0.3) * (1 - prog(t, T(20) - 0.1, T(20))); S.dustA = 0.3;
      break;
    case 'builders':
      S.ribA = 0.3; S.camPos = drift([-6, 3, 28], [6, 3, 28]);
      break;
    case 'scale':
      S.ribA = 0.18; S.floorA = 0.25; S.floorY = -4; S.camPos = drift([0, 5, 26], [0, 5, 22]);
      break;
    case 'nobody':
      S.ribA = 0.5; S.camPos = drift([-4, 2, 24], [-2, 2.5, 22]); S.camTarget = [4, 0, -8];
      break;
    case 'flywheel':
      S.ribA = 0.3; S.camPos = drift([0, 3, 26], [3, 3, 26]);
      break;
    case 'owned':
      S.ribA = lerp(0.35, 0.85, prog(lb, 4, 7.5)); S.dustA = lerp(0.2, 0.9, prog(lb, 4, 7.5));
      S.camPos = drift([0, 3, 28], [0, 1, 12]); S.camTarget = [0, 0, -12];
      break;
    case 'montage': {
      const k = cardAt(t);
      const C = CARDS[k] || CARDS[0];
      S.ribA = C.st === 'ribbon' ? 1.2 : C.st === 'grid' ? 0.2 : 0.55; S.ribAmp = C.st === 'ribbon' ? 1.35 : 1;
      const cams = [[0, 3, 24], [10, 2, 20], [0, 3, 24], [-9, 1, 20], [0, 6, 30], [7, -1, 18], [0, 3, 24], [-5, 4, 26]];
      S.camPos = cams[Math.max(0, k)]; S.camTarget = [0, 0, -8];
      S.floorA = C.st === 'grid' ? 0.6 : 0; S.floorY = -4;
      break;
    }
    case 'finale':
      S.ribA = 0.95 * (1 - prog(t, 62.0, 63.8)); S.ribAmp = 1.05; S.dustA = 0.25;
      S.camPos = drift([0, 5, 34], [0, 3.5, 29], 0.9); S.camTarget = [0, -1.2, -8];
      break;
  }
  if (inGap(t)) { S.ribA = 0; S.dustA = 0; S.floorA = 0; S.globeA = 0; S.bgAmt = 0.35; }
  return S;
}

// flow speeds (integrated into phases so cuts never make the ribbons jump)
function speeds(t) {
  const sc = sceneAt(t);
  const lb = (t - T(sc.from)) / SPB;
  let rib = 0.8, dust = 6, warp = 0;
  switch (sc.id) {
    case 'boot': rib = 0.25; dust = 3; break;
    case 'legacy': rib = 0.18; dust = 2; break;
    case 'turn': rib = 0.9; dust = 6; break;
    case 'build': rib = lerp(1.2, 3.5, ease.inQuad(prog(lb, 0, 3.5))); dust = lerp(10, 90, ease.inQuad(prog(lb, 0, 3.5))); warp = ease.inQuad(prog(lb, 0.5, 3.5)) * 1.3; break;
    case 'logo': rib = 0.9; dust = 8; break;
    case 'tps': rib = 2.2; dust = 95; warp = 1.25; break;
    case 'validators': rib = lerp(0.6, 2.8, ease.inQuad(prog(lb, 4, 7.5))); dust = lerp(5, 80, ease.inQuad(prog(lb, 4, 7.5))); warp = ease.inQuad(prog(lb, 4.5, 7.5)); break;
    case 'owned': rib = lerp(0.7, 3.0, ease.inQuad(prog(lb, 4, 7.5))); dust = lerp(5, 85, ease.inQuad(prog(lb, 4, 7.5))); warp = ease.inQuad(prog(lb, 4.5, 7.5)); break;
    case 'montage': rib = 1.6; dust = 20; warp = 0.2; break;
    case 'finale': rib = 0.45; dust = 3; break;
    case 'arch': case 'book': case 'chart': rib = 0.5; dust = 4; break;
    default: rib = 0.9; dust = 7;
  }
  return { rib, dust, warp };
}
const DT = 0.002;
const NT = Math.ceil((DURATION + 1) / DT);
const ribPhase = new Float32Array(NT), dustTravel = new Float32Array(NT);
for (let i = 1; i < NT; i++) {
  const sp = speeds(i * DT);
  ribPhase[i] = ribPhase[i - 1] + sp.rib * DT;
  dustTravel[i] = dustTravel[i - 1] + sp.dust * DT;
}
const lookup = (arr, t) => { const x = clamp(t / DT, 0, NT - 1.001); const i = Math.floor(x); return lerp(arr[i], arr[i + 1], x - i); };

function glState(t) {
  const S = look(t);
  const kick = clamp(P.kick(t)), imp = clamp(P.impact(t));
  S.ribPhase = lookup(ribPhase, t);
  S.dustTravel = lookup(dustTravel, t);
  S.warp = inGap(t) ? 0 : speeds(t).warp;
  S.ribPulse = kick * 0.8 + imp * 0.5;
  S.ribSize *= 1 + 0.12 * kick;
  S.ribA *= 1 + 0.2 * kick + 0.25 * imp;
  S.floorScroll = t * 2.5;
  const G = globeParams(t);
  S.globeCenter = [G.cx, G.cy]; S.globeR = G.R; S.globeYaw = G.yaw; S.globePitch = G.pitch; S.globeSize = 4.2;
  // subtle handheld float
  S.camPos = [S.camPos[0] + noise1(t * 0.3) * 0.5, S.camPos[1] + noise1(t * 0.23 + 9) * 0.35, S.camPos[2]];
  return S;
}

// ---------- post ----------
const CUTS = [];
SCENES.forEach((s) => { if (s.from > 0) CUTS.push(T(s.from)); });
for (let k = 1; k < 8; k++) CUTS.push(T(28) + k * SPB);
[T(8, 1), T(8, 2), T(8, 3)].forEach((c) => CUTS.push(c));
const STUTTERS = [T(5, 3.5), T(17, 3.5), T(21, 3.5)];
function bloomScale(t) {
  const k = cardAt(t);
  if (k >= 0 && CARDS[k].st === 'mint') return 0.08;
  return 1;
}
function post(t, frame) {
  const kick = clamp(P.kick(t)), imp = clamp(P.impact(t)), hit = clamp(P.hit(t));
  let g = 0;
  for (const c of CUTS) {
    const d = t - c;
    if (d >= -0.017 && d < 0.16) g = Math.max(g, d < 0 ? 0.5 : 0.85 * Math.exp(-d / 0.045));
  }
  for (const s of STUTTERS) if (t >= s && t < s + SPB / 2) g = Math.max(g, 0.35 + 0.5 * hash1(Math.floor(t * 64)));
  for (const [a, b] of CUES.builds) if (t >= a && t < b) {
    const q = prog(t, a, b);
    if (hash1(Math.floor(t * 30) * 1.3) < q * q * 0.5) g = Math.max(g, 0.3 * q);
  }
  const sh = 18 * imp + 8 * hit;
  const shake = [noise1(t * 42) * sh, noise1(t * 39 + 77) * sh];
  const flash = clamp(0.7 * P.flash(t) + 0.16 * P.hitFlash(t));
  const fade = prog(t, 0, 0.18) * (1 - prog(t, DURATION - 1.7, DURATION - 0.15));
  return {
    bloom: (0.62 + 0.3 * imp + 0.15 * kick) * bloomScale(t), bloomThresh: 0.72,
    ca: 0.0012 + 0.003 * kick + 0.014 * imp + 0.006 * hit,
    glitch: g, grain: window.__grain === undefined ? 0.045 : window.__grain, vignette: 0.5, flash, fade,
    zoom: 1.004 + 0.01 * kick + 0.035 * imp + 0.02 * hit + (sh * 2.2) / W,
    shake, seed: (frame % 997) + 0.5, scan: 0.018,
  };
}

// ---------- overlay ----------
function env(t) {
  return { kick: P.kick(t), clap: P.clap(t), snare: P.snare(t), stab: P.stab(t), hit: P.hit(t), impact: P.impact(t) };
}
function drawOverlay(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  const sc = sceneAt(t);
  const e = env(t);
  DRAW[sc.id](ctx, t, e);
  drawHUD(ctx, t, e);
}

export function renderFrame(frame, sub = 1, shutter = 0.5) {
  const t0 = frame / FPS;
  for (let k = 0; k < sub; k++) {
    const t = Math.max(0, sub === 1 ? t0 : t0 + ((k + 0.5) / sub - 0.5) * (shutter / FPS));
    drawOverlay(t);
    gl.renderSub(glState(t), ov, 1 / sub, k === 0);
  }
  gl.finish(post(t0, frame));
}

window.renderFrame = (frame, sub, shutter) => { renderFrame(frame, sub, shutter); return true; };
window.__ready = (async () => {
  await Promise.all([
    document.fonts.load('800 100px Geist'), document.fonts.load('400 100px Geist'),
    document.fonts.load('500 100px "Geist Mono"'), document.fonts.load('700 100px "Geist Mono"'),
    document.fonts.load('italic 400 100px "Instrument Serif"'), document.fonts.load('400 30px "PingFang SC"'),
  ]);
  await document.fonts.ready;
  const info = initScenes();
  return { ok: true, float: gl.float, ...info };
})();

// Real-time preview: open index.html?play
if (location.search.includes('play')) {
  window.__ready.then(() => {
    const audio = new Audio('../../build/soundtrack.wav');
    const btn = document.createElement('button');
    btn.textContent = 'Play';
    btn.style.cssText = 'position:fixed;left:12px;top:12px;z-index:9;padding:8px 14px';
    document.body.appendChild(btn);
    btn.onclick = () => {
      audio.currentTime = 0; audio.play(); btn.remove();
      const loop = () => { renderFrame(Math.floor(audio.currentTime * FPS), 1); if (!audio.ended) requestAnimationFrame(loop); };
      loop();
    };
    renderFrame(0, 1);
  });
}
