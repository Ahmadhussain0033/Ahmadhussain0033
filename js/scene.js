/* =====================================================================
   scene.js — the whole-page space you fly through
   • domain-warped grayscale nebula (full-screen shader)
   • twinkling star field along the flight path
   • hero centerpiece: faceted core + wireframe shell + bit cloud + gyroscope
   • drifting wireframe polyhedra + "gate" rings you fly through on scroll
   • shooting stars, warp streaks on navigation, beat-reactive everything
   ===================================================================== */
import * as THREE from "../vendor/three.module.min.js";

const host = document.getElementById("space");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = Math.min(innerWidth, innerHeight) < 700;

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: false, powerPreference: "high-performance" });
  } catch {
    document.body.classList.add("no-webgl");
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.autoClear = false;
  host.appendChild(renderer.domElement);

  const PATH = 260; // world units travelled from top to bottom of the page
  let nebDirty = true;

  /* ---------- nebula (screen-space) ----------
     The expensive noise pass renders into a small off-screen texture (NEB_SCALE of the
     screen) and only every other frame; a cheap pass upscales it and applies beat,
     vignette and intro dimming every frame. The nebula is soft, so the low resolution
     doesn't show, and this keeps the GPU cost tiny on high-refresh displays. */
  const NEB_SCALE = 0.33;
  const nebRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, stencilBuffer: false });
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const compU = { tNeb: { value: nebRT.texture }, uBeat: { value: 0 }, uIntro: { value: 1 }, uAspect: { value: 1 } };
  const compScene = new THREE.Scene();
  compScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: compU,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tNeb; uniform float uBeat, uIntro, uAspect; varying vec2 vUv;
          void main(){
            vec3 col = texture2D(tNeb, vUv).rgb;
            vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
            col *= 1.0 + uBeat * 0.35;
            col *= smoothstep(1.45, 0.15, length(uv * vec2(0.85, 1.0)));
            col *= mix(1.0, 0.55, uIntro);
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
            vA = tw * smoothstep(160.0, 20.0, -mv.z) * (1.0 + uBeat * 0.8);
            vGold = step(0.985, fract(aPh * 7.13));
            gl_PointSize = aSize * uPR * (260.0 / -mv.z) * (1.0 + uBeat * 0.35);
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
  const N = small ? 900 : 1600;
  const cPos = new Float32Array(N * 3), cBase = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 3.1 + Math.random() * 1.4, s = Math.sqrt(1 - u * u);
    cBase[i * 3] = cPos[i * 3] = Math.cos(th) * s * r;
    cBase[i * 3 + 1] = cPos[i * 3 + 1] = u * r;
    cBase[i * 3 + 2] = cPos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
  const cloudMat = new THREE.PointsMaterial({ color: 0xd6d6da, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false });
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
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const rw = Math.max(64, Math.round(w * NEB_SCALE)), rh = Math.max(64, Math.round(h * NEB_SCALE));
    nebRT.setSize(rw, rh);
    nebU.uRes.value.set(rw, rh);
    compU.uAspect.value = w / h;
    nebDirty = true;
    starU.uPR.value = pr;
    const wide = w > 900;
    heroX = wide ? 3.1 : 0;
    heroS = wide ? 1 : 0.62;
    heroY = wide ? 0 : 1.6;
  }
  addEventListener("resize", resize);
  resize();

  let tx = 0, ty = 0;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  let warp = 0, warpT = 0;
  window.__warp = () => { warpT = performance.now(); };
  let intro = 1; // 1 = intro showing, eases to 0 on enter
  window.__sceneEnter = () => { intro = 0; warpT = performance.now(); };

  const clock = new THREE.Clock();
  let camZ = 21, beatS = 0, introK = 1, slowAvg = 0.016, qFrames = 0, refresh = 1 / 60, nebFrame = 0;
  const refreshSamples = [];

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    // adaptive quality: if frames are slow, render at a lower resolution
    // adaptive quality, relative to this display's refresh rate (60/120/144 Hz…):
    // learn the frame interval first, then step resolution down if frames start dropping.
    qFrames++;
    if (qFrames <= 60) { if (qFrames > 10) refreshSamples.push(dt); if (qFrames === 60) { refreshSamples.sort((a, b) => a - b); refresh = refreshSamples[refreshSamples.length >> 1] || 1 / 60; } }
    else {
      slowAvg += (dt - slowAvg) * 0.05;
      if (qFrames > 150 && slowAvg > refresh * 1.3 && renderer.getPixelRatio() > 0.75) {
        renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() - 0.25));
        resize();
        qFrames = 61; slowAvg = refresh;
      }
    }
    const t = clock.elapsedTime;
    const sp = reduce ? 0.15 : 1;
    const fxOff = document.body.classList.contains("fx-off");
    const beat = window.__beat || 0;
    beatS += (beat - beatS) * 0.25;
    introK += (intro - introK) * (intro ? 0.1 : 0.035);

    // scroll → camera flight
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const k = Math.min(1, Math.max(0, scrollY / max));
    const targetZ = 12 - k * PATH + introK * 9;
    camZ += (targetZ - camZ) * (reduce ? 1 : 1 - Math.exp(-dt * 4.5));
    const sway = Math.sin(k * 9) * 1.6;
    camera.position.set(sway + tx * 0.6, Math.cos(k * 7) * 1.1 - ty * 0.4, camZ);
    camera.rotation.set(-ty * 0.04, -tx * 0.06 + Math.sin(t * 0.1) * 0.01, Math.sin(k * 5) * 0.03 + introK * Math.sin(t * 0.3) * 0.02);

    // warp pulse (navigation)
    const we = (performance.now() - warpT) / 1000;
    const wTarget = we < 1.3 ? Math.sin(Math.min(1, we / 1.3) * Math.PI) : 0;
    warp += (wTarget - warp) * 0.25;
    camera.fov = 50 + warp * 28 + beatS * 1.5;
    camera.updateProjectionMatrix();

    // hero (centred behind the intro circle, then slides aside)
    const passed = Math.min(1, Math.max(0, (12 - camZ) / 9)); // 0 at top of page → 1 once the camera flies past
    hero.position.set(heroX * (1 - introK) + passed * 7, heroY * (1 - introK) + passed * 6, -passed * 4);
    hero.visible = passed < 0.999;
    hero.scale.setScalar(heroS * (1 + beatS * 0.09));
    rig.rotation.y += 0.0035 * sp;
    rig.rotation.x += (ty * 0.35 - rig.rotation.x) * 0.04;
    hero.rotation.y += (tx * 0.5 - hero.rotation.y) * 0.04;
    core.rotation.x -= 0.006 * sp;
    core.rotation.z += 0.004 * sp;
    core.material.emissive.setScalar(beatS * 0.25);
    shell.rotation.y -= 0.0018 * sp;
    nodes.rotation.y = shell.rotation.y;
    rings[0].rotation.z += 0.004 * sp;
    rings[1].rotation.z -= 0.006 * sp;
    rings[2].rotation.z += 0.0025 * sp;
    rings.forEach((r) => (r.material.opacity = Math.min(1, r.userData.base * (1 + beatS * 1.2))));
    orb.position.set(Math.cos(t * 1.2 * sp) * 3.25, Math.sin(t * 1.2 * sp) * 3.25, 0);
    orb2.position.set(Math.cos(-t * 0.8 * sp) * 3.0, Math.sin(-t * 0.8 * sp) * 3.0, 0);
    if (Math.abs(camZ) < 60) {
      const arr = cloudGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const kk = 1 + Math.sin(t * 0.8 + i * 0.37) * 0.025 + beatS * 0.12;
        arr[i * 3] = cBase[i * 3] * kk; arr[i * 3 + 1] = cBase[i * 3 + 1] * kk; arr[i * 3 + 2] = cBase[i * 3 + 2] * kk;
      }
      cloudGeo.attributes.position.needsUpdate = true;
    }
    cloud.rotation.y -= 0.0008 * sp;
    cloudMat.size = 0.025 + beatS * 0.02;

    // drifting shapes
    for (const m of shapes) {
      m.rotation.x += m.userData.rx * sp;
      m.rotation.y += m.userData.ry * sp;
      m.position.y = m.userData.base + Math.sin(t * 0.3 + m.userData.fy) * 0.8;
    }
    for (const g of gates) {
      g.rotation.z += g.userData.spin * sp * (1 + warp * 8);
      const s = 1 + beatS * 0.05;
      g.scale.set(s, s, 1);
    }

    // shooting stars
    for (const s of shooters) {
      const u = s.userData;
      if (u.life <= 0 && !fxOff && Math.random() < 0.004) {
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
      } else s.material.opacity = 0;
    }

    // warp streaks
    const wl = warp;
    wMat.opacity = Math.min(0.85, wl * 0.9);
    if (wl > 0.01) {
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

    if (nebDirty || (nebFrame++ & 1) === 0) {
      renderer.setRenderTarget(nebRT);
      renderer.render(bgScene, bgCam);
      renderer.setRenderTarget(null);
      nebDirty = false;
    }
    compU.uBeat.value = beatS;
    compU.uIntro.value = introK;
    renderer.clear();
    renderer.render(compScene, bgCam);
    renderer.render(scene, camera);
  }
  frame();
}

if (host) init();
