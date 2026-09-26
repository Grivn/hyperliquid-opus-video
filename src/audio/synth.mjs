// Procedural soundtrack for the Hyperliquid promo: 128 BPM, F minor, ~64 s.
// Writes build/soundtrack.wav (48 kHz / 24-bit stereo) and src/generated/events.js (hit times for the visuals).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPB, BAR, DURATION, T, SECTIONS, chordAt, BOOT, CUES } from '../timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const N = Math.ceil(DURATION * SR);
const TAU = Math.PI * 2;
const s = (t) => Math.round(t * SR);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- deterministic randomness ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20241129);
const noise = () => rnd() * 2 - 1;

// ---------- buses ----------
const mk = () => [new Float32Array(N), new Float32Array(N)];
const bus = {
  kick: mk(), drums: mk(), bass: mk(), pad: mk(), stab: mk(), lead: mk(),
  arp: mk(), fx: mk(), hits: mk(), rev: mk(), dly: mk(),
};

// Every voice buffer gets a short tail fade so truncated decays never click.
const tailGain = (i, len) => { const F = Math.min(480, len >> 2); return i < len - F ? 1 : (len - i) / F; };
function add(b, start, mono, gain = 1, pan = 0) {
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = gain * Math.cos(a) * Math.SQRT2, gr = gain * Math.sin(a) * Math.SQRT2;
  const [L, R] = b;
  const len = mono.length;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const g = tailGain(i, len);
    L[j] += mono[i] * gl * g; R[j] += mono[i] * gr * g;
  }
}
function add2(b, start, l, r, gain = 1) {
  const [L, R] = b;
  const len = l.length;
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const g = gain * tailGain(i, len);
    L[j] += l[i] * g; R[j] += r[i] * g;
  }
}

// ---------- DSP helpers ----------
// TPT state-variable filter (Zavalishin). mode: 0=lp 1=bp 2=hp. cutoff may be a number or fn(i).
function svf(x, cutoff, q = 0.707, mode = 0, out = new Float32Array(x.length)) {
  let ic1 = 0, ic2 = 0;
  const k = 1 / q;
  const fixed = typeof cutoff === 'number';
  let g = fixed ? Math.tan(Math.PI * Math.min(cutoff, SR * 0.45) / SR) : 0;
  for (let i = 0; i < x.length; i++) {
    if (!fixed) g = Math.tan(Math.PI * Math.min(Math.max(cutoff(i), 20), SR * 0.45) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    out[i] = mode === 0 ? v2 : mode === 1 ? v1 : x[i] - k * v1 - v2;
  }
  return out;
}
const polyblep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};
function sawOsc(len, freq, phase0 = 0, fmod = null) {
  const o = new Float32Array(len);
  let ph = phase0;
  for (let i = 0; i < len; i++) {
    const f = fmod ? fmod(i) : freq;
    const dt = f / SR;
    o[i] = 2 * ph - 1 - polyblep(ph, dt);
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}
const env = (tt, a, d) => (tt < a ? tt / a : Math.exp(-(tt - a) / d));

// ---------- instruments ----------
const EV = { kick: [], clap: [], snare: [], stab: [], hit: [], impact: [], whoosh: [], blip: [], hat: [] };

function kick(t, vel = 1, muffled = false) {
  EV.kick.push([+t.toFixed(4), vel]);
  const len = s(0.52);
  let o = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = 46 + 175 * Math.exp(-tt * 42) + 38 * Math.exp(-tt * 10);
    ph += (TAU * f) / SR;
    const a = Math.min(1, tt / 0.0012) * (tt < 0.045 ? 1 : Math.exp(-(tt - 0.045) * 7.2));
    let x = Math.sin(ph) * a;
    if (tt < 0.0035) x += noise() * (1 - tt / 0.0035) * 0.4;
    o[i] = Math.tanh(x * 1.9) * 0.92;
  }
  if (muffled) o = svf(o, 420, 0.6, 0);
  add(bus.kick, s(t), o, vel);
}

function clap(t, vel = 1, revAmt = 0.22) {
  EV.clap.push([+t.toFixed(4), vel]);
  const len = s(0.4);
  const n = new Float32Array(len);
  for (let i = 0; i < len; i++) n[i] = noise();
  const bp = svf(n, 1150, 1.1, 1);
  const hi = svf(n, 4200, 0.9, 1);
  const o = new Float32Array(len);
  const bursts = [0, 0.0105, 0.021, 0.0325];
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let e = 0;
    for (let b = 0; b < 3; b++) if (tt >= bursts[b]) e += Math.exp(-(tt - bursts[b]) / 0.0032) * (1 - b * 0.12);
    if (tt >= bursts[3]) e += Math.exp(-(tt - bursts[3]) / 0.075) * 0.95;
    o[i] = (bp[i] * 1.6 + hi[i] * 0.5) * e;
  }
  add(bus.drums, s(t), o, 0.62 * vel);
  add(bus.rev, s(t), o, revAmt * vel);
}

function snare(t, vel = 1, revAmt = 0.12) {
  EV.snare.push([+t.toFixed(4), vel]);
  const len = s(0.28);
  const n = new Float32Array(len);
  for (let i = 0; i < len; i++) n[i] = noise();
  const bp = svf(n, 3200, 0.7, 1);
  const hp = svf(n, 7000, 0.7, 2);
  const o = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (TAU * (165 + 60 * Math.exp(-tt * 40))) / SR;
    o[i] = Math.sin(ph) * env(tt, 0.001, 0.045) * 0.9 + bp[i] * env(tt, 0.001, 0.075) * 1.3 + hp[i] * env(tt, 0.001, 0.035) * 0.4;
  }
  add(bus.drums, s(t), o, 0.5 * vel, (rnd() - 0.5) * 0.2);
  add(bus.rev, s(t), o, revAmt * vel);
}

