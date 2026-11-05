/* =====================================================================
   scene.js — hero 3D: faceted core, wireframe shell, bit-cloud, gyroscope rings
   reacts to mouse, scroll and the music's beat (window.__beat)
   ===================================================================== */
import * as THREE from "../vendor/three.module.min.js";

const host = document.getElementById("three");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return; // no WebGL — the page works fine without it
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0b, 8, 18);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const world = new THREE.Group();
  scene.add(world);
  const rig = new THREE.Group();
  world.add(rig);

  // lights (grayscale)
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, -3, -4);
  scene.add(rim);

  // faceted core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.25, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.35, metalness: 0.6, flatShading: true })
  );
  rig.add(core);

  // wireframe shell
  const shellGeo = new THREE.IcosahedronGeometry(2.25, 1);
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 })
  );
  rig.add(shell);
  // vertices of the shell as nodes
  const nodes = new THREE.Points(
    shellGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.9, sizeAttenuation: true })
  );
  rig.add(nodes);

  // bit cloud
  const N = 1600;
  const pos = new Float32Array(N * 3);
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const r = 3.1 + Math.random() * 1.4;
    const s = Math.sqrt(1 - u * u);
    base[i * 3] = pos[i * 3] = Math.cos(th) * s * r;
    base[i * 3 + 1] = pos[i * 3 + 1] = u * r;
    base[i * 3 + 2] = pos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const cloudMat = new THREE.PointsMaterial({ color: 0xd6d6da, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  world.add(cloud);

  // gyroscope rings (one yellow accent)
  const rings = [];
  const ringSpec = [
    { r: 3.0, c: 0xffffff, o: 0.5, rx: Math.PI / 2, ry: 0 },
    { r: 3.25, c: 0xffd166, o: 0.75, rx: Math.PI / 3, ry: Math.PI / 5 },
    { r: 3.5, c: 0xffffff, o: 0.22, rx: -Math.PI / 4, ry: Math.PI / 2.5 },
  ];
  for (const s of ringSpec) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(s.r, 0.012, 8, 220), new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: s.o }));
    m.rotation.set(s.rx, s.ry, 0);
    m.userData.base = s.o;
    rig.add(m);
    rings.push(m);
  }
  // orbiting "electron" on the accent ring
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  rings[1].add(orb);
  const orb2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rings[0].add(orb2);

  // layout
  let baseX = 0, baseY = 0, baseS = 1;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w > 900;
    baseX = wide ? 2.9 : 0;
    baseY = wide ? 0 : 1.2;
    baseS = wide ? 1 : 0.72;
    host.style.opacity = wide ? "1" : "0.55";
  }
  addEventListener("resize", resize);
  resize();

  // input
  let tx = 0, ty = 0;
  addEventListener("pointermove", (e) => {
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);

  const clock = new THREE.Clock();
  let beatS = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    const sp = reduce ? 0.2 : 1;
    const beat = window.__beat || 0;
    beatS += (beat - beatS) * 0.25;

    const scrollK = Math.min(1, scrollY / innerHeight);
    world.position.set(baseX, baseY + scrollK * 2.2, -scrollK * 2);
    world.scale.setScalar(baseS * (1 + beatS * 0.09));

    rig.rotation.y += 0.0035 * sp;
    rig.rotation.x += (ty * 0.35 - rig.rotation.x) * 0.04;
    world.rotation.y += (tx * 0.5 - world.rotation.y) * 0.04;

    core.rotation.x -= 0.006 * sp;
    core.rotation.z += 0.004 * sp;
    shell.rotation.y -= 0.0018 * sp;
    nodes.rotation.y = shell.rotation.y;

    rings[0].rotation.z += 0.004 * sp;
    rings[1].rotation.z -= 0.006 * sp;
    rings[2].rotation.z += 0.0025 * sp;
    rings.forEach((r) => (r.material.opacity = Math.min(1, r.userData.base * (1 + beatS * 1.2))));
    orb.position.set(Math.cos(t * 1.2 * sp) * 3.25, Math.sin(t * 1.2 * sp) * 3.25, 0);
    orb2.position.set(Math.cos(-t * 0.8 * sp) * 3.0, Math.sin(-t * 0.8 * sp) * 3.0, 0);

    // breathing bit cloud
    const arr = cloudGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const k = 1 + Math.sin(t * 0.8 + i * 0.37) * 0.025 + beatS * 0.12;
      arr[i * 3] = base[i * 3] * k;
      arr[i * 3 + 1] = base[i * 3 + 1] * k;
      arr[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    cloudGeo.attributes.position.needsUpdate = true;
    cloud.rotation.y -= 0.0008 * sp;
    cloudMat.size = 0.025 + beatS * 0.02;
    core.material.emissive.setScalar(beatS * 0.25);

    host.style.transform = `translateY(${scrollY * 0.25}px)`;
    renderer.render(scene, camera);
  }
  frame();
}

if (host) init();
