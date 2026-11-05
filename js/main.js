/* =====================================================================
   main.js — cursor · fx · audio · palette · navigation · renderers
   content comes from js/config.js (window.SITE)
   ===================================================================== */
(() => {
  "use strict";

  const C = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const body = document.body;
  const root = document.documentElement;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const has = (v) => (typeof v === "string" ? v.trim() !== "" : v != null && v !== false);
  const todo = (label = "todo") => (C.showTodos === false ? "" : `<span class="todo">${esc(label)}</span>`);
  const or = (v, label) => (has(v) ? esc(v) : todo(label));
  const safeUrl = (u) => (/^(https?:|mailto:)/i.test(String(u || "").trim()) ? String(u).trim() : "");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const store = {
    get(k, d) { try { const v = localStorage.getItem("ah:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("ah:" + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  let fxOn = store.get("fx", true) && !reduceMotion;

  const ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s)) return "";
    const u = [[31536000, "y"], [2592000, "mo"], [604800, "w"], [86400, "d"], [3600, "h"], [60, "m"]];
    for (const [n, l] of u) if (s >= n) return Math.floor(s / n) + l + " ago";
    return "just now";
  };

  /* ---------------- toast ---------------- */
  const toastEl = $("#toast");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }
  async function copy(text, label) {
    if (!has(text)) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement("textarea");
      t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      t.remove();
    }
    toast(`copied ${label || text}`);
  }

  /* ---------------- scramble / decode text ---------------- */
  const GLYPHS = "01<>/\\|#%&*+=~^?!abcdefghijkmnopqrstuvwxyz";
  const rg = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  function scramble(el, text, { dur = 900, from = "" } = {}) {
    const token = (el._scr = {});
    const target = Array.from(text);
    const start = Array.from(from);
    const len = Math.max(target.length, start.length);
    const times = Array.from({ length: len }, (_, i) => (i / Math.max(1, len)) * dur * 0.65 + Math.random() * dur * 0.35);
    const t0 = performance.now();
    if (reduceMotion) { el.textContent = text; return Promise.resolve(); }
    return new Promise((res) => {
      const tick = (now) => {
        if (el._scr !== token) return res();
        const e = now - t0;
        let out = "";
        let done = true;
        for (let i = 0; i < len; i++) {
          const ch = target[i];
          if (e >= times[i]) { if (ch !== undefined) out += esc(ch); }
          else {
            done = false;
            if (ch === " " || (ch === undefined && start[i] === " ")) out += " ";
            else if (ch === undefined && e > times[i] * 0.6) out += "";
            else out += `<span class="g">${esc(rg())}</span>`;
          }
        }
        el.innerHTML = out;
        if (!done) requestAnimationFrame(tick);
        else { el.textContent = text; res(); }
      };
      requestAnimationFrame(tick);
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- sections + rail ---------------- */
  const sections = $$("main > section");
  const rail = $("#rail");
  sections.forEach((s) => {
    const { num, file, title } = s.dataset;
    rail.insertAdjacentHTML("beforeend", `<a href="#${s.id}" data-nav data-label="${esc(title)}">${esc(num)}</a>`);
    if (s.id === "home") return;
    s.insertAdjacentHTML(
      "afterbegin",
      `<header class="sec-head" data-reveal>
        <span class="sec-ghost" aria-hidden="true">${esc(num)}</span>
        <div class="sec-tab"><span class="dim">●</span><b>${esc(file)}</b><span class="x">×</span></div>
        <h2 class="sec-title"><span class="h-mark">##</span><span class="tt">${esc(title)}</span></h2>
      </header>`
    );
  });
  const railLinks = $$("a", rail);

  /* ---------------- reveal ---------------- */
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target;
        el.classList.add("in");
        io.unobserve(el);
        const tt = el.matches(".sec-head") && $(".tt", el);
        if (tt && !tt._done) { tt._done = true; scramble(tt, tt.textContent, { dur: 800 }); }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  function reveal(scope = document) {
    $$("[data-reveal]:not(.in)", scope).forEach((el) => {
      if (el._obs) return;
      el._obs = true;
      const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute("data-reveal"));
      el.style.setProperty("--i", Math.min(sibs.indexOf(el), 8));
      io.observe(el);
    });
  }

  /* ---------------- navigation + wipe ---------------- */
  const wipe = $("#wipe");
  let navigating = false;
  function go(id) {
    const target = document.getElementById(id);
    if (!target || navigating) return;
    history.replaceState(null, "", id === "home" ? location.pathname : "#" + id);
    if (!fxOn || reduceMotion) { target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); return; }
    navigating = true;
    wipe.className = "in";
    setTimeout(() => {
      root.style.scrollBehavior = "auto";
      target.scrollIntoView();
      root.style.scrollBehavior = "";
      wipe.className = "out";
      setTimeout(() => { wipe.className = ""; navigating = false; }, 700);
    }, 600);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute("href").slice(1));
  });

  /* ---------------- scroll HUD ---------------- */
  const hp = $("#hp"), hudFile = $("#hudFile"), hudNum = $("#hudNum");
  let activeIdx = -1;
  function onScroll() {
    const max = root.scrollHeight - innerHeight;
    hp.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    let idx = 0;
    const line = innerHeight * 0.4;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    if (idx !== activeIdx) {
      activeIdx = idx;
      railLinks.forEach((a, i) => a.classList.toggle("active", i === idx));
      hudFile.textContent = sections[idx].dataset.file;
      hudNum.textContent = sections[idx].dataset.num;
    }
  }
  let scrollQueued = false;
  addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; onScroll(); });
  }, { passive: true });

  /* ---------------- fx toggle ---------------- */
  const fxBtn = $("#fxToggle");
  function applyFx() {
    body.classList.toggle("fx-on", fxOn);
    body.classList.toggle("fx-off", !fxOn);
    fxBtn.textContent = "effects: " + (fxOn ? "on" : "off");
  }
  function toggleFx() { fxOn = !fxOn; store.set("fx", fxOn); applyFx(); toast("effects " + (fxOn ? "on" : "off")); }
  fxBtn.addEventListener("click", toggleFx);
  applyFx();

  /* ---------------- cursor + glow ---------------- */
  const dot = $("#cur-dot"), ring = $("#cur-ring"), glow = $("#glow");
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, gx = mx, gy = my;
  const trail = [];
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX; my = e.clientY;
    if (!body.classList.contains("has-mouse")) { body.classList.add("has-mouse"); rx = gx = mx; ry = gy = my; }
    if (fxOn) trail.push({ x: mx, y: my, t: performance.now() });
  }, { passive: true });
  document.addEventListener("mouseleave", () => body.classList.remove("has-mouse"));
  document.addEventListener("pointerover", (e) => {
    const t = e.target;
    const isText = t.closest && t.closest("input[type=text],input[type=email],textarea");
    const isHover = t.closest && t.closest("a,button,label,[data-hover],input[type=range],.sphere-wrap,summary");
    ring.classList.toggle("text", !!isText);
    ring.classList.toggle("hover", !isText && !!isHover);
  });
  addEventListener("pointerdown", () => ring.classList.add("down"));
  addEventListener("pointerup", () => ring.classList.remove("down"));

  /* ---------------- fx canvas: trail + click bursts ---------------- */
  const fx = $("#fx"), fctx = fx.getContext("2d");
  const tri = $("#triangles"), tctx = tri.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  function resize() {
    W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
    fx.width = W * DPR; fx.height = H * DPR; fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tri.width = W; tri.height = H;
    seedTriangles();
  }
  const bursts = [];
  const comboEl = $("#combo"), comboN = $("#comboN");
  let combo = 0, comboT;
  function judge() {
    const b = window.__beat || 0;
    const r = Math.random();
    if (r < 0.025) return "miss";
    if (isPlaying()) return b > 0.5 ? "300" : b > 0.22 ? "100" : "50";
    return r < 0.75 ? "300" : r < 0.94 ? "100" : "50";
  }
  function hit(x, y, forced) {
    if (!fxOn) return;
    const j = forced || judge();
    bursts.push({ x, y, t: performance.now(), j, parts: Array.from({ length: 10 }, () => ({ a: Math.random() * Math.PI * 2, v: 40 + Math.random() * 70 })) });
    if (j === "miss") { combo = 0; comboEl.classList.add("broke"); comboN.textContent = "0"; }
    else { combo++; comboEl.classList.remove("broke"); comboN.textContent = combo; }
    comboEl.classList.add("show");
    comboEl.classList.remove("pop"); void comboEl.offsetWidth; comboEl.classList.add("pop");
    clearTimeout(comboT);
    comboT = setTimeout(() => comboEl.classList.remove("show"), 2600);
  }
  addEventListener("pointerdown", (e) => { if (!body.classList.contains("is-intro")) hit(e.clientX, e.clientY); });

  const JC = { 300: "#6ee7a0", 100: "#ffd166", 50: "#d6d6da", miss: "#ff5d73" };
  function drawFx(now) {
    fctx.clearRect(0, 0, W, H);
    if (!fxOn) { trail.length = 0; bursts.length = 0; return; }
    // trail
    while (trail.length && now - trail[0].t > 260) trail.shift();
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i], k = 1 - (now - p.t) / 260;
      fctx.beginPath();
      fctx.arc(p.x, p.y, 1 + k * 3.2, 0, Math.PI * 2);
      fctx.fillStyle = `rgba(255,255,255,${k * 0.35})`;
      fctx.fill();
    }
    // bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], e = (now - b.t) / 1000;
      if (e > 0.8) { bursts.splice(i, 1); continue; }
      const k = clamp(e / 0.5, 0, 1), ease = 1 - Math.pow(1 - k, 3);
      const col = JC[b.j];
      if (b.j !== "miss") {
        fctx.beginPath();
        fctx.arc(b.x, b.y, 12 + ease * 52, 0, Math.PI * 2);
        fctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.9})`;
        fctx.lineWidth = 4 * (1 - k) + 0.5;
        fctx.stroke();
        if (e < 0.12) {
          fctx.beginPath(); fctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
          fctx.fillStyle = `rgba(255,255,255,${0.5 - e * 4})`; fctx.fill();
        }
        for (const p of b.parts) {
          const d = 14 + ease * p.v;
          fctx.beginPath();
          fctx.moveTo(b.x + Math.cos(p.a) * d, b.y + Math.sin(p.a) * d);
          fctx.lineTo(b.x + Math.cos(p.a) * (d + 6), b.y + Math.sin(p.a) * (d + 6));
          fctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.8})`;
          fctx.lineWidth = 1.5; fctx.stroke();
        }
      }
      const tk = clamp(e / 0.8, 0, 1);
      fctx.globalAlpha = 1 - tk * tk;
      fctx.font = `800 ${b.j === "miss" ? 26 : 20}px Outfit, sans-serif`;
      fctx.textAlign = "center";
      fctx.fillStyle = col;
      fctx.fillText(b.j === "miss" ? "×" : b.j, b.x, b.y - 30 - tk * 22);
      fctx.globalAlpha = 1;
    }
  }

  /* ---------------- triangles background ---------------- */
  let tris = [];
  function seedTriangles() {
    const n = Math.round(clamp((W * H) / 22000, 24, 90));
    tris = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, s: 20 + Math.random() * 120,
      v: 0.15 + Math.random() * 0.5, g: 30 + Math.random() * 60, a: 0.03 + Math.random() * 0.07, z: 0.2 + Math.random() * 0.8,
      o: Math.random() < 0.3,
    }));
  }
  function drawTriangles() {
    const b = window.__beat || 0;
    tctx.clearRect(0, 0, W, H);
    const par = scrollY * 0.06;
    for (const t of tris) {
      if (fxOn) t.y -= t.v * (1 + b * 3) * t.z;
      if (t.y < -t.s * 1.2) { t.y = H + t.s; t.x = Math.random() * W; }
      const y = ((t.y - par * t.z) % (H + t.s * 2) + H + t.s * 2) % (H + t.s * 2) - t.s;
      const h = t.s * 0.866;
      tctx.beginPath();
      tctx.moveTo(t.x, y - h / 2);
      tctx.lineTo(t.x - t.s / 2, y + h / 2);
      tctx.lineTo(t.x + t.s / 2, y + h / 2);
      tctx.closePath();
      const a = t.a * (1 + b * 1.4);
      if (t.o) { tctx.strokeStyle = `rgba(255,255,255,${a * 1.4})`; tctx.lineWidth = 1; tctx.stroke(); }
      else { tctx.fillStyle = `rgba(${t.g},${t.g},${t.g + 4},${a * 4})`; tctx.fill(); }
    }
  }

  /* ---------------- audio ---------------- */
  const M = C.music || {};
  const audio = $("#audio"), player = $("#player");
  const pPlay = $("#pPlay"), pVol = $("#pVol");
  $("#pTitle").textContent = M.title || "—";
  $("#pArtist").textContent = M.artist || "";
  $("#npTitle").textContent = M.title || "—";
  $("#npArtist").textContent = M.artist || "";
  audio.src = M.src || "";
  audio.volume = clamp(store.get("vol", M.volume ?? 0.45), 0, 1);
  pVol.value = audio.volume;
  let actx, analyser, freq;
  function ensureGraph() {
    if (actx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser); analyser.connect(actx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
    } catch { /* visualiser unavailable, audio still plays */ }
  }
  const isPlaying = () => !audio.paused && !audio.ended;
  let resumeAt = store.get("t", 0);
  audio.addEventListener("loadedmetadata", () => {
    if (resumeAt > 0 && resumeAt < audio.duration - 2) audio.currentTime = resumeAt;
    $("#npDur").textContent = fmt(audio.duration);
  });
  function play() {
    ensureGraph();
    if (actx && actx.state === "suspended") actx.resume();
    return audio.play().then(() => store.set("playing", true)).catch(() => toast("tap the disc to start music"));
  }
  function pause() { audio.pause(); store.set("playing", false); }
  function toggleMusic() { isPlaying() ? pause() : play(); }
  function syncPlayer() {
    const p = isPlaying();
    player.classList.toggle("playing", p);
    body.classList.toggle("playing-all", p);
    pPlay.setAttribute("aria-label", p ? "Pause music" : "Play music");
    $("#npState").textContent = p ? "now playing" : "paused";
  }
  audio.addEventListener("play", syncPlayer);
  audio.addEventListener("pause", syncPlayer);
  pPlay.addEventListener("click", toggleMusic);
  $("#npDisc").addEventListener("click", toggleMusic);
  pVol.addEventListener("input", () => { audio.volume = +pVol.value; store.set("vol", audio.volume); });
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
  let lastSave = 0;
  audio.addEventListener("timeupdate", () => {
    $("#npCur").textContent = fmt(audio.currentTime);
    $("#npFill").style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + "%";
    if (Date.now() - lastSave > 2000) { lastSave = Date.now(); store.set("t", audio.currentTime); }
  });
  $("#npTrack").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  if ("mediaSession" in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: M.title || "", artist: M.artist || "", album: (C.name || "") + " — site soundtrack" });
    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", pause);
  }

  const pBars = $$("#pViz i");
  const npViz = $("#npViz"), nctx = npViz.getContext("2d");
  let beatS = 0, npVisible = false;
  new IntersectionObserver(([e]) => (npVisible = e.isIntersecting)).observe(npViz);
  function audioFrame() {
    let bass = 0;
    if (analyser && isPlaying()) {
      analyser.getByteFrequencyData(freq);
      for (let i = 0; i < 8; i++) bass += freq[i];
      bass /= 8 * 255;
      pBars.forEach((b, i) => (b.style.height = 3 + (freq[2 + i * 9] / 255) * 15 + "px"));
    } else if (!isPlaying()) pBars.forEach((b) => (b.style.height = "3px"));
    const target = clamp((bass - 0.5) / 0.4, 0, 1);
    beatS += (target - beatS) * (target > beatS ? 0.5 : 0.08);
    window.__beat = beatS;
    root.style.setProperty("--beat", beatS.toFixed(3));
    if (npVisible) drawNp();
  }
  function drawNp() {
    const w = (npViz.width = npViz.clientWidth * DPR), h = npViz.height = 90 * DPR;
    nctx.clearRect(0, 0, w, h);
    const n = 64, bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = freq && isPlaying() ? freq[Math.floor(i * 1.6)] / 255 : 0.03 + 0.02 * Math.sin(performance.now() / 600 + i / 3);
      const bh = Math.max(2 * DPR, v * h * 0.95);
      const g = 120 + v * 135;
      nctx.fillStyle = `rgb(${g},${g},${g + 2})`;
      nctx.fillRect(i * bw + 1, h - bh, bw - 2 * DPR, bh);
    }
  }

  /* ---------------- main loop ---------------- */
  function loop(now) {
    // cursor
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
    gx += (mx - gx) * 0.07; gy += (my - gy) * 0.07;
    dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    if (fxOn) glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
    audioFrame();
    drawTriangles();
    drawFx(now);
    requestAnimationFrame(loop);
  }

  /* ---------------- palette ---------------- */
  const pal = $("#palette"), palInput = $("#palInput"), palList = $("#palList");
  const actions = [
    { t: "play / pause music", f: "m", run: toggleMusic },
    { t: "toggle effects", f: "fx", run: toggleFx },
    { t: "copy email", f: "email", run: () => (has(C.email) ? copy(C.email, "email") : toast("email not set yet")) },
    { t: "copy discord username", f: "discord", run: () => copy(C.discord?.username, "discord username") },
    { t: "open github", f: "↗", run: () => window.open(`https://github.com/${C.github}`, "_blank", "noopener") },
    { t: "back to top", f: "~", run: () => go("home") },
  ];
  let palItems = [], palSel = 0, lastFocus;
  function fuzzy(q, s) {
    q = q.toLowerCase(); s = s.toLowerCase();
    if (!q) return 1;
    if (s.includes(q)) return 100 - s.indexOf(q);
    let i = 0, score = 0;
    for (const ch of s) { if (ch === q[i]) { i++; score++; } if (i === q.length) return score; }
    return 0;
  }
  function renderPal() {
    const q = palInput.value.trim();
    const secs = sections.map((s) => ({ kind: "section", n: s.dataset.num, t: s.dataset.title, f: s.dataset.file, run: () => go(s.id) }));
    const acts = actions.map((a) => ({ kind: "action", n: "›", ...a }));
    const score = (it) => Math.max(fuzzy(q, it.t), fuzzy(q, it.f), fuzzy(q, it.n));
    const fs = secs.filter((it) => score(it) > 0), fa = acts.filter((it) => score(it) > 0);
    if (q) { fs.sort((a, b) => score(b) - score(a)); fa.sort((a, b) => score(b) - score(a)); }
    palItems = [...fs, ...fa];
    palSel = clamp(palSel, 0, Math.max(0, palItems.length - 1));
    let html = "", idx = 0;
    const row = (it) => `<li role="option" data-i="${idx}" class="${idx++ === palSel ? "sel" : ""}" aria-selected="${idx - 1 === palSel}"><span class="n">${esc(it.n)}</span><span class="t">${esc(it.t)}</span><span class="f">${esc(it.f)}</span></li>`;
    if (fs.length) html += `<li class="grp" aria-hidden="true">sections</li>` + fs.map(row).join("");
    if (fa.length) html += `<li class="grp" aria-hidden="true">actions</li>` + fa.map(row).join("");
    palList.innerHTML = html || `<li class="empty">no match for "${esc(q)}"</li>`;
    const sel = $("li.sel", palList);
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function openPal() {
    if (body.classList.contains("is-intro")) return;
    lastFocus = document.activeElement;
    pal.hidden = false; palInput.value = ""; palSel = 0; renderPal(); palInput.focus();
  }
  function closePal() { pal.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  function runPal(i) { const it = palItems[i]; if (!it) return; closePal(); it.run(); }
  palInput.addEventListener("input", () => { palSel = 0; renderPal(); });
  palInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = (palSel + 1) % Math.max(1, palItems.length); renderPal(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = (palSel - 1 + palItems.length) % Math.max(1, palItems.length); renderPal(); }
    else if (e.key === "Enter") { e.preventDefault(); runPal(palSel); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  palList.addEventListener("mousemove", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li && +li.dataset.i !== palSel) { palSel = +li.dataset.i; $$("li[data-i]", palList).forEach((l) => l.classList.toggle("sel", +l.dataset.i === palSel)); }
  });
  palList.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) runPal(+li.dataset.i); });
  pal.addEventListener("click", (e) => { if (e.target === pal) closePal(); });
  $("#slashBtn").addEventListener("click", openPal);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-open-palette]")) openPal(); });

  /* ---------------- keyboard ---------------- */
  const editable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener("keydown", (e) => {
    if (body.classList.contains("is-intro")) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(true); }
      return;
    }
    if (!pal.hidden) { if (e.key === "Escape") { e.preventDefault(); closePal(); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPal(); return; }
    if (editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); openPal(); }
    else if (e.key === "m" || e.key === "M") toggleMusic();
    else if (e.key === "j") go(sections[Math.min(activeIdx + 1, sections.length - 1)].id);
    else if (e.key === "k") go(sections[Math.max(activeIdx - 1, 0)].id);
  });

  /* ---------------- intro ---------------- */
  const intro = $("#intro");
  let entered = false;
  function enter(withSound) {
    if (entered) return;
    entered = true;
    const c = $("#introGo").getBoundingClientRect();
    intro.style.setProperty("--cx", c.left + c.width / 2 + "px");
    intro.style.setProperty("--cy", c.top + c.height / 2 + "px");
    if (withSound) play();
    intro.classList.add("burst");
    hit(c.left + c.width / 2, c.top + c.height / 2, "300");
    setTimeout(() => intro.classList.add("gone"), 180);
    setTimeout(() => {
      intro.classList.add("hidden");
      body.classList.remove("is-intro");
      startHero();
      if (location.hash.length > 1) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }, 1150);
  }
  $("#introGo").addEventListener("click", () => enter(true));
  $("#introSilent").addEventListener("click", () => enter(false));
  (async () => {
    const nameEl = $("#introName"), pct = $("#introPct");
    const t0 = performance.now();
    const p = () => { const k = clamp((performance.now() - t0) / 1600, 0, 1); pct.textContent = Math.round(k * 100) + "%"; if (k < 1) requestAnimationFrame(p); else $("#introKicker").textContent = "signal acquired"; };
    requestAnimationFrame(p);
    await scramble(nameEl, C.name || "", { dur: 1600 });
  })();

  /* ---------------- hero ---------------- */
  async function startHero() {
    const nameEl = $("#heroName");
    const words = (C.name || "").split(/\s+/).filter(Boolean);
    nameEl.innerHTML = words.map(() => `<span class="line"></span>`).join("");
    $$(".line", nameEl).forEach((l, i) => setTimeout(() => scramble(l, words[i], { dur: 1000 }), i * 180));
    typeTagline();
    rotateRoles();
  }
  async function typeTagline() {
    const el = $("#heroTag");
    if (!has(C.tagline)) { el.innerHTML = todo("tagline — set it in config.js"); return; }
    el.textContent = "";
    await sleep(900);
    for (const ch of C.tagline) {
      el.textContent += ch;
      await sleep(reduceMotion ? 0 : /[,.!?]/.test(ch) ? 260 : 24 + Math.random() * 46);
    }
  }
  async function rotateRoles() {
    const el = $("#role");
    const roles = (C.roles || []).filter(has);
    if (!roles.length) { el.innerHTML = todo("roles"); return; }
    let i = 0, prev = "";
    await sleep(500);
    for (;;) {
      const r = roles[i % roles.length];
      await scramble(el, r, { dur: 700, from: prev });
      prev = r;
      if (roles.length === 1) return;
      await sleep(2400);
      i++;
    }
  }

  /* =================================================================
     RENDERERS
     ================================================================= */
  const box = (st) => ({ done: "[x]", doing: "[~]", blocked: "[!]" }[st] || "[ ]");

  // about
  (() => {
    const paras = (C.about || []).filter(has);
    $("#aboutText").innerHTML = paras.length ? paras.map((p) => `<p>${esc(p)}</p>`).join("") : `<p>${todo("about — write a few paragraphs in config.js → about")}</p>`;
    $("#facts tbody").innerHTML = (C.facts || []).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${or(v)}</td></tr>`).join("");
  })();

  // now
  (() => {
    if (has(C.nowUpdated)) $("#nowUpdated").textContent = "· updated " + C.nowUpdated;
    const items = C.now || [];
    $("#nowList").innerHTML = items.length
      ? items.map((it) => `<li data-reveal><span class="box ${esc(it.status)}">${box(it.status)}</span><span>${or(it.text)}</span></li>`).join("")
      : `<li>${todo("nothing listed yet")}</li>`;
  })();

  // everything + 3D sphere
  (() => {
    const groups = C.interests || [];
    $("#groups").innerHTML = groups
      .map((g) => `<div class="group" data-reveal><h4>${esc(g.group)}</h4><ul>${(g.items || []).map((x) => `<li>${or(x)}</li>`).join("")}</ul></div>`)
      .join("");
    const words = [];
    groups.forEach((g) => {
      words.push({ t: g.group, c: "c" });
      (g.items || []).forEach((x) => words.push(has(x) ? { t: x } : { t: "?", c: "q" }));
    });
    const sphere = $("#sphere"), wrap = sphere.parentElement;
    sphere.innerHTML = words.map((w) => `<span class="${w.c || ""}">${esc(w.t)}</span>`).join("");
    const spans = $$("span", sphere);
    const n = spans.length;
    const pts = spans.map((_, i) => {
      const y = 1 - (i / Math.max(1, n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    let ax = 0.3, ay = 0, vx = 0.0016, vy = 0.004, drag = null, visible = false;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(wrap);
    wrap.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag) return;
      vy = (e.clientX - drag.x) * 0.0009; vx = -(e.clientY - drag.y) * 0.0009;
      drag = { x: e.clientX, y: e.clientY };
    });
    wrap.addEventListener("pointerup", () => (drag = null));
    wrap.addEventListener("pointercancel", () => (drag = null));
    const frame = () => {
      if (visible) {
        const R = wrap.clientWidth < 420 ? 125 : 175;
        ax += vx; ay += vy;
        if (!drag) { vx += (0.0016 - vx) * 0.02; vy += (0.004 - vy) * 0.02; }
        const b = window.__beat || 0;
        const sx = Math.sin(ax), cx = Math.cos(ax), sy = Math.sin(ay), cy = Math.cos(ay);
        for (let i = 0; i < n; i++) {
          let [x, y, z] = pts[i];
          const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
          const rr = R * (1 + b * 0.06);
          const depth = (z2 + 1) / 2;
          const s = spans[i];
          s.style.transform = `translate3d(${x1 * rr}px, ${y2 * rr}px, ${z2 * rr}px) translate(-50%, -50%)`;
          s.style.opacity = (0.15 + depth * 0.85).toFixed(2);
          s.style.zIndex = Math.round(depth * 100);
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })();

  // research
  (() => {
    const list = C.research || [];
    $("#researchList").innerHTML = list.length
      ? list
          .map((r) => {
            const st = esc(r.status || "idea");
            const url = safeUrl(r.link);
            const title = has(r.title) ? (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)) : todo("title");
            return `<div class="r-item" data-reveal><span class="tag ${st}"><i class="st ${st}"></i>${st}</span><h4>${title}</h4><p>${or(r.blurb, "one-line description")}</p></div>`;
          })
          .join("")
      : `<div class="placeholder">${todo("add research in config.js → research")}</div>`;
    const papers = C.papers || [];
    $("#papers").innerHTML = papers.length
      ? papers
          .map((p) => {
            const url = safeUrl(p.link);
            return `<div class="paper" data-reveal><span class="y">${esc(p.year)}</span><div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)} <span class="dim mono small">${esc(p.venue)}</span></div></div>`;
          })
          .join("")
      : `<div class="placeholder" data-reveal>${todo("papers & notes — add them in config.js → papers")}</div>`;

    // entropy playground
    const inp = $("#entIn");
    function entropy(str) {
      const chars = Array.from(str);
      const n = chars.length;
      const m = new Map();
      for (const c of chars) m.set(c, (m.get(c) || 0) + 1);
      let H = 0;
      for (const v of m.values()) { const p = v / n; H -= p * Math.log2(p); }
      return { n, H: n ? Math.abs(H) : 0, counts: [...m].sort((a, b) => b[1] - a[1]) };
    }
    window.__entropy = entropy; // exposed for testing
    const show = (c) => (c === " " ? "␣" : c === "\n" ? "↵" : c === "\t" ? "⇥" : c);
    function update() {
      const { n, H, counts } = entropy(inp.value);
      $("#entH").textContent = H.toFixed(3);
      $("#entTotal").textContent = (H * n).toFixed(1);
      $("#entSave").textContent = n ? Math.round((1 - H / 8) * 100) + "%" : "—";
      const max = counts.length ? counts[0][1] : 1;
      $("#entBars").innerHTML = counts
        .slice(0, 24)
        .map(([c, k]) => `<div class="ent-bar"><b>${esc(show(c))}</b><i style="width:${(k / max) * 100}%"></i><span>${((k / n) * 100).toFixed(1)}%</span></div>`)
        .join("");
    }
    inp.addEventListener("input", update);
    $$("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => {
        let v = b.dataset.preset;
        if (v === "__random") { const a = "abcdefghijklmnopqrstuvwxyz0123456789"; v = Array.from({ length: 48 }, () => a[(Math.random() * a.length) | 0]).join(""); }
        inp.value = v; update();
      })
    );
    update();
  })();

  // GitHub helper (cached per session to stay under the 60 req/h limit)
  async function gh(path) {
    const key = "ah:gh:" + path;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* ignore */ }
    if (cached && Date.now() - cached.t < 6e5) return cached.d; // fresh for 10 min
    try {
      const r = await fetch("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "rate limited" : "HTTP " + r.status);
      const d = await r.json();
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* ignore */ }
      return d;
    } catch (err) {
      if (cached) return cached.d; // stale beats nothing
      throw err;
    }
  }
  const shade = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const g = 110 + (h % 130); return `rgb(${g},${g},${g})`; };

  // projects
  (async () => {
    const el = $("#repos");
    const u = C.github;
    $("#ghLink").href = `https://github.com/${u}`;
    if (!has(u)) { el.innerHTML = `<div class="placeholder">${todo("set github username in config.js")}</div>`; return; }
    try {
      const repos = await gh(`/users/${encodeURIComponent(u)}/repos?per_page=100&sort=pushed`);
      const hide = new Set((C.hideRepos || []).map((x) => x.toLowerCase()));
      const list = repos
        .filter((r) => !r.fork && !hide.has(r.name.toLowerCase()))
        .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, C.projectsLimit || 6);
      if (!list.length) { el.innerHTML = `<div class="placeholder">no public repositories yet — <b>first one loading…</b></div>`; return; }
      el.innerHTML = list
        .map(
          (r) => `<a class="repo" href="${esc(r.html_url)}" target="_blank" rel="noopener" data-reveal>
            <h4>${esc(r.name)}</h4>
            <p>${r.description ? esc(r.description) : '<span class="todo">no description</span>'}</p>
            <div class="meta">${r.language ? `<span><i class="lang-dot" style="background:${shade(r.language)}"></i>${esc(r.language)}</span>` : ""}<span>★ ${r.stargazers_count}</span><span>⑂ ${r.forks_count}</span><span>${esc(ago(r.pushed_at))}</span></div>
          </a>`
        )
        .join("");
      reveal(el);
    } catch (err) {
      el.innerHTML = `<div class="placeholder">couldn't reach github (${esc(err.message)}) — <a href="https://github.com/${esc(u)}" target="_blank" rel="noopener">view profile →</a></div>`;
    }
  })();

  // ledger
  (async () => {
    const el = $("#ledgerBody");
    const L = C.ledger || {};
    const about = has(L.about) ? `<p class="lead">${esc(L.about)}</p>` : `<p class="lead">${todo("ledger.about — what is the ledger?")}</p>`;
    if (!has(L.repo)) {
      el.innerHTML = `${about}<div class="placeholder" data-reveal>$ git clone <b>&lt;ledger&gt;</b><br>${todo("set ledger.repo in config.js — e.g. \"Ahmadhussain0033/ledger\"")}</div>`;
      reveal(el);
      return;
    }
    el.innerHTML = `${about}<div class="loading mono">reading ${esc(L.repo)}<span class="dots"></span></div>`;
    try {
      const [repo, commits, langs] = await Promise.all([gh(`/repos/${L.repo}`), gh(`/repos/${L.repo}/commits?per_page=8`), gh(`/repos/${L.repo}/languages`)]);
      const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
      const langArr = Object.entries(langs).sort((a, b) => b[1] - a[1]);
      el.innerHTML = `${about}
        <div class="ledger-top">
          <div class="stat" data-reveal><b>${repo.stargazers_count}</b><span>stars</span></div>
          <div class="stat" data-reveal><b>${commits.length >= 8 ? "8+" : commits.length}</b><span>recent commits</span></div>
          <div class="stat" data-reveal><b>${repo.open_issues_count}</b><span>open issues</span></div>
          <div class="stat" data-reveal><b>${esc(ago(repo.pushed_at).replace(" ago", ""))}</b><span>since last push</span></div>
        </div>
        <div class="grid-2">
          <div class="panel" data-reveal>
            <div class="panel-head mono"><span>$ git log --oneline</span><a href="${esc(repo.html_url)}" target="_blank" rel="noopener">open repo →</a></div>
            <ul class="gitlog">${commits
              .map((c) => `<li><span class="sha">${esc(c.sha.slice(0, 7))}</span><span class="msg">${esc((c.commit.message || "").split("\n")[0])}</span><span class="when">${esc(ago(c.commit.author?.date))}</span></li>`)
              .join("")}</ul>
          </div>
          <div class="panel" data-reveal>
            <div class="panel-head mono"><span>languages</span><span class="dim">${esc(repo.default_branch)}</span></div>
            <div class="langbar">${langArr.map(([l, v]) => `<i style="width:${(v / total) * 100}%;background:${shade(l)}" title="${esc(l)}"></i>`).join("")}</div>
            <div class="langs">${langArr.map(([l, v]) => `<span><i class="lang-dot" style="background:${shade(l)}"></i>${esc(l)} ${((v / total) * 100).toFixed(1)}%</span>`).join("") || todo("no code yet")}</div>
            <p class="dim small" style="margin-top:16px">${repo.description ? esc(repo.description) : ""}</p>
          </div>
        </div>`;
      reveal(el);
    } catch (err) {
      el.innerHTML = `${about}<div class="placeholder">couldn't load ${esc(L.repo)} (${esc(err.message)})</div>`;
    }
  })();

  // roadmap
  (() => {
    const phases = C.roadmap || [];
    const col = { done: "var(--green)", doing: "var(--yellow)", blocked: "var(--red)" };
    $("#timeline").innerHTML = phases
      .map((p) => {
        const items = p.items || [];
        const done = items.filter((i) => i.status === "done").length;
        const agg = items.some((i) => i.status === "blocked") ? "blocked" : items.some((i) => i.status === "doing") ? "doing" : items.length && done === items.length ? "done" : "todo";
        return `<li class="phase" data-reveal style="--st:${col[agg] || "var(--mute)"}">
          <span class="node"></span>
          <div class="phase-head"><h4>${or(p.title, "phase title")}</h4><span class="when">${or(p.when, "when")}</span>
            <span class="phase-prog" title="${done}/${items.length} done"><i style="width:${items.length ? (done / items.length) * 100 : 0}%"></i></span></div>
          <ul>${items.map((i) => `<li><span class="box ${esc(i.status)}">${box(i.status)}</span><span>${or(i.text)}</span></li>`).join("")}</ul>
        </li>`;
      })
      .join("") || `<li>${todo("add roadmap phases in config.js")}</li>`;
  })();

  // achievements
  (() => {
    const list = C.achievements || [];
    $("#medals").innerHTML = list
      .map((a, i) => {
        const locked = !has(a.title);
        const url = safeUrl(a.link);
        const g = esc(String(a.grade || "S").toUpperCase());
        return `<div class="medal ${locked ? "locked" : ""}" data-reveal style="--i:${i}">
          <div class="grade ${g}">${locked ? "?" : g}</div>
          <h4>${locked ? '<span class="dim">locked</span>' : url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(a.title)}</a>` : esc(a.title)}</h4>
          <p>${locked ? todo("achievement") : or(a.detail, "detail")}</p>
          ${has(a.date) ? `<span class="date">${esc(a.date)}</span>` : ""}
        </div>`;
      })
      .join("");
  })();

  // toolbox.json
  (() => {
    const tb = C.toolbox || {};
    const keys = Object.keys(tb);
    const lines = [`<span class="tk-p">{</span>`];
    keys.forEach((k, ki) => {
      const vals = tb[k] || [];
      const empty = vals.some((v) => !has(v));
      const arr = vals.map((v) => `<span class="tk-s">"${esc(v)}"</span>`).join('<span class="tk-p">, </span>');
      lines.push(`  <span class="tk-k">"${esc(k)}"</span><span class="tk-p">: [</span>${arr}<span class="tk-p">]${ki < keys.length - 1 ? "," : ""}</span>${empty && C.showTodos !== false ? `  <span class="tk-c">// todo: fill in</span>` : ""}`);
    });
    lines.push(`<span class="tk-p">}</span>`);
    $("#toolboxCode").innerHTML = lines.map((l) => `<span class="ln">${l}</span>`).join("");
  })();

  // library
  (() => {
    const list = C.library || [];
    $("#libTable tbody").innerHTML = list.length
      ? list.map((x) => `<tr><td>${or(x.kind)}</td><td>${or(x.title)}</td><td>${or(x.by)}</td><td>${or(x.note)}</td></tr>`).join("")
      : `<tr><td colspan="4">${todo("add to config.js → library")}</td></tr>`;
  })();

  // principles
  (() => {
    $("#principlesList").innerHTML = (C.principles || []).map((p) => `<li data-reveal><span>${or(p, "a principle you live by")}</span></li>`).join("");
  })();

  // media (YouTube)
  (() => {
    const Y = C.youtube || {};
    const link = $("#ytLink");
    const url = safeUrl(Y.url);
    if (url) link.href = url; else link.style.display = "none";
    const bodyEl = $("#ytBody");
    const cid = String(Y.channelId || "").trim();
    const vid = String(Y.featured || "").trim();
    const frame = (src) => `<iframe src="${esc(src)}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    if (/^[\w-]{6,20}$/.test(vid)) bodyEl.innerHTML = frame(`https://www.youtube-nocookie.com/embed/${vid}`);
    else if (/^UC[\w-]{20,}$/.test(cid)) bodyEl.innerHTML = frame(`https://www.youtube-nocookie.com/embed/videoseries?list=UU${cid.slice(2)}`);
    else bodyEl.innerHTML = `<div class="placeholder">▶ channel coming soon<br>${todo("youtube.channelId or youtube.featured in config.js")}</div>`;
  })();

  // discord
  (() => {
    const D = C.discord || {};
    const card = $("#dcCard"), server = $("#dcServer");
    const uid = String(D.userId || "").trim();
    const profile = /^\d{15,22}$/.test(uid) ? `https://discord.com/users/${uid}` : "https://discord.com";
    card.innerHTML = `
      <div class="panel-head mono"><span>presence</span><span class="dim" id="dcLive">${/^\d{15,22}$/.test(uid) ? "connecting…" : "static"}</span></div>
      <div class="dc-top">
        <div class="dc-av" id="dcAv">${esc((D.username || "?")[0].toUpperCase())}<i class="st" id="dcSt"></i></div>
        <div><div class="dc-name">${or(D.username, "username")}</div><div class="mono dim small" id="dcStatus">${/^\d{15,22}$/.test(uid) ? "…" : todo("discord.userId → enables live status")}</div></div>
      </div>
      <div class="dc-act" id="dcAct">find me on discord — say hi, i don't bite.</div>
      <div class="dc-actions">
        <button class="btn btn-hi" id="dcCopy">copy username</button>
        <a class="btn" href="${esc(profile)}" target="_blank" rel="noopener">open discord ↗</a>
      </div>`;
    $("#dcCopy").addEventListener("click", () => copy(D.username, "discord username"));

    const sid = String(D.serverId || "").trim();
    const inv = safeUrl(D.serverInvite);
    let s = `<div class="panel-head mono"><span>server</span>${inv ? `<a href="${esc(inv)}" target="_blank" rel="noopener">join →</a>` : ""}</div>`;
    if (/^\d{15,22}$/.test(sid)) s += `<iframe class="dc-widget" src="https://discord.com/widget?id=${sid}&theme=dark" title="Discord server" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" loading="lazy"></iframe>`;
    else s += `<div class="placeholder">${inv ? `<a class="btn btn-hi" href="${esc(inv)}" target="_blank" rel="noopener">join the server</a><br><br>` : ""}${todo("discord.serverId / serverInvite in config.js")}</div>`;
    server.innerHTML = s;

    if (!/^\d{15,22}$/.test(uid)) return;
    const label = { online: "online", idle: "idle", dnd: "do not disturb", offline: "offline" };
    async function poll() {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${uid}`);
        const j = await r.json();
        if (!j.success) throw new Error(j.error?.message || "not tracked");
        const d = j.data;
        $("#dcSt").className = "st " + d.discord_status;
        $("#dcStatus").textContent = label[d.discord_status] || d.discord_status;
        $("#dcLive").textContent = "live · lanyard";
        if (d.discord_user?.avatar) {
          const av = $("#dcAv");
          if (!$("img", av)) av.insertAdjacentHTML("afterbegin", `<img alt="" src="https://cdn.discordapp.com/avatars/${uid}/${esc(d.discord_user.avatar)}.png?size=128">`);
          [...av.childNodes].forEach((nd) => nd.nodeType === 3 && nd.remove());
        }
        const act = $("#dcAct");
        const custom = (d.activities || []).find((a) => a.type === 4);
        const game = (d.activities || []).find((a) => a.type === 0);
        if (d.listening_to_spotify && d.spotify) act.innerHTML = `♪ listening to <b>${esc(d.spotify.song)}</b> by ${esc(d.spotify.artist)}`;
        else if (game) act.innerHTML = `▶ playing <b>${esc(game.name)}</b>${game.details ? " — " + esc(game.details) : ""}`;
        else if (custom && custom.state) act.textContent = custom.state;
      } catch (e) {
        $("#dcLive").textContent = "offline data";
        $("#dcStatus").innerHTML = todo("join discord.gg/lanyard to enable live status");
        return;
      }
      setTimeout(poll, 30000);
    }
    poll();
  })();

  // log
  (() => {
    const md = (s) =>
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const posts = [...(C.log || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $("#logList").innerHTML = posts.length
      ? posts.map((p) => `<article class="post" data-reveal><div class="date">${esc(p.date)}</div><div><h4>${or(p.title)}</h4><p>${has(p.body) ? md(p.body) : todo()}</p></div></article>`).join("")
      : `<div class="placeholder">${todo("no posts yet")}</div>`;
  })();

  // guestbook (giscus)
  (() => {
    const G = C.giscus || {};
    const boxEl = $("#giscusBox");
    if (![G.repo, G.repoId, G.category, G.categoryId].every(has)) {
      boxEl.innerHTML = `<div class="placeholder">guestbook opening soon<br>${todo("enable Discussions on the repo, install github.com/apps/giscus, then fill config.js → giscus (values from giscus.app)")}</div>`;
      return;
    }
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    Object.entries({ repo: G.repo, "repo-id": G.repoId, category: G.category, "category-id": G.categoryId, mapping: "specific", term: "guestbook", "reactions-enabled": "1", "emit-metadata": "0", "input-position": "top", theme: "transparent_dark", lang: "en", loading: "lazy" })
      .forEach(([k, v]) => s.setAttribute("data-" + k, v));
    s.crossOrigin = "anonymous";
    s.async = true;
    boxEl.appendChild(s);
  })();

  // contact
  (() => {
    const A = C.availability || {};
    $("#availDot").className = "st " + (A.status || "");
    $("#availText").innerHTML = or(A.text, "availability");
    $("#respTime").innerHTML = or(C.responseTime);
    $("#emailTxt").innerHTML = or(C.email, "email");
    $("#dcTxt").innerHTML = or(C.discord?.username);
    if (!has(C.email)) $("#copyEmail").remove();
    else $("#copyEmail").addEventListener("click", () => copy(C.email, "email"));
    $("#copyDc").addEventListener("click", () => copy(C.discord?.username, "discord username"));

    // live local time
    const lt = $("#localTime");
    let tf = null;
    if (has(C.timezone)) { try { tf = new Intl.DateTimeFormat([], { timeZone: C.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }); } catch { tf = null; } }
    if (tf) { const t = () => (lt.textContent = tf.format(new Date())); t(); setInterval(t, 1000); }
    else lt.innerHTML = todo("timezone");

    // socials
    $("#socials").innerHTML = (C.socials || [])
      .map((s) => {
        const u = safeUrl(s.url);
        if (u) return `<li><a href="${esc(u)}" target="_blank" rel="noopener me"><span>→ ${esc(s.label)}</span><span>↗</span></a></li>`;
        return C.showTodos === false ? "" : `<li><span class="todo-row"><span>→ ${esc(s.label)}</span><span class="todo">url</span></span></li>`;
      })
      .join("");

    // form
    const form = $("#cform");
    const f = { name: $("#cfName"), email: $("#cfEmail"), msg: $("#cfMsg") };
    const status = $("#cfStatus"), send = $("#cfSend"), count = $("#cfCount");
    const key = String(C.web3formsKey || "").trim();
    $("#cfMode").textContent = key ? "delivers straight to my inbox" : has(C.email) ? "opens your email app" : "not wired up yet";
    const rules = {
      name: (v) => (v.trim().length >= 2 ? "" : "tell me what to call you (2+ characters)"),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "that email doesn't look quite right"),
      msg: (v) => (v.trim().length >= 10 ? "" : "a little more? (10+ characters)"),
    };
    const touched = {};
    function check(k) {
      const el = f[k], m = rules[k](el.value);
      el.classList.toggle("bad", !!m);
      el.classList.toggle("good", !m);
      el.setAttribute("aria-invalid", m ? "true" : "false");
      $(`.err[data-for="${el.id}"]`).textContent = m;
      return !m;
    }
    const topic = () => ($("input[name=topic]:checked", form) || {}).value || "hello";
    const saveDraft = () => store.set("draft", { name: f.name.value, email: f.email.value, msg: f.msg.value, topic: topic() });
    const d = store.get("draft", null);
    if (d) {
      f.name.value = d.name || ""; f.email.value = d.email || ""; f.msg.value = d.msg || "";
      const r = $(`input[name=topic][value="${CSS.escape(d.topic || "")}"]`, form);
      if (r) r.checked = true;
    }
    count.textContent = `${f.msg.value.length} / 2000`;
    Object.keys(f).forEach((k) => {
      f[k].addEventListener("blur", () => { if (f[k].value) { touched[k] = true; check(k); } });
      f[k].addEventListener("input", () => { if (touched[k]) check(k); saveDraft(); if (k === "msg") count.textContent = `${f.msg.value.length} / 2000`; });
    });
    form.addEventListener("change", saveDraft);
    form.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); form.requestSubmit(); } });
    const say = (cls, html) => { status.className = "cf-status mono " + cls; status.innerHTML = html; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = Object.keys(f).map((k) => ((touched[k] = true), check(k)));
      const firstBad = Object.keys(f).find((_, i) => !ok[i]);
      if (firstBad) { f[firstBad].focus(); say("bad", "✗ almost — fix the highlighted field" + (ok.filter((x) => !x).length > 1 ? "s" : "")); return; }
      const name = f.name.value.trim(), email = f.email.value.trim(), msg = f.msg.value.trim();
      const r = send.getBoundingClientRect();
      if (form.botcheck.checked) { say("ok", "✓ sent"); return; }

      if (key) {
        send.disabled = true;
        say("wait", '> sending<span class="dots"></span>');
        try {
          const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ access_key: key, subject: `[site] ${topic()} — from ${name}`, from_name: name, name, email, replyto: email, topic: topic(), message: msg, botcheck: false }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok || !j.success) throw new Error(j.message || "HTTP " + res.status);
          say("ok", `✓ delivered. thanks, ${esc(name)} — i'll reply to <b>${esc(email)}</b>.`);
          form.reset(); store.set("draft", null); count.textContent = "0 / 2000";
          Object.values(f).forEach((el) => el.classList.remove("good", "bad"));
          for (let i = 0; i < 5; i++) setTimeout(() => hit(r.left + Math.random() * r.width, r.top + Math.random() * r.height, "300"), i * 90);
          setTimeout(() => (send.disabled = false), 20000);
        } catch (err) {
          send.disabled = false;
          say("bad", `✗ couldn't send (${esc(err.message)}). try again${has(C.email) ? `, or email <b>${esc(C.email)}</b> directly` : ", or message me on discord"}.`);
        }
        return;
      }
      if (has(C.email)) {
        const href = `mailto:${encodeURIComponent(C.email)}?subject=${encodeURIComponent(`[site] ${topic()} — from ${name}`)}&body=${encodeURIComponent(`${msg}\n\n— ${name} (${email})`)}`;
        say("ok", "↗ opening your email app with everything filled in…");
        window.location.href = href;
        return;
      }
      say("bad", `✗ the form isn't wired up yet — reach me on discord: <b>${esc(C.discord?.username || "")}</b>`);
    });
  })();

  // footer: last updated
  (async () => {
    const el = $("#lastUpd");
    try { const r = await gh(`/repos/${C.github}/About-Me`); el.textContent = "updated " + ago(r.pushed_at); }
    catch { el.textContent = ""; }
  })();

  /* ---------------- boot ---------------- */
  addEventListener("resize", resize);
  resize();
  reveal();
  onScroll();
  requestAnimationFrame(loop);
  if (!finePointer) body.classList.remove("has-mouse");
  window.__site = { go, openPal, toggleMusic, isPlaying, hit };
})();