const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
function hat(t, vel = 1, open = false, pan = 0) {
  EV.hat.push([+t.toFixed(4), vel, open ? 1 : 0]);
  const len = s(open ? 0.42 : 0.08);
  const m = new Float32Array(len);
  const ph = HAT_F.map(() => rnd());
  for (let i = 0; i < len; i++) {
    let x = 0;
    for (let k = 0; k < 6; k++) { ph[k] += (HAT_F[k] * 1.9) / SR; x += ph[k] % 1 < 0.5 ? 1 : -1; }
    m[i] = x / 6 * 0.55 + noise() * 0.45;
  }
  const b = svf(svf(m, 10500, 0.9, 1), 7200, 0.7, 2);
  for (let i = 0; i < len; i++) b[i] *= env(i / SR, 0.0005, open ? 0.13 : 0.017);
  add(bus.drums, s(t), b, (open ? 0.34 : 0.3) * vel, pan);
}

function shaker(t, vel = 1, pan = 0) {
  const len = s(0.07);
  const n = new Float32Array(len);
  for (let i = 0; i < len; i++) n[i] = noise();
  const b = svf(n, 8000, 1.2, 1);
  for (let i = 0; i < len; i++) { const tt = i / SR; b[i] *= Math.min(1, tt / 0.008) * Math.exp(-tt / 0.022); }
  add(bus.drums, s(t), b, 0.22 * vel, pan);
}

function crash(t, vel = 1) {
  const len = s(2.4);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) { L[i] = noise(); R[i] = noise(); }
  const fl = svf(svf(L, 5200, 0.6, 2), 11000, 0.5, 0), fr = svf(svf(R, 5200, 0.6, 2), 11000, 0.5, 0);
  for (let i = 0; i < len; i++) { const e = env(i / SR, 0.002, 0.55); fl[i] *= e; fr[i] *= e; }
  add2(bus.drums, s(t), fl, fr, 0.34 * vel);
  add2(bus.rev, s(t), fl, fr, 0.12 * vel);
}

// Rolling 16th bass note: saw through an enveloped low-pass plus a sine body.
function bassNote(t, midi, dur, vel = 1, bright = 1) {
  const f = mtof(midi);
  const len = s(dur + 0.02);
  const saw = sawOsc(len, f, rnd());
  const lp = svf(saw, (i) => 160 + 1500 * bright * Math.exp(-(i / SR) / 0.05), 1.1, 0);
  const o = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (TAU * f) / SR;
    const a = Math.min(1, tt / 0.002) * (tt < dur * 0.55 ? 1 : Math.max(0, 1 - (tt - dur * 0.55) / (dur * 0.45 + 0.02)));
    o[i] = Math.tanh((lp[i] * 0.9 + Math.sin(ph) * 0.9) * 1.4) * a;
  }
  add(bus.bass, s(t), o, 0.62 * vel);
}

// Long bass (breakdown / bridge): two detuned saws + sine, low-passed.
function longBass(t, midi, dur, vel = 1, cutoff = 380) {
  const f = mtof(midi);
  const len = s(dur + 0.25);
  const a1 = sawOsc(len, f * 1.004, rnd()), a2 = sawOsc(len, f * 0.996, rnd());
  const m = new Float32Array(len);
  for (let i = 0; i < len; i++) m[i] = (a1[i] + a2[i]) * 0.5;
  const lp = svf(m, cutoff, 0.9, 0);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (TAU * f) / SR;
    const a = Math.min(1, tt / 0.03) * (tt < dur ? 1 : Math.exp(-(tt - dur) / 0.08));
    lp[i] = Math.tanh((lp[i] * 0.8 + Math.sin(ph) * 0.8) * 1.2) * a;
  }
  add(bus.bass, s(t), lp, 0.55 * vel);
}

// Supersaw voices spread in stereo.
const DET = [-24, -15, -7, 0, 7, 15, 24];
const PAN = [-0.85, -0.55, -0.25, 0, 0.25, 0.55, 0.85];
function supersaw(len, notes, voices = 7, detScale = 1) {
  const L = new Float32Array(len), R = new Float32Array(len);
  for (const n of notes) {
    for (let v = 0; v < voices; v++) {
      const idx = voices === 7 ? v : Math.round((v / (voices - 1)) * 6);
      const f = mtof(n) * Math.pow(2, (DET[idx] * detScale) / 1200);
      const o = sawOsc(len, f, rnd());
      const a = ((PAN[idx] + 1) * Math.PI) / 4;
      const gl = Math.cos(a), gr = Math.sin(a);
      for (let i = 0; i < len; i++) { L[i] += o[i] * gl; R[i] += o[i] * gr; }
    }
  }
  const norm = 1 / Math.sqrt(notes.length * voices);
  for (let i = 0; i < len; i++) { L[i] *= norm; R[i] *= norm; }
  return [L, R];
}

function stab(t, notes, vel = 1, dur = 0.2, bright = 1, revAmt = 0.18, dlyAmt = 0.12) {
  EV.stab.push([+t.toFixed(4), vel]);
  const len = s(dur + 0.35);
  const [L, R] = supersaw(len, notes);
  const cut = (i) => 1300 + 8500 * bright * Math.exp(-(i / SR) / 0.12);
  const fl = svf(L, cut, 0.9, 0), fr = svf(R, cut, 0.9, 0);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const a = Math.min(1, tt / 0.003) * (tt < dur ? 1 : Math.exp(-(tt - dur) / 0.07));
    fl[i] *= a; fr[i] *= a;
  }
  add2(bus.stab, s(t), fl, fr, 0.55 * vel);
  add2(bus.rev, s(t), fl, fr, revAmt * vel);
  add2(bus.dly, s(t), fl, fr, dlyAmt * vel);
}

