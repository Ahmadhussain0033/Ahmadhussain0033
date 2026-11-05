/* =====================================================================
   scene-core.js — the whole-page space you fly through (DOM-free)
   Runs inside a Web Worker on an OffscreenCanvas when the browser supports it
   (so the 3D never competes with scrolling/typing on the main thread), or on the
   page itself as a fallback. All page state arrives through the S object.
   • domain-warped grayscale nebula (full-screen shader)
   • twinkling star field along the flight path
   • hero centerpiece: faceted core + wireframe shell + bit cloud + gyroscope
   • drifting wireframe polyhedra + "gate" rings you fly through on scroll
   • shooting stars, warp streaks on navigation, beat-reactive everything
   ===================================================================== */
import * as THREE from "../vendor/three.module.min.js";

const raf = (cb) => (self.requestAnimationFrame ? self.requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 1000 / 60));

/* ---------- performance budget ----------
   The 3D pass is drawn at a resolution chosen by a pixel budget, not blindly at the
   screen's devicePixelRatio: a 4K or retina screen would otherwise push 4–9× the pixels
   for a soft background behind text. MSAA is only used where it is cheap and visible
   (normal-density screens); on hi-dpi screens the extra pixels already smooth the lines. */
const NEB_BUDGET = 2.0e5; // pixels for the nebula noise pass (soft, upscaled)

/**
 * env: { w, h, dpr, reduce, lite }       (fixed at start; w/h/dpr change via api.resize)
 * S:   live page state, mutated by the host:
 *      { sy, maxScroll, tx, ty, mx, my, beat, fxOff, hasMouse, hidden }
 * onGfx(info): called with { refresh, pr, fps } so the page can show it
 * returns { resize(w, h, dpr), warp(), enter() } or throws if WebGL isn't available
 */
