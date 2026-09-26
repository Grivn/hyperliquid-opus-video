// 迷你合成器教学版：不用任何音频素材，纯 JavaScript 从零"算"出鼓点和音效。
// 运行：node mini-synth.mjs
// 输出：sounds_tour.wav（每个声音单独听一遍）和 beat_demo.wav（组合成一段 128 BPM 的蓄力 + drop）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;                      // 采样率：每秒 48000 个数字，每个数字在 -1 ~ 1 之间
const TAU = Math.PI * 2;
const BPM = 128, BEAT = 60 / BPM;      // 一拍 0.46875 秒，一小节 4 拍

// ============ 1. 基础零件 ============
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));   // 一段"静音"
const noise = () => Math.random() * 2 - 1;                     // 白噪声 = 随机数
const noiseBuf = (sec) => buf(sec).map(() => noise());
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);          // MIDI 音符号 → 频率（69 = A4 = 440Hz）

// 滤波器（状态变量滤波器 SVF）：lp 低通 / bp 带通 / hp 高通。
// cutoff 可以传函数 (t) => 频率，让截止频率随时间变化，这就是"扫频"。
function filter(x, cutoff, type = 'lp', q = 0.8) {
  const out = new Float32Array(x.length);
  let ic1 = 0, ic2 = 0;
  const k = 1 / q;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    const g = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    out[i] = type === 'lp' ? v2 : type === 'bp' ? v1 : x[i] - k * v1 - v2;
  }
  return out;
}

// 锯齿波振荡器（带 polyBLEP 抗混叠：在波形跳变处做一点圆滑，高音不刺耳）
function saw(freq, sec) {
  const o = buf(sec);
  const dt = freq / SR;
  let ph = Math.random();
  for (let i = 0; i < o.length; i++) {
    let v = 2 * ph - 1;
    if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; }
    else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
    o[i] = v;
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}

// ============ 2. 乐器配方 ============

// 底鼓：正弦波 + 音高从 225Hz 瞬间掉到 45Hz（"咚"的冲击感全靠这条音高曲线）
function kick() {
  const o = buf(0.5);
  let phase = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const freq = 45 + 180 * Math.exp(-t * 40);
    phase += (TAU * freq) / SR;                  // 频率在变，所以要累加相位，而不是直接 sin(2πft)
    o[i] = Math.tanh(Math.sin(phase) * Math.exp(-t * 7) * 2);  // tanh 软削波，让它更"胖"
  }
  return o;
}

// 军鼓：180Hz 左右的正弦"鼓皮" + 带通噪声"响弦"
function snare() {
  const o = buf(0.25);
  const n = filter(noiseBuf(0.25), 3000, 'bp', 0.7);
  let phase = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    phase += (TAU * (170 + 60 * Math.exp(-t * 40))) / SR;
    o[i] = Math.sin(phase) * Math.exp(-t / 0.05) * 0.8 + n[i] * Math.exp(-t / 0.07) * 1.4;
  }
  return o;
}

// 拍手：带通噪声，3 个相隔约 10ms 的短脉冲（好几只手先后拍到）+ 一条尾巴
function clap() {
  const o = buf(0.4);
  const n = filter(noiseBuf(0.4), 1200, 'bp', 1.2);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    let env = 0;
    for (const d of [0, 0.01, 0.02]) if (t >= d) env += Math.exp(-(t - d) / 0.003);
    if (t >= 0.03) env += Math.exp(-(t - 0.03) / 0.08);
    o[i] = n[i] * env * 1.5;
  }
  return o;
}

// 踩镲：TR-808 的"金属"配方 —— 6 个频率不成整数倍的方波叠加，再只留 7kHz 以上的高频
function hat(open = false) {
  const o = buf(open ? 0.4 : 0.08);
  const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.9);
  for (let i = 0; i < o.length; i++) {
    let x = 0;
    for (const f of freqs) x += ((i * f) / SR) % 1 < 0.5 ? 1 : -1;
    o[i] = (x / 6) * 0.6 + noise() * 0.4;
  }
  const hi = filter(filter(o, 10000, 'bp', 0.9), 7000, 'hp');
  for (let i = 0; i < hi.length; i++) hi[i] *= Math.exp(-(i / SR) / (open ? 0.13 : 0.02));
  return hi;
}

// 贝斯：锯齿波过低通滤波，截止频率从 1650Hz 快速落到 150Hz（"嘟"的弹拨感）+ 同音高正弦加厚低频
function bass(note, sec = BEAT / 4) {
  const f = mtof(note);
  const lp = filter(saw(f, sec), (t) => 150 + 1500 * Math.exp(-t / 0.04), 'lp', 1.1);
  const o = buf(sec);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const amp = Math.min(1, t / 0.002) * Math.max(0, 1 - t / sec);  // 2ms 起音 + 线性收尾，避免"咔哒"声
    o[i] = Math.tanh((lp[i] + Math.sin(TAU * f * t)) * 1.3) * amp;
  }
  return o;
}

