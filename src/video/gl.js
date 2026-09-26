// WebGL2 layer: brand particle ribbons, warp dust, dotted globe, grid floor,
// plus the post stack (motion-blur accumulation, bloom, CA, glitch, grain, flash).
import { mat4, mulberry32 } from './util.js';

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BG_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform vec3 uC0, uC1; uniform vec2 uCenter; uniform float uAmt;
void main(){
  vec2 d = (vUV - uCenter) * vec2(1.7778, 1.0);
  float r = length(d);
  vec3 c = mix(uC1, uC0, smoothstep(0.0, 1.25, r));
  o = vec4(c * uAmt, 1.0);
}`;

const RIB_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aA;   // u, v, r1, r2
layout(location=1) in float aRib;
uniform mat4 uVP;
uniform float uPhase, uAmp, uWidth, uScatter, uSize, uPulse, uSpread, uLen, uAlpha, uDisperse, uTilt;
out float vA; out float vR; out float vS;
void main(){
  float u = aA.x, v = aA.y, r1 = aA.z, r2 = aA.w, k = aRib;
  float x = (u - 0.5) * uLen;
  float ph = uPhase;
  float y = uAmp * (1.25 * sin(x * 0.16 + ph * 0.8 + k * 1.9) + 0.95 * sin(x * 0.083 - ph * 0.45 + k * 0.7) + 0.3 * sin(x * 0.37 + ph * 1.3 + k * 4.1));
  y += (k - 2.0) * uSpread + x * uTilt;
  float z = -k * 3.2 + 2.4 * sin(x * 0.11 + ph * 0.5 + k);
  float tw = x * 0.13 + ph * 0.55 + k * 1.1;
  y += cos(tw) * v * uWidth;
  z += sin(tw) * v * uWidth * 1.7;
  vec3 p = vec3(x, y, z);
  p += (vec3(fract(r1 * 91.7), fract(r2 * 57.3), fract((r1 + r2) * 33.1)) - 0.5) * uScatter;
  vec3 cloud = vec3((r1 - 0.5) * 110.0, (r2 - 0.5) * 60.0, (fract(r1 * r2 * 97.0) - 0.7) * 70.0);
  p = mix(p, cloud, uDisperse);
  vec4 cp = uVP * vec4(p, 1.0);
  gl_Position = cp;
  float w = max(cp.w, 0.1);
  float sz = uSize * (0.45 + 1.5 * r2 * r2) * (1.0 + uPulse * 0.55) * (24.0 / w);
  gl_PointSize = clamp(sz, 1.0, 16.0);
  vS = gl_PointSize;
  vA = uAlpha * smoothstep(95.0, 16.0, w) * smoothstep(0.8, 4.0, w) * (0.35 + 0.65 * r1) * min(1.0, sz / 1.2);
  vR = r1;
}`;
const RIB_FS = `#version 300 es
precision highp float;
in float vA; in float vR; in float vS; out vec4 o;
uniform vec3 uColor, uColor2; uniform float uGrey;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.5 - 1.6 / vS, d) * vA;
  vec3 c = mix(uColor, uColor2, step(0.88, vR) * 0.7);
  c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))) * 0.75, uGrey);
  o = vec4(c * a, a);
}`;

