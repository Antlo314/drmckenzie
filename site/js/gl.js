/* ============================================================
   Aurora-silk WebGL background · Mind Your Mind
   One fragment shader; palettes lerp as the visitor scrolls
   between sections. Half-res render, DPR-capped, pauses when
   hidden. Falls back to CSS gradient if WebGL is unavailable.
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('gl');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
          || canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) { canvas.remove(); return; }

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uBase;     // deep background
uniform vec3  uC1;       // primary aurora
uniform vec3  uC2;       // secondary aurora
uniform vec3  uC3;       // undertone
uniform float uStars;    // starfield mix (night section)
uniform float uEnergy;   // overall band intensity
uniform vec2  uDrift;    // slow pointer parallax

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}

float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .55; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = uv; q.x *= uRes.x / uRes.y;
  float t = uTime * .045;

  // domain-warped silk
  vec2 w1 = vec2(fbm(q * 1.4 + t), fbm(q * 1.4 - t * .8 + 4.7));
  vec2 w2 = vec2(fbm(q * 2.2 - w1 * 1.4 + t * .6), fbm(q * 2.2 + w1 * 1.4 - t * .5 + 2.1));
  float silk = fbm(q * 1.7 + w2 * 1.5 + uDrift * .25);

  // layered bands
  float band1 = smoothstep(.32, .78, silk);
  float band2 = smoothstep(.55, .95, fbm(q * 2.6 - w2 + t * .4));
  float veil  = smoothstep(.2, .9, fbm(q * .8 + w1 * .8 - t * .3));

  // Paper wash: the base is a light stock, so the bands tint it like ink
  // bleeding into the sheet rather than glowing out of a void. Weights stay
  // low so type keeps its contrast.
  vec3 col = uBase;
  col = mix(col, uC3, veil  * .34 * uEnergy);
  col = mix(col, uC1, band1 * .26 * uEnergy);
  col = mix(col, uC2, band2 * .22 * uEnergy);

  // starfield, night-vision band only
  if (uStars > .003){
    vec2 sp = gl_FragCoord.xy / 3.0;
    float s = hash(floor(sp));
    float star = step(.9975, s) * (0.55 + 0.45 * sin(uTime * (1.5 + 3. * fract(s * 7.)) + s * 40.));
    float glow = star * smoothstep(.0, 1., fract(s * 13.));
    col += uStars * glow * vec3(.82, .93, 1.);
  }

  // vignette: darken toward the edges on light stock, lift on dark
  float vig = smoothstep(1.3, .3, length(uv - .5));
  float lum = dot(uBase, vec3(.299, .587, .114));
  col *= mix(mix(.94, .72, step(.5, 1. - lum)), 1., vig);

  gl_FragColor = vec4(col, 1.);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(locP);
  gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uTime', 'uBase', 'uC1', 'uC2', 'uC3', 'uStars', 'uEnergy', 'uDrift'])
    U[n] = gl.getUniformLocation(prog, n);

  // ---------------------------------------------------- palettes per theme
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  // Light stock with tinted washes. Night keeps a deep base on purpose — that
  // section is about seeing in the dark, so it reads as a designed inversion.
  const PAL = {
    hero:     { base: hex('#f4f1ea'), c1: hex('#e6d3ee'), c2: hex('#cfe9ea'), c3: hex('#f6e6d2'), stars: 0.0,  energy: 1.0 },
    coaching: { base: hex('#f6f2f5'), c1: hex('#eed6f0'), c2: hex('#f2e3cd'), c3: hex('#dfe3f2'), stars: 0.0,  energy: 0.9 },
    mym:      { base: hex('#eef4ec'), c1: hex('#cfe9d6'), c2: hex('#e2f0d9'), c3: hex('#f1e6cd'), stars: 0.0,  energy: 0.95 },
    night:    { base: hex('#0d1620'), c1: hex('#1b4965'), c2: hex('#5fa8d3'), c3: hex('#132436'), stars: 1.0,  energy: 0.8 },
    shop:     { base: hex('#f1f3ee'), c1: hex('#d8e8dc'), c2: hex('#e6eddc'), c3: hex('#f0e5d0'), stars: 0.0,  energy: 0.85 },
    missions: { base: hex('#f8f1e8'), c1: hex('#f4dcc4'), c2: hex('#f6dde5'), c3: hex('#ecdcc6'), stars: 0.0,  energy: 0.9 },
    connect:  { base: hex('#f3f0f6'), c1: hex('#e2d6ef'), c2: hex('#d2e8ea'), c3: hex('#f4e6d4'), stars: 0.0,  energy: 1.0 }
  };

  const clone = p => (typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p)));
  const startName = document.documentElement.dataset.theme in PAL ? document.documentElement.dataset.theme : 'hero';
  const cur = clone(PAL[startName]);
  let target = PAL[startName];
  let snapped = false;
  let customPalette;
  window.__setGLPalette = (primary, secondary) => {
    customPalette = [hex(primary), hex(secondary)];
    window.__setGLTheme(document.documentElement.dataset.theme || startName);
  };
  window.__setGLTheme = name => {
    if (!PAL[name]) return;
    const isDark = palette => palette.base[0] * .299 + palette.base[1] * .587 + palette.base[2] * .114 < .5;
    const crossesLightnessBoundary = isDark(target) !== isDark(PAL[name]);
    target = PAL[name];
    if (customPalette) {
      const weight = name === 'night' ? .35 : .20;
      const tint = color => target.base.map((base, i) => base * (1 - weight) + color[i] * weight);
      target = { ...target, c1: tint(customPalette[0]), c2: tint(customPalette[1]) };
    }
    // Keep the background in sync with text when switching between light and
    // dark sections. Light-to-light palette changes can still fade smoothly.
    if (!snapped || reduced || crossesLightnessBoundary) {
      snapped = true;
      for (const k of ['base', 'c1', 'c2', 'c3']) for (let i = 0; i < 3; i++) cur[k][i] = target[k][i];
      cur.stars = target.stars; cur.energy = target.energy;
    }
    if (crossesLightnessBoundary) frame(false);
  };

  // ---------------------------------------------------- pointer drift
  const drift = [0, 0], driftTarget = [0, 0];
  addEventListener('pointermove', e => {
    driftTarget[0] = (e.clientX / innerWidth - .5) * 2;
    driftTarget[1] = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });

  // ---------------------------------------------------- sizing
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * 0.5;   // half-res render
    canvas.width = Math.max(2, Math.round(innerWidth * dpr));
    canvas.height = Math.max(2, Math.round(innerHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  // ---------------------------------------------------- loop
  const mix = (a, b, k) => a + (b - a) * k;
  let running = true, t0 = performance.now();
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { t0 = performance.now() - tLast * 1000; frame(); }
  });

  let tLast = 0;
  function frame(schedule = true) {
    if (!running) return;
    // recover from zero-size init (hidden/background tab at load)
    const wantW = Math.max(2, Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5) * 0.5));
    if (canvas.width !== wantW) resize();
    const t = (performance.now() - t0) / 1000;
    tLast = t;
    const k = 0.03;
    for (let i = 0; i < 3; i++) {
      cur.base[i] = mix(cur.base[i], target.base[i], k);
      cur.c1[i]   = mix(cur.c1[i],   target.c1[i],   k);
      cur.c2[i]   = mix(cur.c2[i],   target.c2[i],   k);
      cur.c3[i]   = mix(cur.c3[i],   target.c3[i],   k);
    }
    cur.stars  = mix(cur.stars,  target.stars,  k);
    cur.energy = mix(cur.energy, target.energy, k);
    drift[0] = mix(drift[0], driftTarget[0], .04);
    drift[1] = mix(drift[1], driftTarget[1], .04);

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, reduced ? 12.0 : t);
    gl.uniform3fv(U.uBase, cur.base);
    gl.uniform3fv(U.uC1, cur.c1);
    gl.uniform3fv(U.uC2, cur.c2);
    gl.uniform3fv(U.uC3, cur.c3);
    gl.uniform1f(U.uStars, cur.stars);
    gl.uniform1f(U.uEnergy, cur.energy);
    gl.uniform2f(U.uDrift, drift[0], drift[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduced && schedule) requestAnimationFrame(frame);
  }
  frame();
  if (reduced) {                       // static frame, but still recolor on section change
    setInterval(() => { if (running) frame(); }, 250);
  }
})();