// 超级锯齿和弦（Supersaw）：每个音 7 个互相微微跑调的锯齿波，左右分开 → 又宽又亮的电子和弦
function stab(notes, sec = 0.2) {
  const len = sec + 0.3;
  const L = buf(len), R = buf(len);
  const cents = [-24, -15, -7, 0, 7, 15, 24];   // 音分：100 音分 = 1 个半音
  const pans = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];
  for (const n of notes) cents.forEach((c, v) => {
    const s = saw(mtof(n) * Math.pow(2, c / 1200), len);
    const l = (1 - pans[v]) / 2, r = (1 + pans[v]) / 2;
    for (let i = 0; i < L.length; i++) { L[i] += s[i] * l; R[i] += s[i] * r; }
  });
  const cut = (t) => 1200 + 8000 * Math.exp(-t / 0.12);   // 亮一下再变暗
  const fl = filter(L, cut), fr = filter(R, cut);
  for (let i = 0; i < fl.length; i++) {
    const t = i / SR;
    const amp = (t < sec ? 1 : Math.exp(-(t - sec) / 0.07)) / Math.sqrt(notes.length * 7);
    fl[i] *= amp; fr[i] *= amp;
  }
  return [fl, fr];
}

// 上升音效（Riser）：白噪声过带通滤波，中心频率从 300Hz 指数升到 11kHz，音量越来越大 → "嗖——"
function riser(sec) {
  const o = filter(noiseBuf(sec), (t) => 300 * Math.pow(11000 / 300, t / sec), 'bp', 1.5);
  for (let i = 0; i < o.length; i++) { const x = i / o.length; o[i] *= x * x * 1.5; }
  return o;
}

// 冲击音（Impact）：超低频正弦从 77Hz 滑到 27Hz 的"轰" + 低通噪声爆破
function impact() {
  const o = buf(2);
  const n = filter(noiseBuf(2), 3000, 'lp');
  let phase = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    phase += (TAU * (27 + 50 * Math.exp(-t * 3))) / SR;
    o[i] = Math.tanh(Math.sin(phase) * 1.5) * Math.exp(-t / 0.7) + n[i] * Math.exp(-t / 0.25) * 0.6;
  }
  return o;
}

// ============ 3. 混音台 ============
function makeBus(sec) { return [buf(sec), buf(sec)]; }
// 把一个声音"贴"到总线的第 t 秒。sound 可以是单声道数组，也可以是 [左, 右]
function place(bus, sound, t, gain = 1, pan = 0) {
  const [l, r] = Array.isArray(sound) ? sound : [sound, sound];
  const gl = gain * (pan > 0 ? 1 - pan : 1), gr = gain * (pan < 0 ? 1 + pan : 1);
  const s0 = Math.round(t * SR);
  const fade = Math.min(480, l.length >> 2);   // 结尾 10ms 淡出，防止截断产生爆音
  for (let i = 0; i < l.length && s0 + i < bus[0].length; i++) {
    const f = i < l.length - fade ? 1 : (l.length - i) / fade;
    bus[0][s0 + i] += l[i] * gl * f;
    bus[1][s0 + i] += r[i] * gr * f;
  }
}
// 乒乓回声：左右声道交替的延迟，给和弦加空间感
function pingPong(bus, delay, feedback = 0.35) {
  const D = Math.round(delay * SR);
  const [L, R] = bus;
  const outL = new Float32Array(L.length), outR = new Float32Array(R.length);
  for (let i = D; i < L.length; i++) {
    outL[i] = (L[i - D] + R[i - D]) * 0.5 + outR[i - D] * feedback;
    outR[i] = outL[i - D] * feedback;
  }
  return [outL, outR];
}
// 母带：几条总线相加 → 归一化 → tanh 软限幅（更响、不爆音）
function master(buses, sec) {
  const [L, R] = makeBus(sec);
  for (const [bl, br] of buses) for (let i = 0; i < L.length; i++) { L[i] += bl[i]; R[i] += br[i]; }
  let peak = 1e-9;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh((L[i] / peak) * 1.6) * 0.85;
    R[i] = Math.tanh((R[i] / peak) * 1.6) * 0.85;
  }
  return [L, R];
}
function writeWav(file, [L, R]) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  const s16 = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
  for (let i = 0; i < n; i++) { b.writeInt16LE(s16(L[i]), 44 + i * 4); b.writeInt16LE(s16(R[i]), 46 + i * 4); }
  fs.writeFileSync(path.join(OUT, file), b);
  console.log('wrote', file, (n / SR).toFixed(2) + 's');
}