const DUST_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aP;   // x, y, zseed, r
layout(location=1) in float aEnd;
uniform mat4 uVP; uniform vec3 uCam; uniform float uTravel, uStreak, uSize, uAlpha;
out float vA; out float vS;
void main(){
  float depth = 130.0;
  float zr = depth - mod(aP.z * depth + uTravel, depth);
  vec3 p = vec3(uCam.x + aP.x * 70.0, uCam.y + aP.y * 40.0, uCam.z - 1.5 - zr - aEnd * uStreak);
  vec4 cp = uVP * vec4(p, 1.0);
  gl_Position = cp;
  gl_PointSize = clamp(uSize * (0.4 + aP.w) * 30.0 / max(cp.w, 0.1), 1.0, 7.0);
  vS = gl_PointSize;
  vA = uAlpha * smoothstep(130.0, 25.0, cp.w) * (0.25 + 0.75 * aP.w) * (1.0 - aEnd * 0.85);
}`;
const DUST_FS = `#version 300 es
precision highp float; in float vA; in float vS; out vec4 o; uniform vec3 uColor; uniform float uLines;
void main(){
  float a = vA;
  if (uLines < 0.5) { float d = length(gl_PointCoord - 0.5); a *= smoothstep(0.5, 0.5 - 1.6 / vS, d); }
  o = vec4(uColor * a, a);
}`;

const GLOBE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aG;   // lat, lon, kind
uniform vec2 uCenter, uRes; uniform float uRadius, uYaw, uPitch, uSize, uAlpha;
out float vA; out float vS; out float vK;
void main(){
  float lat = radians(aG.x), lon = radians(aG.y) + uYaw;
  vec3 p = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  float c = cos(uPitch), s = sin(uPitch);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  vec2 sp = uCenter + vec2(p.x, -p.y) * uRadius;
  gl_Position = vec4(sp.x / uRes.x * 2.0 - 1.0, 1.0 - sp.y / uRes.y * 2.0, 0.0, 1.0);
  float front = p.z;
  gl_PointSize = uSize * (aG.z > 0.5 ? 0.55 : 1.0) * (0.7 + 0.3 * max(front, 0.0));
  vS = gl_PointSize;
  vA = uAlpha * (front > 0.0 ? 0.35 + 0.65 * front : 0.1 * (1.0 + front)) * (aG.z > 0.5 ? 0.3 : 1.0);
  vK = aG.z;
}`;
const GLOBE_FS = `#version 300 es
precision highp float; in float vA; in float vS; in float vK; out vec4 o; uniform vec3 uColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.5 - 1.6 / vS, d) * vA;
  o = vec4(uColor * a, a);
}`;

const FLOOR_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCam, uColor; uniform float uY, uAlpha, uScroll, uCell;
void main(){
  vec2 ndc = vUV * 2.0 - 1.0;
  vec4 a = uInvVP * vec4(ndc, -1.0, 1.0); a /= a.w;
  vec4 b = uInvVP * vec4(ndc, 1.0, 1.0); b /= b.w;
  vec3 dir = normalize(b.xyz - a.xyz);
  if (dir.y > -1e-4) discard;
  float t = (uY - a.y) / dir.y;
  if (t < 0.0) discard;
  vec3 h = a.xyz + dir * t;
  vec2 g = (h.xz + vec2(0.0, uScroll)) / uCell;
  vec2 fw = fwidth(g);
  vec2 gd = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
  float line = 1.0 - min(min(gd.x, gd.y), 1.0);
  vec2 g2 = g / 5.0; vec2 fw2 = fwidth(g2);
  vec2 gd2 = abs(fract(g2 - 0.5) - 0.5) / max(fw2, vec2(1e-4));
  float major = 1.0 - min(min(gd2.x, gd2.y), 1.0);
  float fog = exp(-length(h - uCam) * 0.03);
  float al = (line * 0.55 + major * 0.9) * fog * uAlpha;
  o = vec4(uColor * al, al);
}`;

const ACC_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uScene, uOv; uniform float uW;
void main(){
  vec3 s = texture(uScene, vUV).rgb;
  vec4 ov = texture(uOv, vUV);
  o = vec4((s * (1.0 - ov.a) + ov.rgb) * uW, uW);
}`;