function leadNote(t, midi, dur, vel = 1) {
  const len = s(dur + 0.3);
  const [L, R] = supersaw(len, [midi, midi - 12], 5, 0.8);
  const cut = (i) => 1400 + 5200 * Math.exp(-(i / SR) / 0.14);
  const fl = svf(L, cut, 1.0, 0), fr = svf(R, cut, 1.0, 0);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const a = Math.min(1, tt / 0.004) * (tt < dur ? 0.75 + 0.25 * Math.exp(-tt / 0.08) : 0.75 * Math.exp(-(tt - dur) / 0.06));
    fl[i] *= a; fr[i] *= a;
  }
  add2(bus.lead, s(t), fl, fr, 0.42 * vel);
  add2(bus.dly, s(t), fl, fr, 0.2 * vel);
  add2(bus.rev, s(t), fl, fr, 0.16 * vel);
}

function pluck(t, midi, vel = 1, pan = 0, dlyAmt = 0.32) {
  const f = mtof(midi);
  const len = s(0.45);
  const saw = sawOsc(len, f, rnd());
  const saw2 = sawOsc(len, f * 1.006, rnd());
  for (let i = 0; i < len; i++) saw[i] = (saw[i] + saw2[i] * 0.6) * 0.6;
  const o = svf(saw, (i) => 450 + 5200 * Math.exp(-(i / SR) / 0.045), 1.3, 0);
  for (let i = 0; i < len; i++) o[i] *= env(i / SR, 0.002, 0.11);
  add(bus.arp, s(t), o, 0.4 * vel, pan);
  add(bus.dly, s(t), o, dlyAmt * vel, pan);
  add(bus.rev, s(t), o, 0.12 * vel, pan);
}