// ============ 4. 声音巡礼：每个零件单独听 ============
{
  const bus = makeBus(15);
  let t = 0.3;
  const next = (sound, gap, gain = 0.8) => { place(bus, sound, t, gain); t += gap; };
  next(kick(), 0.6); next(kick(), 0.9);                         // 底鼓 ×2
  next(snare(), 0.9, 0.6);                                      // 军鼓
  next(clap(), 0.9, 0.7);                                       // 拍手
  for (let i = 0; i < 8; i++) next(hat(i === 7), BEAT / 2, 0.5); // 踩镲 8 下，最后一下是开镲
  t += 0.4;
  for (const n of [41, 44, 48, 53]) next(bass(n, 0.2), 0.3, 0.7);  // 贝斯 F-A♭-C-F
  t += 0.3;
  next(stab([65, 68, 72, 77]), 1.0, 1.0);                       // Fm 超级锯齿和弦
  next(riser(2.5), 2.5, 0.6);                                   // 上升音效 2.5 秒……
  next(impact(), 2.5, 1.0);                                     // ……接冲击音
  writeWav('sounds_tour.wav', master([bus], 15));
}

// ============ 5. 编曲：2 小节蓄力 + 4 小节 drop ============
{
  const BAR = BEAT * 4;
  const T = (bar, beat = 0) => (bar * 4 + beat) * BEAT;   // 第几小节第几拍 → 秒
  const LEN = T(6) + 2.5;
  const drums = makeBus(LEN), music = makeBus(LEN), fx = makeBus(LEN);
  const kicks = [];

  // 蓄力（第 0~1 小节）：riser + 越来越密的军鼓（8 分 → 16 分 → 32 分音符），最后 1/8 小节留白
  place(fx, riser(2 * BAR), 0, 0.5);
  for (let b = 0; b < 4; b += 0.5) place(drums, snare(), T(0, b), 0.25 + b * 0.04);
  for (let b = 0; b < 2; b += 0.25) place(drums, snare(), T(1, b), 0.4 + b * 0.08);
  for (let b = 2; b < 3.5; b += 0.125) place(drums, snare(), T(1, b), 0.55 + (b - 2) * 0.25);
  for (let b = 0; b < 7.5; b += 0.25) place(drums, hat(), b * BEAT, 0.15 + b * 0.03, 0.2);

  // drop（第 2~5 小节）：和弦走向 Fm → D♭ → A♭ → E♭
  place(fx, impact(), T(2), 1.0);
  const chords = [[41, [65, 68, 72, 77]], [37, [65, 68, 73, 77]], [44, [63, 68, 72, 75]], [39, [63, 67, 70, 75]]];
  for (let bar = 2; bar < 6; bar++) {
    const [root, notes] = chords[bar - 2];
    for (let beat = 0; beat < 4; beat++) {
      place(drums, kick(), T(bar, beat), 1.0); kicks.push(T(bar, beat));   // 四拍底鼓（four-on-the-floor）
      if (beat % 2 === 1) place(drums, clap(), T(bar, beat), 0.7);         // 第 2、4 拍拍手
      for (let s = 0; s < 4; s++) {
        if (s === 2) place(drums, hat(true), T(bar, beat + 0.5), 0.35, 0.2);  // 反拍开镲
        else place(drums, hat(), T(bar, beat + s / 4), s === 0 ? 0.35 : 0.22, s % 2 ? 0.25 : -0.25);
        if (s > 0) place(music, bass(root + (s === 3 && beat % 2 ? 12 : 0)), T(bar, beat + s / 4), 0.6); // 滚动贝斯：避开底鼓那个 16 分位
      }
    }
    for (const s of [0, 3, 6, 10, 13]) place(music, stab(notes), T(bar, s / 4), 0.9);  // 切分节奏的和弦
  }
  place(drums, kick(), T(6), 1.0); kicks.push(T(6));
  place(music, stab([65, 68, 72, 77], 1.2), T(6), 1.0);   // 结尾长和弦

  // 侧链压缩：每次底鼓响，音乐总线音量瞬间压低 70% 再慢慢恢复 → 电子乐标志性的"呼吸泵感"
  for (const t of kicks) {
    const s0 = Math.round(t * SR);
    for (let i = 0; i < 0.35 * SR && s0 + i < music[0].length; i++) {
      const g = 1 - 0.7 * Math.exp(-(i / SR) / 0.09);
      music[0][s0 + i] *= g; music[1][s0 + i] *= g;
    }
  }
  const echo = pingPong(music, BEAT * 0.75, 0.35);   // 附点八分音符的乒乓回声
  for (const ch of echo) for (let i = 0; i < ch.length; i++) ch[i] *= 0.35;
  writeWav('beat_demo.wav', master([drums, music, echo, fx], LEN));
}