export function createScene(canvas, env, S, onGfx = () => {}) {
  const reduce = !!env.reduce, lite = !!env.lite;
  let W = env.w, H = env.h, DPR = env.dpr || 1;
  const small = Math.min(W, H) < 700;
  const PIX_BUDGET = small ? 1.4e6 : 3.0e6; // device pixels per frame for the 3D pass
  const AA = !small && DPR < 1.5;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, alpha: false, stencil: false, powerPreference: "high-performance" });
  let quality = 1; // adaptive: steps down if this machine can't hold the display's refresh rate
  const targetPR = () => {
    const fit = Math.sqrt(PIX_BUDGET / Math.max(1, W * H));
    const liteFx = S.fxOff ? 0.75 : 1; // "effects off" = lighter 3D too
    return Math.max(0.5, Math.min(DPR, small ? 1.25 : 1.5, Math.max(0.75, fit)) * quality * liteFx);
  };
  renderer.setPixelRatio(targetPR());
  renderer.autoClear = false;

  const PATH = 260; // world units travelled from top to bottom of the page
  let nebDirty = true;

  /* ---------- nebula (screen-space) ----------
     The expensive noise pass renders into a small off-screen texture (≤ NEB_BUDGET pixels)
     at most 50× a second; a cheap pass upscales it and applies beat,
     vignette and intro dimming every frame. The nebula is soft, so the low resolution
     doesn't show, and this keeps the GPU cost tiny on high-refresh displays. */
  /* The composite pass also draws the film grain and the cursor glow (they used to be two
     extra full-screen DOM layers), and re-projects the nebula by however far it has drifted
     since its last refresh, so it scrolls smoothly at any refresh rate. */
  const nebRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, stencilBuffer: false });
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const compU = {
    tNeb: { value: nebRT.texture }, uBeat: { value: 0 }, uIntro: { value: 1 }, uAspect: { value: 1 },
    uShift: { value: new THREE.Vector2() }, uGrain: { value: 0 }, uPR: { value: 1 },
    uGlowPos: { value: new THREE.Vector2(-9999, -9999) }, uGlow: { value: 0 },
  };
  const compScene = new THREE.Scene();
  compScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: compU,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tNeb; uniform float uBeat, uIntro, uAspect, uGrain, uPR, uGlow;
          uniform vec2 uShift, uGlowPos; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main(){
            vec3 col = texture2D(tNeb, vUv + uShift).rgb;
            vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
            col *= 1.0 + uBeat * 0.35;
            col *= smoothstep(1.45, 0.15, length(uv * vec2(0.85, 1.0)));
            col *= mix(1.0, 0.55, uIntro);
            // cursor glow: same falloff as the old CSS radial-gradient (640px circle)
            float d = length(gl_FragCoord.xy - uGlowPos) / (320.0 * uPR);
            float g = d < 0.35 ? mix(0.075, 0.025, d / 0.35) : mix(0.025, 0.0, clamp((d - 0.35) / 0.33, 0.0, 1.0));
            col = mix(col, vec3(1.0), g * uGlow);
            // film grain, re-rolled 5× a second (5% mix, like the old overlay)
            float n = hash(floor(gl_FragCoord.xy / uPR) + uGrain * 17.13);
            col = col * 0.95 + 0.05 * (0.5 + (n - 0.5) * 0.6);
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    )
  );
  const nebU = {
    uTime: { value: 0 }, uBeat: { value: 0 }, uScroll: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2() }, uIntro: { value: 1 },
  };
  bgScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: nebU,
        depthWrite: false,
        vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uTime, uBeat, uScroll, uIntro; uniform vec2 uRes, uMouse;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float v=0.0, a=0.5; mat2 r=mat2(0.8,0.6,-0.6,0.8);
            for(int i=0;i<4;i++){ v+=a*n(p); p=r*p*2.03+11.7; a*=0.5; } return v; }
          void main(){
            vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
            vec2 p = uv * 1.35 + vec2(uScroll * 0.9, -uScroll * 1.6) + uMouse * 0.04;
            float t = uTime * 0.012;
            vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
            vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + t*1.5), fbm(p + 3.0*q + vec2(8.3, 2.8)));
            float f = fbm(p + 2.6 * r);
            float neb = smoothstep(0.32, 1.05, f);
            float lanes = smoothstep(0.35, 0.75, fbm(p * 3.1 - r));
            vec3 col = vec3(0.022, 0.022, 0.026);
            col += vec3(0.62, 0.62, 0.66) * pow(neb, 2.2) * 0.42 * (0.55 + 0.45 * lanes);
            col += vec3(0.31, 0.89, 1.0) * pow(neb, 4.5) * 0.10;               // faint cyan core
            col += vec3(0.9) * pow(max(0.0, 1.0 - length(uv - vec2(0.55, 0.15)) * 1.1), 3.0) * 0.06; // distant glow
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    )
  );

  /* ---------- world ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050506, 26, 110);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  camera.position.set(0, 0, 40);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8f0ff, 0.5);
  rim.position.set(-6, -3, -4);
  scene.add(rim);

  /* stars */
  const starU = { uTime: { value: 0 }, uBeat: { value: 0 }, uPR: { value: renderer.getPixelRatio() } };
  function starField(count, spread, z0, z1, sizeMin, sizeMax) {
    const pos = new Float32Array(count * 3), size = new Float32Array(count), ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.7;
      pos[i * 3 + 2] = z0 + Math.random() * (z1 - z0);
      size[i] = sizeMin + Math.pow(Math.random(), 3) * (sizeMax - sizeMin);
      ph[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    return new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSize; attribute float aPh; uniform float uTime, uBeat, uPR; varying float vA; varying float vGold;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            float tw = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPh) * 2.2) + aPh);
            // fade stars out right in front of the lens and cap the sprite size, so a star
            // the camera flies past never becomes a huge full-screen quad (fill-rate spike)
            vA = tw * smoothstep(160.0, 20.0, -mv.z) * smoothstep(1.5, 6.0, -mv.z) * (1.0 + uBeat * 0.8);
            vGold = step(0.985, fract(aPh * 7.13));
            gl_PointSize = min(aSize * uPR * (260.0 / -mv.z) * (1.0 + uBeat * 0.35), 36.0 * uPR);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying float vGold;
          void main(){
            vec2 c = gl_PointCoord - 0.5; float d = length(c);
            float core = smoothstep(0.5, 0.0, d); float a = pow(core, 2.4) * vA;
            vec3 col = mix(vec3(0.92, 0.92, 0.96), vec3(0.45, 0.9, 1.0), vGold);
            gl_FragColor = vec4(col, a);
          }`,
      })
    );
  }
  scene.add(starField(small ? 2600 : 5200, 160, 60, -PATH - 120, 0.6, 3.2));
  scene.add(starField(small ? 140 : 260, 120, 40, -PATH - 80, 3.0, 8.0)); // bright ones

  /* hero centerpiece */
  const hero = new THREE.Group();
  scene.add(hero);
  const rig = new THREE.Group();
  hero.add(rig);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.25, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.3, metalness: 0.65, flatShading: true })
  );
  rig.add(core);
  const shellGeo = new THREE.IcosahedronGeometry(2.25, 1);
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34 }));
  rig.add(shell);
  const nodes = new THREE.Points(shellGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.9 }));
  rig.add(nodes);
  // bit cloud: the breathing is done in the vertex shader (no per-frame CPU loop or upload)
  const N = small ? 900 : 1600;
  const cPos = new Float32Array(N * 3), cIdx = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 3.1 + Math.random() * 1.4, s = Math.sqrt(1 - u * u);
    cPos[i * 3] = Math.cos(th) * s * r;
    cPos[i * 3 + 1] = u * r;
    cPos[i * 3 + 2] = Math.sin(th) * s * r;
    cIdx[i] = i;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
  cloudGeo.setAttribute("aIdx", new THREE.BufferAttribute(cIdx, 1));
  const cloudU = { uTime: { value: 0 }, uBeat: { value: 0 }, uScale: { value: 450 } };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aIdx; uniform float uTime, uBeat, uScale;
      void main(){
        float kk = 1.0 + sin(uTime * 0.8 + aIdx * 0.37) * 0.025 + uBeat * 0.12;
        vec4 mv = modelViewMatrix * vec4(position * kk, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.025 + uBeat * 0.02) * uScale / -mv.z;
      }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(0.839, 0.839, 0.855, 0.55); }`,
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  hero.add(cloud);
  const rings = [];
  [
    { r: 3.0, c: 0xffffff, o: 0.5, rx: Math.PI / 2, ry: 0 },
    { r: 3.25, c: 0x4fe3ff, o: 0.8, rx: Math.PI / 3, ry: Math.PI / 5 },
    { r: 3.5, c: 0xffffff, o: 0.22, rx: -Math.PI / 4, ry: Math.PI / 2.5 },
  ].forEach((s) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.012, 8, 220), new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: s.o }));
    m.rotation.set(s.rx, s.ry, 0);
    m.userData.base = s.o;
    rig.add(m);
    rings.push(m);
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshBasicMaterial({ color: 0x4fe3ff }));
  rings[1].add(orb);
  const orb2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rings[0].add(orb2);

  /* drifting polyhedra along the path */
  const shapes = [];
  const geos = [
    () => new THREE.IcosahedronGeometry(1, 0), () => new THREE.OctahedronGeometry(1, 0), () => new THREE.TetrahedronGeometry(1.2, 0),
    () => new THREE.DodecahedronGeometry(1, 0), () => new THREE.TorusKnotGeometry(0.8, 0.22, 80, 8, 2, 3), () => new THREE.BoxGeometry(1.3, 1.3, 1.3),
    () => new THREE.TorusGeometry(1, 0.3, 6, 12),
  ];
  const COUNT = small ? 22 : 38;
  for (let i = 0; i < COUNT; i++) {
    const g = geos[i % geos.length]();
    const gold = i % 9 === 4;
    const mat = new THREE.LineBasicMaterial({ color: gold ? 0x4fe3ff : 0xffffff, transparent: true, opacity: gold ? 0.6 : 0.16 + Math.random() * 0.22 });
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(g), mat);
    const side = i % 2 ? 1 : -1;
    const s = 0.8 + Math.random() * 2.6;
    m.scale.setScalar(s);
    m.position.set(side * (7 + Math.random() * 16), (Math.random() - 0.5) * 18, -10 - (i / COUNT) * PATH - Math.random() * 6);
    m.userData = { rx: (Math.random() - 0.5) * 0.006, ry: (Math.random() - 0.5) * 0.008, fy: Math.random() * 6, base: m.position.y };
    scene.add(m);
    shapes.push(m);
  }

  /* gates: rings you fly through */
  const gates = [];
  for (let i = 0; i < 6; i++) {
    const z = -35 - i * 42;
    const gold = i % 3 === 1;
    const gGroup = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.05, 8, 160), new THREE.MeshBasicMaterial({ color: gold ? 0x4fe3ff : 0xffffff, transparent: true, opacity: 0.35 }));
    const ticks = new THREE.LineSegments(
      (() => {
        const pts = [];
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2, r1 = 9.4, r2 = k % 6 === 0 ? 10.4 : 9.8;
          pts.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        return g;
      })(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    gGroup.add(ring, ticks);
    gGroup.position.set(Math.sin(i * 1.7) * 2.5, Math.cos(i * 1.3) * 1.5, z);
    gGroup.userData = { spin: (i % 2 ? 1 : -1) * 0.002 };
    scene.add(gGroup);
    gates.push(gGroup);
  }

  /* shooting stars */
  const shooters = Array.from({ length: 3 }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    l.userData = { life: 0, v: new THREE.Vector3(), p: new THREE.Vector3() };
    scene.add(l);
    return l;
  });

  /* warp streaks (follow the camera) */
  const WS = small ? 300 : 700;
  const wPos = new Float32Array(WS * 6), wSeed = [];
  for (let i = 0; i < WS; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 26;
    wSeed.push([Math.cos(a) * r, Math.sin(a) * r * 0.7, -Math.random() * 90]);
  }
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
  const wMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const warpLines = new THREE.LineSegments(wGeo, wMat);
  warpLines.frustumCulled = false;
  scene.add(warpLines);

  /* ---------- state ---------- */
  let heroX = 2.9, heroY = 0, heroS = 1;
  function resize() {
    const w = W, h = H;
    renderer.setPixelRatio(targetPR());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const nebScale = Math.min(0.33, Math.sqrt(NEB_BUDGET / (w * h)));
    const rw = Math.max(64, Math.round(w * nebScale)), rh = Math.max(64, Math.round(h * nebScale));
    nebRT.setSize(rw, rh);
    nebU.uRes.value.set(rw, rh);
    compU.uAspect.value = w / h;
    nebDirty = true;
    starU.uPR.value = pr;
    compU.uPR.value = pr;
    gfx.pr = pr;
    onGfx(gfx);
    cloudU.uScale.value = pr * h * 0.5;
    const wide = w > 900;
    heroX = wide ? 3.1 : 0;
    heroS = wide ? 1 : 0.62;
    heroY = wide ? 0 : 1.6;
  }
  const gfx = { refresh: 1 / 60, pr: 1, fps: 0 };
  resize();
  let gxp = W / 2, gyp = H / 2, glowA = 0;

  let warp = 0, warpT = 0;
  let intro = lite ? 0 : 1; // 1 = intro showing, eases to 0 on enter

  const clock = new THREE.Clock();
  let camZ = lite ? 12 : 21, beatS = 0, introK = lite ? 0 : 1, slowAvg = 0, qFrames = 0, refresh = 1 / 60, lastFov = 0;
  let lastFxOff = !!S.fxOff;
  let nebAt = -1, nebOff = new THREE.Vector2(); // when / where the nebula texture was last rendered
  const NEB_INTERVAL = 1 / 50; // refresh the noise ≤ 50×/s; re-projection covers the frames in between

  // Learn the display's refresh interval before drawing anything heavy: a few empty frames
  // run at the true vsync rate (60/120/144/240 Hz), even on a GPU that will struggle later.
  const learn = [];
  function measureRefresh(now) {
    learn.push(now);
    if (learn.length < 24) return raf(measureRefresh);
    const d = [];
    for (let i = 4; i < learn.length; i++) d.push((learn[i] - learn[i - 1]) / 1000);
    d.sort((a, b) => a - b);
    refresh = Math.max(1 / 360, d[Math.floor(d.length * 0.25)] || 1 / 60);
    slowAvg = refresh;
    gfx.refresh = refresh; gfx.pr = renderer.getPixelRatio();
    onGfx(gfx);
    warmUp();
    clock.getDelta();
    frame();
  }

  function frame() {
    raf(frame);
    if (S.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.1);
    fpsN++; fpsAcc += dt;
    if (fpsAcc >= 0.5) { gfx.fps = fpsN / fpsAcc; fpsN = 0; fpsAcc = 0; onGfx(gfx); }
    // adaptive quality: if frames run >30% slower than the refresh interval for a while,
    // drop the render resolution one step (down to ~half). Never steps back up mid-visit,
    // so it can't oscillate.
    qFrames++;
    slowAvg += (dt - slowAvg) * 0.05;
    if (qFrames > 90 && slowAvg > refresh * 1.3 && quality > 0.5) {
      quality = Math.max(0.5, +(quality - 0.15).toFixed(2));
      resize();
      qFrames = 0; slowAvg = refresh;
    }
    const t = clock.elapsedTime;
    const sp = reduce ? 0.15 : 1;
    // per-frame increments below were tuned at 60 fps; f scales them so motion is the same
    // speed at 60, 120 or 240 Hz, and ease(a) is the matching frame-rate-independent lerp
    const f = dt * 60;
    const ease = (a) => 1 - Math.pow(1 - a, f);
    const fxOff = !!S.fxOff;
    if (fxOff !== lastFxOff) { lastFxOff = fxOff; resize(); }
    const beat = S.beat || 0;
    beatS += (beat - beatS) * ease(0.25);
    introK += (intro - introK) * ease(intro ? 0.1 : 0.035);

    // scroll → camera flight (page height and scroll position are cached, see above)
    const k = Math.min(1, Math.max(0, (S.sy || 0) / Math.max(1, S.maxScroll || 1)));
    const tx = S.tx || 0, ty = S.ty || 0;
    const targetZ = 12 - k * PATH + introK * 9;
    camZ += (targetZ - camZ) * (reduce ? 1 : 1 - Math.exp(-dt * 4.5));
    const sway = Math.sin(k * 9) * 1.6;
    camera.position.set(sway + tx * 0.6, Math.cos(k * 7) * 1.1 - ty * 0.4, camZ);
    camera.rotation.set(-ty * 0.04, -tx * 0.06 + Math.sin(t * 0.1) * 0.01, Math.sin(k * 5) * 0.03 + introK * Math.sin(t * 0.3) * 0.02);

    // warp pulse (navigation)
    const we = (performance.now() - warpT) / 1000;
    const wTarget = we < 1.3 ? Math.sin(Math.min(1, we / 1.3) * Math.PI) : 0;
    warp += (wTarget - warp) * ease(0.25);
    const fov = 50 + warp * 28 + beatS * 1.5;
    if (Math.abs(fov - lastFov) > 0.001) { camera.fov = lastFov = fov; camera.updateProjectionMatrix(); }

    // hero (centred behind the intro circle, then slides aside)
    const passed = Math.min(1, Math.max(0, (12 - camZ) / 9)); // 0 at top of page → 1 once the camera flies past
    hero.visible = !lite && passed < 0.999;
    if (hero.visible) {
      hero.position.set(heroX * (1 - introK) + passed * 7, heroY * (1 - introK) + passed * 6, -passed * 4);
      hero.scale.setScalar(heroS * (1 + beatS * 0.09));
      rig.rotation.y += 0.0035 * sp * f;
      rig.rotation.x += (ty * 0.35 - rig.rotation.x) * ease(0.04);
      hero.rotation.y += (tx * 0.5 - hero.rotation.y) * ease(0.04);
      core.rotation.x -= 0.006 * sp * f;
      core.rotation.z += 0.004 * sp * f;
      core.material.emissive.setScalar(beatS * 0.25);
      shell.rotation.y -= 0.0018 * sp * f;
      nodes.rotation.y = shell.rotation.y;
      rings[0].rotation.z += 0.004 * sp * f;
      rings[1].rotation.z -= 0.006 * sp * f;
      rings[2].rotation.z += 0.0025 * sp * f;
      for (const r of rings) r.material.opacity = Math.min(1, r.userData.base * (1 + beatS * 1.2));
      orb.position.set(Math.cos(t * 1.2 * sp) * 3.25, Math.sin(t * 1.2 * sp) * 3.25, 0);
      orb2.position.set(Math.cos(-t * 0.8 * sp) * 3.0, Math.sin(-t * 0.8 * sp) * 3.0, 0);
      cloud.rotation.y -= 0.0008 * sp * f;
      cloudU.uTime.value = t;
      cloudU.uBeat.value = beatS;
    }

    // drifting shapes
    for (const m of shapes) {
      m.rotation.x += m.userData.rx * sp * f;
      m.rotation.y += m.userData.ry * sp * f;
      m.position.y = m.userData.base + Math.sin(t * 0.3 + m.userData.fy) * 0.8;
    }
    const gs = 1 + beatS * 0.05;
    for (const g of gates) {
      g.rotation.z += g.userData.spin * sp * (1 + warp * 8) * f;
      g.scale.set(gs, gs, 1);
    }

    // shooting stars
    for (const s of shooters) {
      const u = s.userData;
      if (u.life <= 0 && !fxOff && Math.random() < 0.004 * f) {
        u.life = 1;
        u.p.set(camera.position.x + (Math.random() - 0.5) * 50, camera.position.y + 8 + Math.random() * 10, camZ - 30 - Math.random() * 30);
        u.v.set(-(12 + Math.random() * 20), -(5 + Math.random() * 8), 0);
      }
      if (u.life > 0) {
        u.life -= dt * 0.9;
        u.p.addScaledVector(u.v, dt);
        const a = s.geometry.attributes.position.array;
        a[0] = u.p.x; a[1] = u.p.y; a[2] = u.p.z;
        a[3] = u.p.x - u.v.x * 0.12; a[4] = u.p.y - u.v.y * 0.12; a[5] = u.p.z;
        s.geometry.attributes.position.needsUpdate = true;
        s.material.opacity = Math.max(0, Math.sin(u.life * Math.PI)) * 0.9;
        s.visible = true;
      } else s.visible = false;
    }

    // warp streaks
    const wl = warp;
    wMat.opacity = Math.min(0.85, wl * 0.9);
    warpLines.visible = wl > 0.01;
    if (warpLines.visible) {
      const len = 2 + wl * 26;
      for (let i = 0; i < WS; i++) {
        const sd = wSeed[i];
        sd[2] += dt * 140 * wl;
        if (sd[2] > 0) sd[2] -= 90;
        const x = camera.position.x + sd[0], y = camera.position.y + sd[1], z = camZ - 4 + sd[2];
        wPos[i * 6] = x; wPos[i * 6 + 1] = y; wPos[i * 6 + 2] = z;
        wPos[i * 6 + 3] = x; wPos[i * 6 + 4] = y; wPos[i * 6 + 5] = z - len;
      }
      wGeo.attributes.position.needsUpdate = true;
    }

    // uniforms
    nebU.uTime.value = t * (reduce ? 0.2 : 1);
    nebU.uBeat.value = beatS;
    nebU.uScroll.value = k;
    nebU.uMouse.value.set(tx, -ty);
    nebU.uIntro.value = introK;
    starU.uTime.value = t;
    starU.uBeat.value = beatS;

    // nebula: noise refreshed ≤ 50×/s; in between, the composite shifts the old texture by
    // the scroll/mouse drift since then (same mapping as the shader: p = uv·1.35 + off)
    const offX = k * 0.9 + tx * 0.04, offY = -k * 1.6 - ty * 0.04;
    if (nebDirty || t - nebAt >= NEB_INTERVAL) {
      renderer.setRenderTarget(nebRT);
      renderer.render(bgScene, bgCam);
      renderer.setRenderTarget(null);
      nebDirty = false;
      nebAt = t;
      nebOff.set(offX, offY);
    }
    compU.uShift.value.set((offX - nebOff.x) / 1.35 / compU.uAspect.value, (offY - nebOff.y) / 1.35);
    compU.uBeat.value = beatS;
    compU.uIntro.value = introK;
    compU.uGrain.value = fxOff ? 0 : Math.floor(t * 5);
    // cursor glow (lags behind the pointer like the old DOM glow)
    const glowOn = !fxOff && S.hasMouse ? 1 : 0;
    const mxp = S.mx ?? W / 2, myp = S.my ?? H / 2;
    glowA += (glowOn - glowA) * ease(0.15);
    gxp += (mxp - gxp) * ease(0.07);
    gyp += (myp - gyp) * ease(0.07);
    const pr = compU.uPR.value;
    compU.uGlowPos.value.set(gxp * pr, (H - gyp) * pr);
    compU.uGlow.value = glowA;

    renderer.clear();
    renderer.render(compScene, bgCam);
    renderer.render(scene, camera);
  }
  // Compile every shader up front (while the intro is showing), including objects that
  // are hidden until later (warp streaks, shooting stars), so nothing stalls mid-scroll.
  function warmUp() {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      renderer.compile(scene, camera);
      renderer.compile(compScene, bgCam);
      renderer.compile(bgScene, bgCam);
    } catch { /* compile is an optimisation only */ }
    hidden.forEach((o) => (o.visible = false));
  }
  let fpsN = 0, fpsAcc = 0;

  raf(measureRefresh);
  return {
    resize(w, h, dpr) { W = w; H = h; if (dpr) DPR = dpr; resize(); },
    warp() { warpT = performance.now(); },
    enter() { intro = 0; warpT = performance.now(); },
  };
}