// ---------- FX ----------
function boom(t, vel = 1, f0 = 62, f1 = 30, dur = 1.4) {
  const len = s(dur);
  const o = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-tt * 3.2))) / SR;
    o[i] = Math.tanh(Math.sin(ph) * 1.5) * env(tt, 0.002, dur * 0.42);
  }
  add(bus.hits, s(t), o, 0.8 * vel);
}
function noiseBurst(t, vel = 1, cutoff = 2400, decay = 0.28, revAmt = 0.3) {
  const len = s(decay * 5);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) { L[i] = noise(); R[i] = noise(); }
  const fl = svf(L, cutoff, 0.7, 0), fr = svf(R, cutoff, 0.7, 0);
  for (let i = 0; i < len; i++) { const e = env(i / SR, 0.001, decay); fl[i] *= e; fr[i] *= e; }
  add2(bus.hits, s(t), fl, fr, 0.5 * vel);
  add2(bus.rev, s(t), fl, fr, revAmt * vel);
}
// Cinematic "braam" hit on a root note.
function hit(t, vel = 1, rootMidi = 37) {
  EV.hit.push([+t.toFixed(4), vel]);
  boom(t, vel, 58, 32, 1.2);
  noiseBurst(t, vel * 0.8, 1800, 0.22);
  const len = s(0.9);
  const [L, R] = supersaw(len, [rootMidi, rootMidi + 12, rootMidi + 19], 5, 1.4);
  const cut = (i) => { const tt = i / SR; return 150 + 1900 * (tt < 0.02 ? tt / 0.02 : Math.exp(-(tt - 0.02) / 0.16)); };
  const fl = svf(L, cut, 1.4, 0), fr = svf(R, cut, 1.4, 0);
  for (let i = 0; i < len; i++) { const e = env(i / SR, 0.004, 0.3); fl[i] = Math.tanh(fl[i] * 2.2 * e); fr[i] = Math.tanh(fr[i] * 2.2 * e); }
  add2(bus.hits, s(t), fl, fr, 0.5 * vel);
  add2(bus.rev, s(t), fl, fr, 0.3 * vel);
  // metallic ring
  const mlen = s(1.1);
  const m = new Float32Array(mlen);
  const parts = [211, 347, 521, 733, 1187];
  for (let i = 0; i < mlen; i++) {
    const tt = i / SR;
    let x = 0;
    for (let k = 0; k < parts.length; k++) x += Math.sin(TAU * parts[k] * tt) * Math.exp(-tt * (3 + k));
    m[i] = x * 0.2 * Math.min(1, tt / 0.001);
  }
  add(bus.hits, s(t), m, 0.28 * vel);
  add(bus.rev, s(t), m, 0.25 * vel);
}
function impact(t, vel = 1) {
  EV.impact.push([+t.toFixed(4), vel]);
  boom(t, vel * 1.1, 78, 27, 1.8);
  noiseBurst(t, vel * 0.9, 3200, 0.32, 0.45);
  crash(t, vel);
}
function sweep(t, dur, f0, f1, vel = 1, q = 1.2, pan0 = 0, pan1 = 0, target = bus.fx, shape = 'up') {
  const len = s(dur);
  const n = new Float32Array(len);
  for (let i = 0; i < len; i++) n[i] = noise();
  const bp = svf(n, (i) => f0 * Math.pow(f1 / f0, i / len), q, 1);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const a = shape === 'up' ? x * x : shape === 'down' ? (1 - x) * (1 - x) : Math.sin(Math.PI * x);
    const p = pan0 + (pan1 - pan0) * x;
    const ang = ((p + 1) * Math.PI) / 4;
    L[i] = bp[i] * a * Math.cos(ang) * 1.4; R[i] = bp[i] * a * Math.sin(ang) * 1.4;
  }
  add2(target, s(t), L, R, vel);
  add2(bus.rev, s(t), L, R, 0.15 * vel);
}
function riser(t0, t1, vel = 1) {
  const dur = t1 - t0;
  sweep(t0, dur, 300, 11000, 0.55 * vel, 1.6, -0.3, 0.3);
  // pitched riser
  const len = s(dur);
  const o = sawOsc(len, 0, rnd(), (i) => 110 * Math.pow(8, i / len));
  const lp = svf(o, (i) => 400 + 5000 * (i / len) * (i / len), 0.8, 0);
  for (let i = 0; i < len; i++) { const x = i / len; lp[i] *= x * x * x; }
  add(bus.fx, s(t0), lp, 0.16 * vel);
  add(bus.rev, s(t0), lp, 0.1 * vel);
}
function revCymbal(t1, dur = SPB * 1.5, vel = 1) {
  const len = s(dur);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) { L[i] = noise(); R[i] = noise(); }
  const fl = svf(L, 5000, 0.6, 2), fr = svf(R, 5000, 0.6, 2);
  for (let i = 0; i < len; i++) { const x = i / len; const a = x * x * x; fl[i] *= a; fr[i] *= a; }
  add2(bus.fx, s(t1 - dur), fl, fr, 0.5 * vel);
}
function whoosh(tEnd, dur = 0.32, vel = 1) {
  EV.whoosh.push([+tEnd.toFixed(4), vel]);
  sweep(tEnd - dur, dur, 600, 7000, 0.35 * vel, 1.4, -0.6, 0.6, bus.fx, 'up');
}
function slash(t, vel = 1) {
  EV.whoosh.push([+t.toFixed(4), vel]);
  sweep(t, 0.16, 7500, 1200, 0.5 * vel, 1.8, -0.7, 0.7, bus.fx, 'bell');
}
function blip(t, freq, dur = 0.03, vel = 1, pan = 0, crush = true) {
  EV.blip.push([+t.toFixed(4), vel]);
  const len = s(dur);
  const o = new Float32Array(len);
  let hold = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let x = Math.sin(TAU * freq * tt) * Math.min(1, tt / 0.001) * Math.exp(-tt / (dur * 0.5));
    if (crush) { if (i % 6 === 0) hold = Math.round(x * 7) / 7; x = hold; }
    o[i] = x;
  }
  add(bus.fx, s(t), o, 0.12 * vel, pan);
  add(bus.dly, s(t), o, 0.05 * vel, pan);
}
function tick(t, vel = 1) {
  const len = s(0.012);
  const o = new Float32Array(len);
  const f = 2600 + rnd() * 1800;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    o[i] = (Math.sin(TAU * f * tt) * 0.6 + noise() * 0.4) * Math.exp(-tt / 0.0025);
  }
  add(bus.fx, s(t), o, 0.16 * vel, (rnd() - 0.5) * 0.5);
}
function chirp(t, vel = 1) {
  const len = s(0.9);
  const o = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (TAU * (70 * Math.pow(30, Math.min(1, tt / 0.7)))) / SR;
    o[i] = Math.sin(ph) * Math.sin(Math.PI * Math.min(1, tt / 0.9)) * 0.5;
  }
  add(bus.fx, s(t), o, 0.22 * vel);
  add(bus.rev, s(t), o, 0.15 * vel);
}
function shatter(t, vel = 1) {
  EV.hit.push([+t.toFixed(4), vel]);
  boom(t, vel * 0.8, 70, 35, 0.8);
  noiseBurst(t, vel, 6000, 0.12, 0.4);
  for (let g = 0; g < 70; g++) {
    const dt = Math.pow(rnd(), 1.8) * 0.7;
    const f = 2200 + rnd() * 6000;
    const len = s(0.01 + rnd() * 0.03);
    const o = new Float32Array(len);
    for (let i = 0; i < len; i++) { const tt = i / SR; o[i] = Math.sin(TAU * f * tt) * Math.exp(-tt / 0.006); }
    add(bus.fx, s(t + dt), o, 0.09 * vel * (1 - dt), (rnd() - 0.5) * 1.6);
    add(bus.rev, s(t + dt), o, 0.05 * vel);
  }
}
function chime(t, vel = 1) {
  const len = s(3);
  const o = new Float32Array(len);
  const parts = [[1, 1], [2.0, 0.5], [3.01, 0.25], [4.2, 0.12]];
  const f0 = mtof(84);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let x = 0;
    for (const [m, a] of parts) x += Math.sin(TAU * f0 * m * tt) * a * Math.exp(-tt * (1.2 + m * 0.6));
    o[i] = x * Math.min(1, tt / 0.002);
  }
  add(bus.fx, s(t), o, 0.16 * vel);
  add(bus.rev, s(t), o, 0.2 * vel);
  add(bus.dly, s(t), o, 0.12 * vel);
}

// ---------- arrangement ----------
const secAt = (bar) => (SECTIONS.find((x) => bar >= x.from && bar < x.to) || SECTIONS[SECTIONS.length - 1]).id;
const chord = (bar) => {
  if (bar >= 30) return { root: 41, notes: [53, 56, 60, 65] };
  if (bar === 29) return chordAt(3);
  return chordAt(bar);
};

const STAB_PAT = {
  A: [0, 3, 6, 10, 13],
  Q: [0, 4, 8, 12],
  B: [0, 3, 6, 8, 11, 14],
  T: [0, 6, 12],
};
const stabPattern = (bar) => {
  if (bar === 8) return STAB_PAT.Q;
  if (bar >= 4 && bar < 12) return STAB_PAT.A;
  if (bar >= 16 && bar < 24) return STAB_PAT.B;
  if (bar >= 24 && bar < 27) return STAB_PAT.T;
  if (bar >= 28 && bar < 30) return STAB_PAT.Q;
  return [];
};
// Lead hook for drop 2 (16th step -> midi), one pattern per chord.
const HOOK = [
  [[0, 84], [3, 80], [6, 77], [8, 79], [11, 80], [14, 84]],
  [[0, 85], [3, 80], [6, 77], [8, 80], [11, 82], [14, 85]],
  [[0, 84], [3, 87], [6, 80], [8, 84], [11, 87], [14, 84]],
  [[0, 82], [3, 79], [6, 75], [8, 79], [11, 82], [14, 84]],
];