const PRE_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh, uKnee;
void main(){
  vec2 h = uTexel * 0.5;
  vec3 c = (texture(uSrc, vUV + vec2(-h.x, -h.y)).rgb + texture(uSrc, vUV + vec2(h.x, -h.y)).rgb +
            texture(uSrc, vUV + vec2(-h.x, h.y)).rgb + texture(uSrc, vUV + vec2(h.x, h.y)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float k = max(soft, br - uThresh) / max(br, 1e-4);
  o = vec4(c * k, 1.0);
}`;
const DOWN_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){
  vec2 h = uTexel;
  vec3 s = texture(uSrc, vUV).rgb * 4.0;
  s += texture(uSrc, vUV - h).rgb + texture(uSrc, vUV + h).rgb;
  s += texture(uSrc, vUV + vec2(h.x, -h.y)).rgb + texture(uSrc, vUV - vec2(h.x, -h.y)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;
const UP_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uW;
void main(){
  vec2 h = uTexel;
  vec3 s = texture(uSrc, vUV + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture(uSrc, vUV + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(uSrc, vUV + vec2(0.0, h.y * 2.0)).rgb;
  s += texture(uSrc, vUV + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(uSrc, vUV + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture(uSrc, vUV + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(uSrc, vUV + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture(uSrc, vUV + vec2(-h.x, -h.y)).rgb * 2.0;
  o = vec4(s / 12.0 * uW, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o;
uniform sampler2D uAcc, uBloom; uniform vec2 uRes, uShake;
uniform float uBloomStr, uCA, uGlitch, uGrain, uVig, uFlash, uFade, uZoom, uSeed, uScan, uInvert;
float h1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 softClip(vec3 c){ return mix(c, 1.0 - 0.25 * exp(-(c - 0.75) * 4.0), step(0.75, c)); }
void main(){
  vec2 uv = (vUV - 0.5) / uZoom + 0.5 + uShake / uRes;
  float gA = 0.0;
  if (uGlitch > 0.001) {
    float rows = 18.0 + 30.0 * h1(floor(uSeed * 3.0));
    float band = floor(uv.y * rows);
    float r = h1(band * 3.7 + floor(uSeed * 7.0));
    if (r < uGlitch * 0.55) { gA = (h1(band * 9.1 + uSeed) - 0.5); uv.x += gA * 0.09 * uGlitch; }
  }
  vec2 d = uv - 0.5;
  float ca = uCA + abs(gA) * 0.03 * uGlitch;
  vec3 col;
  col.r = texture(uAcc, uv + d * ca + vec2(gA * 0.01, 0.0)).r;
  col.g = texture(uAcc, uv).g;
  col.b = texture(uAcc, uv - d * ca - vec2(gA * 0.01, 0.0)).b;
  vec3 bl = texture(uBloom, uv).rgb;
  col += bl * uBloomStr;
  col += uFlash * vec3(0.86, 1.0, 0.95);
  float v = smoothstep(1.05, 0.25, length(d * vec2(1.25, 1.0)));
  col *= mix(1.0 - uVig, 1.0, v);
  col = softClip(col);
  col = mix(col, 1.0 - col, uInvert);
  col *= 1.0 - uScan * (0.5 + 0.5 * sin(vUV.y * uRes.y * 3.14159));
  col += (h2(vUV * uRes + uSeed * 17.0) - 0.5) * uGrain;
  o = vec4(clamp(col * uFade, 0.0, 1.0), 1.0);
}`;

export class GL {
  constructor(canvas, W, H) {
    this.W = W; this.H = H;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.p = {
      bg: this.prog(QUAD_VS, BG_FS), rib: this.prog(RIB_VS, RIB_FS), dust: this.prog(DUST_VS, DUST_FS),
      globe: this.prog(GLOBE_VS, GLOBE_FS), floor: this.prog(QUAD_VS, FLOOR_FS), acc: this.prog(QUAD_VS, ACC_FS),
      pre: this.prog(QUAD_VS, PRE_FS), down: this.prog(QUAD_VS, DOWN_FS), up: this.prog(QUAD_VS, UP_FS), fin: this.prog(QUAD_VS, FINAL_FS),
    };
    const fmt = this.float ? gl.RGBA16F : gl.RGBA8;
    this.fmt = fmt;
    // multisampled scene target
    this.msFbo = gl.createFramebuffer();
    this.msRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msRb);
    const maxS = gl.getInternalformatParameter(gl.RENDERBUFFER, fmt, gl.SAMPLES);
    const samples = Math.min(4, maxS && maxS.length ? maxS[0] : 4);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msRb);
    this.scene = this.target(W, H);
    this.acc = this.target(W, H);
    this.mips = [];
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < 6; i++) { this.mips.push(this.target(w, h)); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
    this.ovTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.ovTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.buildRibbons();
    this.buildDust();
  }

  prog(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  target(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.float ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  buildRibbons() {
    const gl = this.gl;
    const R = mulberry32(7), RIBS = 5, PER = 13000;
    const a = new Float32Array(RIBS * PER * 4), k = new Float32Array(RIBS * PER);
    for (let r = 0; r < RIBS; r++) for (let i = 0; i < PER; i++) {
      const j = r * PER + i;
      const q = R() * 2 - 1;
      a[j * 4] = R(); a[j * 4 + 1] = Math.sign(q) * Math.pow(Math.abs(q), 0.65); a[j * 4 + 2] = R(); a[j * 4 + 3] = R();
      k[j] = r;
    }
    this.ribN = RIBS * PER;
    this.ribVao = gl.createVertexArray();
    gl.bindVertexArray(this.ribVao);
    const b1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b1); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    const b2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b2); gl.bufferData(gl.ARRAY_BUFFER, k, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  buildDust() {
    const gl = this.gl;
    const R = mulberry32(11), N = 2600;
    const pts = new Float32Array(N * 5), lines = new Float32Array(N * 2 * 5);
    for (let i = 0; i < N; i++) {
      const x = R() * 2 - 1, y = R() * 2 - 1, z = R(), r = R();
      pts.set([x, y, z, r, 0], i * 5);
      lines.set([x, y, z, r, 0, x, y, z, r, 1], i * 10);
    }
    this.dustN = N;
    const mkVao = (data) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
      gl.bindVertexArray(null);
      return vao;
    };
    this.dustPtsVao = mkVao(pts);
    this.dustLineVao = mkVao(lines);
  }

  setGlobe(latlon) {
    const gl = this.gl;
    const arr = [];
    for (let i = 0; i < latlon.length; i += 2) arr.push(latlon[i], latlon[i + 1], 0);
    for (let lat = -60; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 2) arr.push(lat, lon, 1);
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -80; lat <= 80; lat += 2) arr.push(lat, lon, 1);
    const data = new Float32Array(arr);
    this.globeN = data.length / 3;
    this.globeVao = gl.createVertexArray();
    gl.bindVertexArray(this.globeVao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  drawQuad() { const gl = this.gl; gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /** Render one sub-frame: 3D scene + 2D overlay, accumulated with weight w. */
  renderSub(S, overlay, w, first) {
    const gl = this.gl, { W, H } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    // background
    let P = this.p.bg; gl.useProgram(P.p);
    gl.uniform3fv(P.u.uC0, S.bg0); gl.uniform3fv(P.u.uC1, S.bg1); gl.uniform2fv(P.u.uCenter, S.bgCenter); gl.uniform1f(P.u.uAmt, S.bgAmt);
    this.drawQuad();

    const proj = mat4.perspective((S.fov * Math.PI) / 180, W / H, 0.1, 400);
    const view = mat4.lookAt(S.camPos, S.camTarget, S.camUp || [0, 1, 0]);
    const vp = mat4.mul(proj, view);
    gl.enable(gl.BLEND);
    if (S.floorA > 0.001) {
      gl.blendFunc(gl.ONE, gl.ONE);
      P = this.p.floor; gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uInvVP, false, mat4.invert(vp));
      gl.uniform3fv(P.u.uCam, S.camPos); gl.uniform3fv(P.u.uColor, S.color);
      gl.uniform1f(P.u.uY, S.floorY); gl.uniform1f(P.u.uAlpha, S.floorA); gl.uniform1f(P.u.uScroll, S.floorScroll); gl.uniform1f(P.u.uCell, 2.0);
      this.drawQuad();
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    if (S.ribA > 0.001) {
      P = this.p.rib; gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, vp);
      const u = P.u;
      gl.uniform1f(u.uPhase, S.ribPhase); gl.uniform1f(u.uAmp, S.ribAmp); gl.uniform1f(u.uWidth, S.ribWidth);
      gl.uniform1f(u.uScatter, S.ribScatter); gl.uniform1f(u.uSize, S.ribSize); gl.uniform1f(u.uPulse, S.ribPulse);
      gl.uniform1f(u.uSpread, S.ribSpread); gl.uniform1f(u.uLen, 110); gl.uniform1f(u.uAlpha, S.ribA);
      gl.uniform1f(u.uDisperse, S.ribDisperse); gl.uniform1f(u.uTilt, S.ribTilt);
      gl.uniform3fv(u.uColor, S.color); gl.uniform3fv(u.uColor2, S.color2); gl.uniform1f(u.uGrey, S.ribGrey);
      gl.bindVertexArray(this.ribVao); gl.drawArrays(gl.POINTS, 0, this.ribN);
    }
    if (S.dustA > 0.001) {
      P = this.p.dust; gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uVP, false, vp);
      gl.uniform3fv(P.u.uCam, S.camPos); gl.uniform1f(P.u.uTravel, S.dustTravel);
      gl.uniform1f(P.u.uSize, 2.2); gl.uniform1f(P.u.uAlpha, S.dustA); gl.uniform3fv(P.u.uColor, S.color);
      gl.uniform1f(P.u.uStreak, 0); gl.uniform1f(P.u.uLines, 0);
      gl.bindVertexArray(this.dustPtsVao); gl.drawArrays(gl.POINTS, 0, this.dustN);
      if (S.warp > 0.01) {
        gl.uniform1f(P.u.uStreak, S.warp * 14); gl.uniform1f(P.u.uLines, 1); gl.uniform1f(P.u.uAlpha, S.dustA * Math.min(1, S.warp * 1.5));
        gl.bindVertexArray(this.dustLineVao); gl.drawArrays(gl.LINES, 0, this.dustN * 2);
      }
    }
    if (S.globeA > 0.001 && this.globeVao) {
      P = this.p.globe; gl.useProgram(P.p);
      gl.uniform2fv(P.u.uCenter, S.globeCenter); gl.uniform2f(P.u.uRes, W, H); gl.uniform1f(P.u.uRadius, S.globeR);
      gl.uniform1f(P.u.uYaw, S.globeYaw); gl.uniform1f(P.u.uPitch, S.globePitch); gl.uniform1f(P.u.uSize, S.globeSize);
      gl.uniform1f(P.u.uAlpha, S.globeA); gl.uniform3fv(P.u.uColor, S.color);
      gl.bindVertexArray(this.globeVao); gl.drawArrays(gl.POINTS, 0, this.globeN);
    }
    // resolve MSAA
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fbo);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    // overlay upload
    gl.bindTexture(gl.TEXTURE_2D, this.ovTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overlay);
    // accumulate
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fbo);
    gl.viewport(0, 0, W, H);
    if (first) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    P = this.p.acc; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.tex); gl.uniform1i(P.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.ovTex); gl.uniform1i(P.u.uOv, 1);
    gl.uniform1f(P.u.uW, w);
    this.drawQuad();
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Bloom + final grade to the canvas. */
  finish(F) {
    const gl = this.gl, { W, H } = this;
    gl.disable(gl.BLEND);
    let P = this.p.pre; gl.useProgram(P.p);
    const m0 = this.mips[0];
    gl.bindFramebuffer(gl.FRAMEBUFFER, m0.fbo); gl.viewport(0, 0, m0.w, m0.h);
    gl.bindTexture(gl.TEXTURE_2D, this.acc.tex); gl.uniform1i(P.u.uSrc, 0);
    gl.uniform2f(P.u.uTexel, 1 / W, 1 / H); gl.uniform1f(P.u.uThresh, F.bloomThresh); gl.uniform1f(P.u.uKnee, 0.25);
    this.drawQuad();
    P = this.p.down; gl.useProgram(P.p);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1], dst = this.mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(P.u.uSrc, 0); gl.uniform2f(P.u.uTexel, 1 / src.w, 1 / src.h);
      this.drawQuad();
    }
    P = this.p.up; gl.useProgram(P.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 2; i >= 0; i--) {
      const src = this.mips[i + 1], dst = this.mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(P.u.uSrc, 0); gl.uniform2f(P.u.uTexel, 0.5 / src.w, 0.5 / src.h); gl.uniform1f(P.u.uW, 1.0);
      this.drawQuad();
    }
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    P = this.p.fin; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.acc.tex); gl.uniform1i(P.u.uAcc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips[0].tex); gl.uniform1i(P.u.uBloom, 1);
    gl.uniform2f(P.u.uRes, W, H); gl.uniform2fv(P.u.uShake, F.shake);
    const u = P.u;
    gl.uniform1f(u.uBloomStr, F.bloom); gl.uniform1f(u.uCA, F.ca); gl.uniform1f(u.uGlitch, F.glitch); gl.uniform1f(u.uGrain, F.grain);
    gl.uniform1f(u.uVig, F.vignette); gl.uniform1f(u.uFlash, F.flash); gl.uniform1f(u.uFade, F.fade); gl.uniform1f(u.uZoom, F.zoom);
    gl.uniform1f(u.uSeed, F.seed); gl.uniform1f(u.uScan, F.scan); gl.uniform1f(u.uInvert, F.invert || 0);
    this.drawQuad();
    gl.activeTexture(gl.TEXTURE0);
  }
}