const TOTAL_BARS = Math.ceil(DURATION / BAR);
for (let bar = 0; bar < TOTAL_BARS; bar++) {
  const sec = secAt(bar);
  const ch = chord(bar);
  const t0 = T(bar);
  const drop = sec === 'drop1' || sec === 'drop2' || sec === 'final';

  // --- drums ---
  if (drop) {
    for (let b = 0; b < 4; b++) {
      kick(T(bar, b));
      if (b === 1 || b === 3) clap(T(bar, b));
      for (let x = 0; x < 4; x++) {
        const v = [0.42, 0.26, 0.7, 0.3][x];
        const openHat = x === 2 && (sec !== 'drop1' || bar >= 6);
        if (openHat) hat(T(bar, b + 0.5), 0.55, true, 0.1);
        else hat(T(bar, b + x / 4), v, false, x % 2 ? 0.18 : -0.12);
        if (sec === 'drop2' || sec === 'final') shaker(T(bar, b + x / 4 + 0.125), x === 2 ? 0.9 : 0.55, x % 2 ? -0.35 : 0.35);
      }
    }
    if ([7, 11, 19, 23, 29].includes(bar)) for (let x = 0; x < 4; x++) snare(T(bar, 3 + x / 4), 0.45 + x * 0.17);
    if ([4, 8, 16, 20, 28].includes(bar)) crash(t0, 0.9);
  } else if (sec === 'intro') {
    if (bar >= 1 && bar <= 2) for (let x = 0; x < 16; x++) hat(T(bar, x / 4), (x % 4 === 2 ? 0.34 : 0.16) * (bar === 2 ? 1.25 : 1), false, x % 2 ? 0.2 : -0.2);
    if (bar === 3) for (let x = 0; x < 14; x++) hat(T(bar, x / 4), 0.3 + x * 0.025, false, x % 2 ? 0.2 : -0.2);
  } else if (sec === 'breakdown') {
    if (bar <= 13) {
      clap(T(bar, 3), 0.75, 0.55);
      for (let x = 0; x < 8; x++) shaker(T(bar, x / 2 + 0.25), 0.5, x % 2 ? 0.3 : -0.3);
    } else if (bar === 14) {
      for (let b = 0; b < 4; b++) { kick(T(bar, b), 0.62, true); if (b % 2) clap(T(bar, b), 0.5, 0.35); }
      for (let x = 0; x < 16; x++) hat(T(bar, x / 4), x % 4 === 2 ? 0.45 : 0.22, false, x % 2 ? 0.2 : -0.2);
    } else {
      for (let b = 0; b < 3; b++) kick(T(bar, b), 0.6 + b * 0.08, true);
      for (let x = 0; x < 14; x++) hat(T(bar, x / 4), 0.3 + x * 0.025, false, x % 2 ? 0.2 : -0.2);
    }
  } else if (sec === 'bridge') {
    if (bar <= 26) {
      for (const b of [0, 1.5, 3]) kick(T(bar, b));
      if (bar >= 25) clap(T(bar, 2), 0.9, 0.3);
      for (let x = 0; x < 8; x++) hat(T(bar, x / 2), x % 2 ? 0.5 : 0.25, x === 5, x % 2 ? 0.2 : -0.2);
      for (let x = 0; x < 16; x++) shaker(T(bar, x / 4 + 0.125), x % 4 === 2 ? 0.7 : 0.4, x % 2 ? -0.3 : 0.3);
    } else {
      for (let x = 0; x < 14; x++) hat(T(bar, x / 4), 0.3 + x * 0.025, false, x % 2 ? 0.2 : -0.2);
    }
  } else if (sec === 'outro') {
    if (bar === 30) { kick(t0, 1); }
  }

  // --- bass ---
  if (drop) {
    for (let b = 0; b < 4; b++) {
      for (const x of [1, 2, 3]) {
        let m = ch.root;
        if (x === 3 && b % 2 === 1) m += 12;
        if (sec !== 'drop1' && x === 2 && b === 3) m += 7;
        bassNote(T(bar, b + x / 4), m, SPB / 4 * 0.92, x === 1 ? 0.9 : 1, sec === 'drop1' ? 0.85 : 1.05);
      }
    }
  } else if (sec === 'breakdown') {
    if (bar <= 13) longBass(t0, ch.root - 12, BAR * 0.95, 0.75, 220);
    else for (let e = 1; e < (bar === 15 ? 7 : 8); e++) bassNote(T(bar, e / 2), ch.root, SPB * 0.4, 0.75, 0.6);
  } else if (sec === 'bridge' && bar <= 26) {
    longBass(t0, ch.root, BAR * 0.98, 0.85, 520);
  } else if (sec === 'outro' && bar === 30) {
    longBass(t0, 29, 3.2, 0.9, 260);
  }

  // --- stabs / lead ---
  for (const st of stabPattern(bar)) {
    const vel = st === 0 ? 1 : 0.85;
    stab(T(bar, st / 4), ch.notes.map((n) => n + 12), vel, bar === 8 || bar >= 28 ? 0.24 : 0.17, sec === 'drop1' ? 0.8 : 1);
  }
  if (sec === 'drop2') for (const [st, m] of HOOK[bar % 4]) leadNote(T(bar, st / 4), m, SPB * 0.55, st === 0 ? 1 : 0.85);

  // --- arp ---
  const arpOn = (bar >= 2 && bar < 4) || sec === 'breakdown' || sec === 'drop2' || (bar >= 30 && bar < 33);
  if (arpOn) {
    const [n0, n1, n2] = ch.notes;
    const tones = [n0, n1, n2, n0 + 12, n1 + 12, n2 + 12].map((n) => n + 12);
    const pat = [0, 2, 1, 3, 2, 4, 3, 5, 4, 3, 2, 4, 1, 3, 2, 1];
    const step = bar >= 30 ? 2 : 1;
    for (let x = 0; x < 16; x += step) {
      if (bar >= 30 && T(bar, x / 4) > 61.5) break;
      const vel = (bar < 4 ? 0.5 + (bar - 2) * 0.3 : sec === 'drop2' ? 0.45 : bar >= 30 ? 0.6 : 0.85) * (x % 4 === 0 ? 1 : 0.75);
      pluck(T(bar, x / 4), tones[pat[x]], vel, x % 2 ? 0.35 : -0.35, sec === 'drop2' ? 0.18 : 0.32);
    }
  }
}

// ---------- pad (continuous, automated filter) ----------
{
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const ch = chord(bar);
    const ta = T(bar), tb = bar === TOTAL_BARS - 1 ? DURATION : T(bar + 1);
    const atk = bar < 4 ? 0.35 : 0.04, rel = 0.35;
    const start = s(ta), len = Math.min(N - start, s(tb - ta + rel));
    if (len <= 0) continue;
    const [pl, pr] = supersaw(len, [ch.root + 12, ...ch.notes], 5, 1.1);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let a = Math.min(1, tt / atk);
      if (tt > tb - ta) a *= Math.max(0, 1 - (tt - (tb - ta)) / rel);
      L[start + i] += pl[i] * a; R[start + i] += pr[i] * a;
    }
  }
  const cutoffAt = (t) => {
    const bar = t / BAR;
    if (bar < 4) return 250 * Math.pow(18, Math.pow(bar / 4, 1.6));
    if (bar < 12) return 3400;
    if (bar < 15) return 1300;
    if (bar < 16) return 1300 * Math.pow(4, bar - 15);
    if (bar < 24) return 4200;
    if (bar < 27) return 2000;
    if (bar < 28) return 2000 * Math.pow(2.2, bar - 27);
    if (bar < 30) return 3600;
    return Math.max(350, 3600 * Math.pow(0.6, (t - T(30)) * 1.3));
  };
  const fl = svf(L, (i) => cutoffAt(i / SR), 0.8, 0), fr = svf(R, (i) => cutoffAt(i / SR), 0.8, 0);
  const gainAt = (t) => {
    const bar = t / BAR;
    if (bar < 4) return 0.2 + 0.8 * Math.min(1, t / 1.2);
    if (bar >= 12 && bar < 16) return 1.25;
    if (t > 58) return Math.max(0, 1 - (t - 58) / 5.6);
    return 1;
  };
  for (let i = 0; i < N; i++) { const g = gainAt(i / SR); fl[i] *= g; fr[i] *= g; }
  add2(bus.pad, 0, fl, fr, 0.34);
  add2(bus.rev, 0, fl, fr, 0.08);
}

// ---------- cue-driven FX ----------
chirp(0.02, 1);
{ // boot typing + ok blips + data chatter
  for (let i = 0; i < BOOT.line1.length; i++) tick(BOOT.start + i * BOOT.charDt, 0.8);
  BOOT.rows.forEach((r, k) => { blip(r.at, 1320, 0.04, 1.1, -0.3); blip(r.at + 0.05, 1760 + k * 220, 0.05, 1.1, 0.3); });
  const pent = [89, 92, 96, 99, 101, 104];
  for (let x = 0; x < 16; x++) if (rnd() < 0.55) blip(T(0, x / 4), mtof(pent[Math.floor(rnd() * pent.length)]), 0.025, 0.55, (rnd() - 0.5) * 1.4);
}
CUES.legacyHits.forEach((t, i) => hit(t, i === 0 ? 1.0 : 0.72, i === 0 ? 37 : 37 + [0, 3, 5, 7][i]));
CUES.legacySlashes.forEach((t) => slash(t, 0.9));
shatter(CUES.shatter, 1);
{
  const inv = [[53, 56, 61, 65], [56, 61, 65, 68], [61, 65, 68, 73]];
  CUES.turnWords.forEach((t, i) => stab(t, inv[i].map((n) => n + 12), 0.9 + i * 0.1, 0.24, 1.1, 0.35, 0.25));
}
for (const [a, b] of CUES.builds) {
  riser(a, b, 1);
  revCymbal(b, SPB * 1.5, 1);
  const rolls = [];
  for (let x = 0; x < 4; x++) rolls.push(a + x * SPB / 2);
  for (let x = 0; x < 4; x++) rolls.push(a + 2 * SPB + x * SPB / 4);
  for (let x = 0; x < 4; x++) rolls.push(a + 3 * SPB + x * SPB / 8);
  rolls.forEach((t, i) => snare(t, 0.3 + 0.7 * (i / rolls.length), 0.2));
}
CUES.drops.forEach((t) => impact(t, 1));
// throughput counter roll: 32nd blips rising
for (let x = 0; x < 8; x++) blip(CUES.counterRoll[0] + x * SPB / 8, 600 * Math.pow(5, x / 8), 0.03, 0.9, (x % 2 ? 0.4 : -0.4));
blip(CUES.counterRoll[1], 2640, 0.12, 1.2, 0, false);
// block ticks (bar 7) and order-book chatter (bar 9)
for (let x = 0; x < 16; x++) blip(T(7, x / 4), 3900 + (x % 4) * 260, 0.012, 0.55, x % 2 ? 0.5 : -0.5, false);
for (let x = 0; x < 8; x++) blip(T(9, x / 2 + 0.25), mtof([89, 92, 96, 99][x % 4]), 0.03, 0.5, x % 2 ? 0.45 : -0.45);
// breakdown entry: downlifter + soft impact
sweep(CUES.breakdown, BAR, 7000, 250, 0.5, 1.2, 0.4, -0.4, bus.fx, 'down');
boom(CUES.breakdown, 0.7, 60, 30, 1.6);
// whooshes into scene cuts inside the drops / bridge
for (const bar of [6, 7, 8, 9, 10, 11, 18, 20, 22, 25, 26]) whoosh(T(bar), 0.3, 0.8);
// bridge statements
CUES.nobodyHits.forEach((t, i) => hit(t, 0.8 + i * 0.1, 41));
// finale
impact(CUES.finale, 1.2);
stab(CUES.finale, [53, 56, 60, 67, 72].map((n) => n + 12), 1.0, 2.6, 0.9, 0.45, 0.2);
chime(CUES.url, 1);

// ---------- effects: reverb + ping-pong delay ----------
function freeverb(inL, inR, room = 0.86, damp = 0.35) {
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const spread = Math.round(23 * scale);
  const pre = s(0.022);
  const mkLine = (d) => ({ buf: new Float32Array(d), i: 0, fs: 0 });
  const chans = [0, 1].map((c) => ({
    combs: combT.map((d) => mkLine(d + c * spread)),
    aps: apT.map((d) => mkLine(d + c * spread)),
  }));
  // band-limit the send
  const hpL = svf(inL, 260, 0.7, 2), hpR = svf(inR, 260, 0.7, 2);
  const bl = svf(hpL, 7500, 0.7, 0), br = svf(hpR, 7500, 0.7, 0);
  const outL = new Float32Array(N), outR = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const src = n - pre >= 0 ? (bl[n - pre] + br[n - pre]) * 0.5 * 0.03 : 0;
    for (let c = 0; c < 2; c++) {
      const ch = chans[c];
      let acc = 0;
      for (const cb of ch.combs) {
        const y = cb.buf[cb.i];
        cb.fs = y * (1 - damp) + cb.fs * damp;
        cb.buf[cb.i] = src + cb.fs * room;
        if (++cb.i >= cb.buf.length) cb.i = 0;
        acc += y;
      }
      for (const ap of ch.aps) {
        const bo = ap.buf[ap.i];
        const y = -acc + bo;
        ap.buf[ap.i] = acc + bo * 0.5;
        if (++ap.i >= ap.buf.length) ap.i = 0;
        acc = y;
      }
      (c ? outR : outL)[n] = acc;
    }
  }
  return [outL, outR];
}
function pingpong(inL, inR, delaySec, fb = 0.38) {
  const D = s(delaySec);
  const bufL = new Float32Array(N), bufR = new Float32Array(N);
  let lpL = 0, lpR = 0;
  const c = 1 - Math.exp((-TAU * 4200) / SR);
  for (let n = 0; n < N; n++) {
    const dl = n >= D ? bufL[n - D] : 0;
    const dr = n >= D ? bufR[n - D] : 0;
    lpL += c * (dl - lpL); lpR += c * (dr - lpR);
    bufL[n] = (inL[n] + inR[n]) * 0.5 + lpR * fb;
    bufR[n] = lpL * fb;
  }
  // output is the delayed signal only
  const oL = new Float32Array(N), oR = new Float32Array(N);
  for (let n = D; n < N; n++) { oL[n] = bufL[n - D]; oR[n] = bufR[n - D]; }
  return [oL, oR];
}

// ---------- sidechain + gaps ----------
const scEnv = new Float32Array(N);
for (const [t, vel] of EV.kick) {
  const a = s(t);
  for (let i = 0; i < s(0.4); i++) {
    const j = a + i; if (j >= N) break;
    const tt = i / SR;
    const e = (tt < 0.004 ? tt / 0.004 : Math.exp(-(tt - 0.004) / 0.1)) * Math.min(1, vel);
    if (e > scEnv[j]) scEnv[j] = e;
  }
}
const gapGain = new Float32Array(N).fill(1);
for (const [a, b] of CUES.gaps) {
  const ia = s(a), ib = s(b), r = s(0.006);
  for (let i = ia; i < ib && i < N; i++) gapGain[i] = i < ia + r ? 1 - (i - ia) / r : 0;
}

console.time('reverb');
const [revL, revR] = freeverb(bus.rev[0], bus.rev[1]);
console.timeEnd('reverb');
const [dlyL, dlyR] = pingpong(bus.dly[0], bus.dly[1], SPB * 0.75, 0.4);

const MIX = {
  kick: [1.0, 0], drums: [1.45, 0], bass: [0.78, 0.55], pad: [0.85, 0.8], stab: [0.9, 0.45],
  lead: [0.85, 0.35], arp: [0.9, 0.35], fx: [0.9, 0], hits: [0.9, 0],
};
const outL = new Float32Array(N), outR = new Float32Array(N);
const busStats = {};
for (const [name, [g, sc]] of Object.entries(MIX)) {
  const [L, R] = bus[name];
  let sum = 0, pk = 0;
  const gated = name !== 'fx';
  for (let i = 0; i < N; i++) {
    const k = g * (1 - sc * scEnv[i]) * (gated ? gapGain[i] : 1);
    const l = L[i] * k, r = R[i] * k;
    outL[i] += l; outR[i] += r;
    sum += l * l + r * r; pk = Math.max(pk, Math.abs(l), Math.abs(r));
  }
  busStats[name] = { rmsDb: +(10 * Math.log10(sum / (2 * N) + 1e-12)).toFixed(1), peakDb: +(20 * Math.log10(pk + 1e-12)).toFixed(1) };
}
for (let i = 0; i < N; i++) {
  const kr = 0.9 * (1 - 0.35 * scEnv[i]) * gapGain[i];
  outL[i] += revL[i] * kr + dlyL[i] * 0.55 * gapGain[i];
  outR[i] += revR[i] * kr + dlyR[i] * 0.55 * gapGain[i];
}

// ---------- beat-repeat stutters on a few transitions ----------
function stutter(t, slice, reps) {
  const a = s(t), n = s(slice), fade = s(0.0015);
  const segL = outL.slice(a, a + n), segR = outR.slice(a, a + n);
  for (let r = 1; r < reps; r++) {
    const g = 1 - r * (0.5 / reps);
    for (let i = 0; i < n; i++) {
      const j = a + r * n + i; if (j >= N) break;
      const f = Math.min(1, i / fade, (n - i) / fade);
      outL[j] = segL[i] * g * f + outL[j] * (1 - f);
      outR[j] = segR[i] * g * f + outR[j] * (1 - f);
    }
  }
}
stutter(T(5, 3.5), SPB / 8, 4);
stutter(T(17, 3.5), SPB / 8, 4);
stutter(T(21, 3.5), SPB / 8, 4);

// ---------- master: DC/HPF, normalise, soft clip, fade ----------
// RBJ biquads for a gentle master tilt: low-mid dip + high shelf.
function biquad(x, type, f0, gainDb, q = 0.707) {
  const A = Math.pow(10, gainDb / 40), w0 = (TAU * f0) / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else { // high shelf
    const sq = 2 * Math.sqrt(A) * al;
    b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq);
    a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq;
  }
  const o = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y;
  }
  return o;
}
const eq = (x) => biquad(biquad(biquad(x, 'peak', 320, -2.5, 0.9), 'peak', 90, -1.5, 1.0), 'shelf', 4500, 5.0, 0.7);
const hL = svf(eq(outL), 28, 0.7, 2), hR = svf(eq(outR), 28, 0.7, 2);
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(hL[i]), Math.abs(hR[i]));
const DRIVE = 1.9;
const pre = 1 / peak;
const outFade = (i) => { const t = i / SR; return t > DURATION - 1.2 ? Math.max(0, (DURATION - t) / 1.2) : 1; };
const finalL = new Float32Array(N), finalR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const f = outFade(i) * Math.min(1, i / s(0.005));
  finalL[i] = (Math.tanh(hL[i] * pre * DRIVE) / Math.tanh(DRIVE)) * 0.97 * f;
  finalR[i] = (Math.tanh(hR[i] * pre * DRIVE) / Math.tanh(DRIVE)) * 0.97 * f;
}

// ---------- true-peak-ish limiter (cubic inter-sample estimate, 1.5 ms lookahead) ----------
function tpLimit(L, R, ceiling) {
  const n = L.length;
  const need = new Float32Array(n).fill(1);
  const cub = (y0, y1, y2, y3, t) => {
    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3, b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c = -0.5 * y0 + 0.5 * y2;
    return ((a * t + b) * t + c) * t + y1;
  };
  for (let i = 1; i < n - 2; i++) {
    let pk = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    for (const x of [L, R]) for (const t of [0.25, 0.5, 0.75]) pk = Math.max(pk, Math.abs(cub(x[i - 1], x[i], x[i + 1], x[i + 2], t)));
    if (pk > ceiling) need[i] = ceiling / pk;
  }
  const W = s(0.0015);
  const g = new Float32Array(n);
  let cur = 1;
  const rel = Math.exp(-1 / s(0.06));
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = 0; k <= W && i + k < n; k++) if (need[i + k] < m) m = need[i + k];
    cur = m < cur ? m : m + (cur - m) * rel;
    g[i] = cur;
  }
  for (let i = 0; i < n; i++) { L[i] *= g[i]; R[i] *= g[i]; }
}
{ // remove near-Nyquist energy created by the clipper before limiting
  const l1 = svf(svf(finalL, 16500, 0.54, 0), 16500, 1.31, 0), r1 = svf(svf(finalR, 16500, 0.54, 0), 16500, 1.31, 0);
  finalL.set(l1); finalR.set(r1);
}
tpLimit(finalL, finalR, 0.74);

// ---------- write WAV (24-bit) ----------
function writeWav(file, L, R) {
  const bytes = 3, ch = 2;
  const dataLen = L.length * ch * bytes;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * ch * bytes, 28); buf.writeUInt16LE(ch * bytes, 32); buf.writeUInt16LE(bytes * 8, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < L.length; i++) {
    for (const x of [L[i], R[i]]) {
      const v = Math.max(-8388608, Math.min(8388607, Math.round(x * 8388607)));
      buf.writeIntLE(v, o, 3); o += 3;
    }
  }
  fs.writeFileSync(file, buf);
}
const BUILD = path.join(HERE, '..', '..', 'build');
fs.mkdirSync(BUILD, { recursive: true });
writeWav(path.join(BUILD, 'soundtrack.wav'), finalL, finalR);

// ---------- export events for the visuals ----------
const round = (a) => a.map((x) => x.map((v) => +(+v).toFixed(4)));
const events = Object.fromEntries(Object.entries(EV).map(([k, v]) => [k, round(v).sort((a, b) => a[0] - b[0])]));
fs.writeFileSync(
  path.join(HERE, '..', 'generated', 'events.js'),
  '// Generated by audio/synth.mjs - audio hit times [seconds, velocity] for visual sync.\nexport const EVENTS = ' + JSON.stringify(events) + ';\n',
);
console.log('bus stats', busStats);
console.log('pre-master peak', peak.toFixed(3), 'events', Object.fromEntries(Object.entries(events).map(([k, v]) => [k, v.length])));
