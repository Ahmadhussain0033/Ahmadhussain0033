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
  const safeUrl = (u) => { const v = String(u || "").trim(); return /^(https?:|mailto:)/i.test(v) || /^(assets|docs)\/[\w./-]+$/.test(v) ? v : ""; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // tiny inline markdown: **bold**, *em*, `code`, [text](https://…)
  const mdInline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

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
  sections.forEach((s, i) => (s.dataset.num = String(i).padStart(2, "0")));
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
    if (window.__warp) window.__warp();
    whoosh();
    if (!fxOn || reduceMotion) { target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); return; }
    navigating = true;
    $("#wipeLabel").textContent = "» " + (target.dataset.title || "");
    wipe.className = "in";
    setTimeout(() => {
      root.style.scrollBehavior = "auto";
      target.scrollIntoView();
      root.style.scrollBehavior = "";
      wipe.className = "out";
      setTimeout(() => { wipe.className = ""; navigating = false; }, 720);
    }, 640);
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
  // section positions are measured only when the layout changes (ResizeObserver), never
  // on scroll: getBoundingClientRect ×18 per scroll frame forced synchronous layout
  let secTops = [], scrollMax = 1;
  function measureSections() {
    scrollMax = Math.max(1, root.scrollHeight - innerHeight);
    secTops = sections.map((s) => s.getBoundingClientRect().top + scrollY);
  }
  new ResizeObserver(() => { measureSections(); onScroll(); }).observe(document.body);
  addEventListener("resize", measureSections);
  let sy = scrollY; // cached in the scroll event; reading scrollY inside rAF forced a style recalc
  function onScroll() {
    if (!secTops.length) measureSections();
    hp.style.transform = `scaleX(${Math.min(1, sy / scrollMax).toFixed(4)})`;
    let idx = 0;
    const line = sy + innerHeight * 0.4;
    for (let i = 0; i < secTops.length; i++) if (secTops[i] <= line) idx = i;
    if (idx !== activeIdx) {
      activeIdx = idx;
      stats.seen.add(sections[idx].id);
      railLinks.forEach((a, i) => a.classList.toggle("active", i === idx));
      hudFile.textContent = sections[idx].dataset.file;
      hudNum.textContent = sections[idx].dataset.num;
    }
  }
  let scrollQueued = false;
  addEventListener("scroll", () => {
    sy = scrollY;
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
  let W = 0, H = 0, DPR = 1;
  function resize() {
    W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); npW = 0;
    fx.width = W * DPR; fx.height = H * DPR; fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const bursts = [], charPops = [];
  const comboEl = $("#combo"), comboN = $("#comboN");
  let combo = 0, comboT;
  function judge() {
    const b = window.__beat || 0;
    const r = Math.random();
    if (r < 0.025) return "miss";
    if (isPlaying() && b > 0.35) return "300"; // on the beat
    if (isPlaying() && b > 0.1) return r < 0.8 ? "300" : "100";
    return r < 0.75 ? "300" : r < 0.94 ? "100" : "50";
  }
  function hit(x, y, forced) {
    if (!fxOn) return;
    const j = forced || judge();
    bursts.push({ x, y, t: performance.now(), j, parts: Array.from({ length: 10 }, () => ({ a: Math.random() * Math.PI * 2, v: 40 + Math.random() * 70 })) });
    hitSound(j);
    if (j === "miss") { stats.miss++; combo = 0; comboEl.classList.add("broke"); comboN.textContent = "0"; }
    else {
      stats["n" + j]++;
      stats.score += Math.round(+j * (1 + combo / 25) * modMult());
      combo++; stats.maxCombo = Math.max(stats.maxCombo, combo);
      comboEl.classList.remove("broke"); comboN.textContent = combo;
      if (combo % 50 === 0) toast(`${combo} combo!`);
    }
    comboEl.classList.add("show");
    comboEl.classList.remove("pop"); void comboEl.offsetWidth; comboEl.classList.add("pop");
    clearTimeout(comboT);
    comboT = setTimeout(() => comboEl.classList.remove("show"), 2600);
  }
  addEventListener("pointerdown", (e) => { if (!body.classList.contains("is-intro")) hit(e.clientX, e.clientY); });

  const JC = { 300: "#4fe3ff", 100: "#6ee7a0", 50: "#ffd166", miss: "#ff5d73" };
  let fxDirty = true;
  function drawFx(now) {
    const busy = fxOn && (trail.length || bursts.length || charPops.length);
    // when nothing is animating, the canvas is hidden so the compositor doesn't blend an
    // empty full-screen layer every frame
    if (!busy) {
      if (fxDirty) { fctx.clearRect(0, 0, W, H); fxDirty = false; fx.style.visibility = "hidden"; }
      if (!fxOn) { trail.length = 0; bursts.length = 0; charPops.length = 0; }
      return;
    }
    if (!fxDirty) fx.style.visibility = "";
    fxDirty = true;
    fctx.clearRect(0, 0, W, H);
    // trail
    while (trail.length && now - trail[0].t > 260) trail.shift();
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i], k = 1 - (now - p.t) / 260;
      fctx.beginPath();
      fctx.arc(p.x, p.y, 1 + k * 3.2, 0, Math.PI * 2);
      fctx.fillStyle = `rgba(255,255,255,${k * 0.35})`;
      fctx.fill();
    }
    // typed-character pops
    for (let i = charPops.length - 1; i >= 0; i--) {
      const p = charPops[i], e = (now - p.t) / 650;
      if (e > 1) { charPops.splice(i, 1); continue; }
      fctx.globalAlpha = 1 - e;
      fctx.font = `600 ${14 + e * 8}px JetBrains Mono, monospace`;
      fctx.textAlign = "center";
      fctx.fillStyle = "#4fe3ff";
      fctx.fillText(p.ch, p.x + p.vx * e, p.y - 12 - e * 28);
      fctx.beginPath(); fctx.arc(p.x, p.y, 3 + e * 16, 0, Math.PI * 2);
      fctx.strokeStyle = `rgba(79,227,255,${(1 - e) * 0.6})`; fctx.lineWidth = 1.2; fctx.stroke();
      fctx.globalAlpha = 1;
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
  let actx, analyser, freq, sfxBus;
  function getCtx() {
    if (!actx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
        sfxBus = actx.createGain();
        sfxBus.gain.value = 0.55;
        sfxBus.connect(actx.destination);
      } catch { return null; }
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function ensureGraph() {
    if (analyser || !getCtx()) return;
    try {
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
  let beatS = 0, npVisible = false, lastBeatW = -1, barsIdle = false, npW = 0;
  const kiaiEl = $("#kiai"), tunerEl = $("#introGo");
  new IntersectionObserver(([e]) => { npVisible = e.isIntersecting; npW = 0; }).observe(npViz);
  function audioFrame() {
    let bass = 0;
    if (analyser && isPlaying()) {
      analyser.getByteFrequencyData(freq);
      for (let i = 0; i < 8; i++) bass += freq[i];
      bass /= 8 * 255;
      pBars.forEach((b, i) => (b.style.transform = `scaleY(${((3 + (freq[2 + i * 9] / 255) * 15) / 18).toFixed(3)})`));
      barsIdle = false;
    } else if (!barsIdle) { barsIdle = true; pBars.forEach((b) => (b.style.transform = "")); }
    const target = clamp((bass - 0.5) / 0.4, 0, 1);
    beatS += (target - beatS) * (target > beatS ? 0.5 : 0.08);
    window.__beat = beatS;
    // direct, compositor-only writes (a root CSS variable would restyle the whole page every frame)
    if (Math.abs(beatS - lastBeatW) > 0.01) {
      lastBeatW = beatS;
      kiaiEl.style.opacity = fxOn ? clamp((beatS - 0.45) * 2.2, 0, 1).toFixed(2) : "0";
      if (!entered) tunerEl.style.transform = `scale(${(1 + beatS * 0.05).toFixed(3)})`;
    }
    if (npVisible) drawNp();
  }
  function drawNp() {
    if (!npW) { npW = Math.round(npViz.clientWidth * DPR); npViz.width = npW; npViz.height = 90 * DPR; }
    const w = npW, h = npViz.height;
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

  /* ---------------- synthesized sound effects (no samples) ---------------- */
  const KEY_MODES = ["click", "thock", "typewriter", "pop", "piano", "off"];
  let keyMode = KEY_MODES.includes(store.get("keys", "click")) ? store.get("keys", "click") : "click";
  let hitOn = store.get("hits", true);
  let noiseB = null;
  function noiseSrc(c) {
    if (!noiseB) {
      noiseB = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseB.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = c.createBufferSource();
    n.buffer = noiseB;
    return n;
  }
  function envTo(c, node, t, peak, dur, attack = 0.002) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(sfxBus);
  }
  function burst(c, t, { type = "bandpass", f = 3000, q = 1, peak = 0.5, dur = 0.04 }) {
    const n = noiseSrc(c), bq = c.createBiquadFilter();
    bq.type = type; bq.frequency.value = f; bq.Q.value = q;
    n.connect(bq); envTo(c, bq, t, peak, dur);
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.03);
  }
  function tone(c, t, { wave = "sine", f = 440, f2 = 0, peak = 0.3, dur = 0.08, attack = 0.002 }) {
    const o = c.createOscillator();
    o.type = wave; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    envTo(c, o, t, peak, dur, attack);
    o.start(t); o.stop(t + dur + 0.03);
  }
  const PENTA = [0, 2, 4, 7, 9];
  let pianoStep = 5;
  function keySound(kind) {
    if (keyMode === "off") return;
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime, r = Math.random(), sp = kind === "space", bk = kind === "back", en = kind === "enter";
    if (keyMode === "click") {
      burst(c, t, { f: sp ? 1400 : 2600 + r * 1600, q: 1.4, peak: bk ? 0.25 : 0.5, dur: sp ? 0.05 : 0.03 });
      tone(c, t, { f: sp ? 130 : 190 + r * 40, f2: 60, peak: 0.28, dur: 0.045 });
    } else if (keyMode === "thock") {
      burst(c, t, { type: "lowpass", f: sp ? 700 : 1100 + r * 300, q: 0.7, peak: 0.7, dur: 0.06 });
      tone(c, t, { f: sp ? 95 : 140 + r * 20, f2: 55, peak: 0.45, dur: 0.07 });
    } else if (keyMode === "typewriter") {
      burst(c, t, { type: "highpass", f: 2500, q: 0.8, peak: 0.35, dur: 0.018 });
      burst(c, t + 0.004, { f: 3600 + r * 500, q: 9, peak: 0.45, dur: 0.05 });
      if (en) { tone(c, t + 0.03, { f: 2093, peak: 0.18, dur: 0.9, attack: 0.003 }); tone(c, t + 0.03, { f: 3136, peak: 0.08, dur: 0.7 }); }
    } else if (keyMode === "pop") {
      tone(c, t, { f: sp ? 420 : 700 + r * 350, f2: sp ? 160 : 240, peak: 0.32, dur: 0.07 });
    } else if (keyMode === "piano") {
      const step = bk ? -1 : sp ? 0 : r < 0.7 ? 1 : -1;
      pianoStep = clamp(pianoStep + step, 0, 14);
      const semis = Math.floor(pianoStep / 5) * 12 + PENTA[pianoStep % 5];
      const f = 261.63 * Math.pow(2, semis / 12) * (sp ? 0.5 : 1);
      tone(c, t, { wave: "triangle", f, peak: 0.22, dur: 0.5, attack: 0.004 });
      tone(c, t, { f: f * 2, peak: 0.05, dur: 0.3 });
    }
  }
  function hitSound(j) {
    if (!hitOn) return;
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    if (j === "miss") { tone(c, t, { wave: "sawtooth", f: 300, f2: 70, peak: 0.1, dur: 0.35 }); return; }
    burst(c, t, { f: 5200, q: 2, peak: 0.22, dur: 0.03 });
    tone(c, t, { f: j === "300" ? 880 : j === "100" ? 740 : 620, f2: 420, peak: 0.13, dur: 0.06 });
  }
  function whoosh() {
    if (!hitOn) return;
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime, n = noiseSrc(c), bq = c.createBiquadFilter();
    bq.type = "bandpass"; bq.Q.value = 0.9;
    bq.frequency.setValueAtTime(300, t); bq.frequency.exponentialRampToValueAtTime(4200, t + 0.45);
    n.connect(bq); envTo(c, bq, t, 0.2, 0.55, 0.15);
    n.start(t); n.stop(t + 0.6);
  }
  function setKeyMode(m) { keyMode = m; store.set("keys", m); renderSoundPicker(); keySound("key"); toast("keyboard sound: " + m); }
  function cycleKeyMode() { setKeyMode(KEY_MODES[(KEY_MODES.indexOf(keyMode) + 1) % KEY_MODES.length]); }
  function renderSoundPicker() {
    const el = $("#keySound");
    if (!el) return;
    el.innerHTML = `<span>keyboard sound</span>` + KEY_MODES.map((m) => `<button data-km="${m}" class="${m === keyMode ? "on" : ""}">${m}</button>`).join("");
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-km]"); if (b) setKeyMode(b.dataset.km); });

  /* ---------------- score / accuracy / mods ---------------- */
  const stats = { n300: 0, n100: 0, n50: 0, miss: 0, score: 0, maxCombo: 0, t0: Date.now(), seen: new Set(), mods: new Set() };
  const hitsTotal = () => stats.n300 + stats.n100 + stats.n50 + stats.miss;
  const accuracy = () => { const n = hitsTotal(); return n ? (300 * stats.n300 + 100 * stats.n100 + 50 * stats.n50) / (300 * n) : 1; };
  // osu!-standard style ranking (by share of 300s, 50s and misses)
  function grade() {
    const n = hitsTotal();
    if (!n) return "SS";
    const p300 = stats.n300 / n, p50 = stats.n50 / n;
    if (p300 === 1) return "SS";
    if (p300 > 0.9 && p50 < 0.01 && !stats.miss) return "S";
    if ((p300 > 0.8 && !stats.miss) || p300 > 0.9) return "A";
    if ((p300 > 0.7 && !stats.miss) || p300 > 0.8) return "B";
    if (p300 > 0.6) return "C";
    return "D";
  }
  const MODS = { HT: "half time — even more slowed", DT: "double time", NC: "nightcore", FL: "flashlight", AT: "autopilot — auto-scroll the page" };
  const mods = new Set((store.get("mods", []) || []).filter((m) => m in MODS));
  const modMult = () => [...mods].reduce((k, m) => k * ({ HT: 0.5, DT: 1.12, NC: 1.12, FL: 1.12, AT: 1 }[m] || 1), 1);
  function applyMods() {
    const rate = mods.has("HT") ? 0.75 : mods.has("DT") || mods.has("NC") ? 1.5 : 1;
    const keepPitch = !(mods.has("NC") || mods.has("HT"));
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    audio.preservesPitch = keepPitch; audio.mozPreservesPitch = keepPitch; audio.webkitPreservesPitch = keepPitch;
    Object.keys(MODS).forEach((m) => body.classList.toggle("mod-" + m, mods.has(m)));
    $("#hudMods").innerHTML = [...mods].map((m) => `<span class="mod">${m}</span>`).join("");
    mods.forEach((m) => stats.mods.add(m));
    store.set("mods", [...mods]);
  }
  function toggleMod(m) {
    if (mods.has(m)) mods.delete(m);
    else {
      mods.add(m);
      const ex = { HT: ["DT", "NC"], DT: ["HT", "NC"], NC: ["HT", "DT"] }[m] || [];
      ex.forEach((x) => mods.delete(x));
    }
    applyMods();
    toast(`${m} ${mods.has(m) ? "on" : "off"} · ${MODS[m]}`);
  }
  let atPauseUntil = 0;
  addEventListener("wheel", () => (atPauseUntil = Date.now() + 2500), { passive: true });
  addEventListener("touchmove", () => (atPauseUntil = Date.now() + 2500), { passive: true });

  /* ---------------- main loop ---------------- */
  const scoreEl = $("#score"), accEl = $("#acc"), flEl = $("#flashlight"), fpsEl = $("#fps");
  let dispScore = 0, lastNow = 0, fpsOn = store.get("fps", false), fpsAcc = 0, fpsN = 0, fpsT = 0, fpsWorst = 0;
  function setFps(on) { fpsOn = on; store.set("fps", on); fpsEl.hidden = !on; fpsAcc = fpsN = fpsWorst = 0; }
  // osu!-style frame counter: average fps, average + worst frame time, and the 3D render
  // resolution the adaptive quality settled on. Green ≥ 90% of the display's refresh rate.
  function fpsFrame(now, ldt) {
    fpsAcc += ldt; fpsN++; fpsWorst = Math.max(fpsWorst, ldt);
    if (now - fpsT < 500 || !fpsN) return;
    const ms = fpsAcc / fpsN, fps = 1000 / ms, g = window.__gfx || {};
    const hz = g.refresh ? 1 / g.refresh : 60;
    fpsEl.className = "hud-fps mono " + (fps >= hz * 0.9 ? "ok" : fps >= hz * 0.6 ? "meh" : "bad");
    fpsEl.innerHTML = `<b>${Math.round(fps)}</b> fps <span>${ms.toFixed(1)}ms · worst ${fpsWorst.toFixed(1)}ms${g.pr ? ` · 3d res ${Math.round((g.pr / (devicePixelRatio || 1)) * 100)}%` : ""}</span>`;
    fpsAcc = fpsN = fpsWorst = 0; fpsT = now;
  }
  function loop(now) {
    const ldt = lastNow ? Math.min(250, now - lastNow) : 16.7;
    lastNow = now;
    if (fpsOn) fpsFrame(now, ldt);
    // cursor
    if (Math.abs(mx - rx) + Math.abs(my - ry) + Math.abs(mx - gx) + Math.abs(my - gy) > 0.2) {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      gx += (mx - gx) * 0.07; gy += (my - gy) * 0.07;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      if (fxOn && !body.classList.contains("gl")) glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
    }
    audioFrame();
    drawFx(now);
    // score roll
    if (Math.abs(stats.score - dispScore) > 0.5) {
      dispScore += (stats.score - dispScore) * 0.12;
      scoreEl.textContent = String(Math.round(dispScore)).padStart(8, "0");
    }
    const accTxt = (accuracy() * 100).toFixed(2) + "%";
    if (accEl.textContent !== accTxt) accEl.textContent = accTxt;
    if (mods.has("FL")) { const hm = body.classList.contains("has-mouse"); flEl.style.setProperty("--flx", (hm ? mx : innerWidth / 2) + "px"); flEl.style.setProperty("--fly", (hm ? my : innerHeight / 2) + "px"); }
    if (mods.has("AT") && !navigating && !body.classList.contains("is-intro") && Date.now() > atPauseUntil && pal.hidden) window.scrollBy({ top: 1.4 * Math.min(4, ldt / 16.7), behavior: "instant" });
    requestAnimationFrame(loop);
  }

  /* ---------------- palette ---------------- */
  const pal = $("#palette"), palInput = $("#palInput"), palList = $("#palList");
  const actions = [
    { t: "play / pause music", f: "m", run: toggleMusic, on: () => isPlaying() },
    { t: "toggle effects", f: "fx", run: toggleFx, on: () => fxOn },
    { t: "fps counter", f: "f", run: () => setFps(!fpsOn), on: () => fpsOn, keep: true },
    ...Object.keys(MODS).map((m) => ({ t: `mod ${m} · ${MODS[m]}`, f: m, run: () => toggleMod(m), on: () => mods.has(m), keep: true })),
    { t: () => `keyboard sound: ${keyMode} (cycle)`, f: "keys", run: cycleKeyMode, keep: true },
    { t: "hit sounds", f: "sfx", run: () => { hitOn = !hitOn; store.set("hits", hitOn); toast("hit sounds " + (hitOn ? "on" : "off")); }, on: () => hitOn, keep: true },
    { t: "show my results", f: "results", run: () => go("results") },
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
    const acts = actions.map((a) => ({ kind: "action", n: "›", ...a, t: typeof a.t === "function" ? a.t() : a.t, isOn: a.on ? a.on() : null }));
    const score = (it) => Math.max(fuzzy(q, it.t), fuzzy(q, it.f), fuzzy(q, it.n));
    const fs = secs.filter((it) => score(it) > 0), fa = acts.filter((it) => score(it) > 0);
    if (q) { fs.sort((a, b) => score(b) - score(a)); fa.sort((a, b) => score(b) - score(a)); }
    palItems = [...fs, ...fa];
    palSel = clamp(palSel, 0, Math.max(0, palItems.length - 1));
    let html = "", idx = 0;
    const row = (it) => `<li role="option" data-i="${idx}" class="${idx++ === palSel ? "sel" : ""}" aria-selected="${idx - 1 === palSel}"><span class="n">${esc(it.n)}</span><span class="t">${esc(it.t)}</span>${it.isOn ? '<span class="on-badge">ON</span>' : ""}<span class="f">${esc(it.f)}</span></li>`;
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
  function runPal(i) {
    const it = palItems[i];
    if (!it) return;
    if (it.keep) { it.run(); renderPal(); return; } // toggles keep the menu open
    closePal(); it.run();
  }
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
    else if (e.key === "f" || e.key === "F") setFps(!fpsOn);
    else if (e.key === "j") go(sections[Math.min(activeIdx + 1, sections.length - 1)].id);
    else if (e.key === "k") go(sections[Math.max(activeIdx - 1, 0)].id);
  });

  /* ---------------- intro: tune into the signal ---------------- */
  const intro = $("#intro");
  let entered = false, enteredAt = 0, overTuner = false;
  const tunerBtn = $("#introGo");
  {
    const roles = (C.roles || []).filter(has).map((r) => r.replace(/^(an?|the)\s+/i, "").toUpperCase());
    const bandText = `  ${(C.name || "").toUpperCase()}  ✦  ${roles.join("  ✦  ")}  ✦  SIGNAL FROM NOISE  ✦`;
    $$(".band-track", intro).forEach((t) => (t.textContent = bandText.repeat(6)));
    let ticks = "";
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, major = i % 10 === 0, r1 = 146, r2 = major ? 132 : 139;
      ticks += `<line x1="${(150 + Math.cos(a) * r1).toFixed(1)}" y1="${(150 + Math.sin(a) * r1).toFixed(1)}" x2="${(150 + Math.cos(a) * r2).toFixed(1)}" y2="${(150 + Math.sin(a) * r2).toFixed(1)}" stroke="${major ? "#4fe3ff" : "rgba(255,255,255,.35)"}" stroke-width="${major ? 2.2 : 1}"/>`;
    }
    $("#tunerTicks").innerHTML = ticks;
    tunerBtn.addEventListener("pointerenter", () => (overTuner = true));
    tunerBtn.addEventListener("pointerleave", () => (overTuner = false));
    tunerBtn.addEventListener("focus", () => (overTuner = true));
    tunerBtn.addEventListener("blur", () => (overTuner = false));
  }
  const wave = $("#introWave"), wctx = wave.getContext("2d");
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let noiseLvl = 1.6, lastReadout = 0;
  const introT0 = performance.now();
  const sigBars = $$("#sigBars i");
  let waveW = 0, waveH = 0; // from a ResizeObserver: clientWidth in the frame forced a layout each frame
  new ResizeObserver(() => { waveW = wave.clientWidth; waveH = wave.clientHeight; }).observe(wave);
  function introFrame(now) {
    if (entered && now - enteredAt > 1600) return;
    const w = waveW, h = waveH, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return requestAnimationFrame(introFrame);
    if (wave.width !== Math.round(w * dpr)) { wave.width = Math.round(w * dpr); wave.height = Math.round(h * dpr); }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, w, h);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let target;
    if (entered) target = 0.0;
    else if (overTuner) target = 0.03;
    else if (body.classList.contains("has-mouse")) target = clamp((Math.hypot(mx - cx, my - cy) - 110) / (Math.hypot(cx, cy) - 110), 0.05, 1) * 1.6;
    else target = Math.max(0.08, 1.6 * (1 - (now - introT0) / 5000)); // touch: tunes itself
    const fdt = Math.min(0.1, (now - (introFrame._t || now)) / 1000);
    introFrame._t = now;
    noiseLvl += (target - noiseLvl) * (1 - Math.exp(-fdt * 4.5));
    const sigma = Math.max(0.004, noiseLvl * 0.55); // noise std, relative to unit signal amplitude
    const amp = h * 0.2, t = now / 1000;
    const pass = (noisy, style, lw) => {
      wctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const env = Math.pow(Math.sin((Math.PI * x) / w), 1.4);
        const y = h / 2 - env * amp * (Math.sin((x / w) * Math.PI * 2 * 7 - t * 2.2) + (noisy ? sigma * gauss() : 0));
        x ? wctx.lineTo(x, y) : wctx.moveTo(x, y);
      }
      wctx.strokeStyle = style; wctx.lineWidth = lw; wctx.stroke();
    };
    const clean = 1 - Math.min(1, noiseLvl / 1.6);
    pass(false, `rgba(79,227,255,${0.1 + 0.55 * clean})`, 2);
    pass(true, `rgba(255,255,255,${0.25 + 0.35 * (1 - clean)})`, 1.2);
    if (now - lastReadout > 90) {
      lastReadout = now;
      const snr = 0.5 / (sigma * sigma); // signal power A²/2 with A = 1, noise power σ²
      const db = 10 * Math.log10(snr);
      const lock = clamp((db + 2) / 28, 0, 1);
      $("#introPct").textContent = "lock " + Math.round(lock * 100) + "%";
      sigBars.forEach((b, i) => b.classList.toggle("on", i < Math.round(lock * 5)));
      const k = $("#introKicker");
      const locked = db > 20;
      if (k._l !== locked) { k._l = locked; k.classList.toggle("locked", locked); scramble(k, locked ? "signal acquired" : "searching for signal", { dur: 400 }); }
    }
    requestAnimationFrame(introFrame);
  }
  requestAnimationFrame(introFrame);

  function enter(withSound) {
    if (entered) return;
    entered = true;
    enteredAt = performance.now();
    if (withSound) play();
    else getCtx();
    whoosh();
    intro.classList.add("enter");
    if (window.__sceneEnter) window.__sceneEnter();
    const c = tunerBtn.getBoundingClientRect();
    hit(c.left + c.width / 2, c.top + c.height / 2, "300");
    setTimeout(() => intro.classList.add("gone"), 700);
    setTimeout(() => {
      intro.classList.add("hidden");
      body.classList.remove("is-intro");
      startHero();
      if (location.hash.length > 1) { const tg = document.getElementById(location.hash.slice(1)); if (tg) tg.scrollIntoView(); }
    }, 1500);
  }
  tunerBtn.addEventListener("click", () => enter(true));
  $("#introSilent").addEventListener("click", () => enter(false));
  {
    const words = (C.name || "").split(/\s+/).filter(Boolean);
    setTimeout(() => scramble($("#introA"), words[0] || "", { dur: 1300 }), 200);
    setTimeout(() => scramble($("#introB"), words.slice(1).join(" "), { dur: 1300 }), 450);
  }

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
    let ax = 0.3, ay = 0, vx = 0.0016, vy = 0.004, drag = null, visible = false, R = 175, last = performance.now();
    const lastOp = new Array(n).fill(-1);
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(wrap);
    // radius from a ResizeObserver: reading clientWidth inside the frame forced a layout every frame
    new ResizeObserver(() => (R = wrap.clientWidth < 420 ? 125 : 175)).observe(wrap);
    wrap.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag) return;
      vy = (e.clientX - drag.x) * 0.0009; vx = -(e.clientY - drag.y) * 0.0009;
      drag = { x: e.clientX, y: e.clientY };
    });
    wrap.addEventListener("pointerup", () => (drag = null));
    wrap.addEventListener("pointercancel", () => (drag = null));
    const frame = (now) => {
      const f = Math.min(6, (now - last) / (1000 / 60)); // 60 fps-tuned speeds, same at any refresh rate
      last = now;
      if (visible) {
        ax += vx * f; ay += vy * f;
        if (!drag) { const e = 1 - Math.pow(0.98, f); vx += (0.0016 - vx) * e; vy += (0.004 - vy) * e; }
        const b = window.__beat || 0;
        const sx = Math.sin(ax), cx = Math.cos(ax), sy = Math.sin(ay), cy = Math.cos(ay);
        for (let i = 0; i < n; i++) {
          let [x, y, z] = pts[i];
          const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
          const rr = R * (1 + b * 0.06);
          const depth = (z2 + 1) / 2;
          const s = spans[i];
          // preserve-3d already depth-sorts by z, so no z-index writes (they restacked the
          // whole sphere every frame); opacity is only written when it visibly changes
          s.style.transform = `translate3d(${(x1 * rr).toFixed(1)}px, ${(y2 * rr).toFixed(1)}px, ${(z2 * rr).toFixed(1)}px) translate(-50%, -50%)`;
          const op = Math.round((0.15 + depth * 0.85) * 50) / 50;
          if (op !== lastOp[i]) { lastOp[i] = op; s.style.opacity = op; }
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

  })();

  // your thoughts (research section)
  (() => {
    if (has(C.thoughtsTitle)) $("#thoughtsTitle").textContent = C.thoughtsTitle;
    const paras = (C.thoughts || []).filter(has);
    $("#thoughts").innerHTML = paras.length ? paras.map((p) => `<p>${mdInline(p)}</p>`).join("") : `<p>${todo("your thoughts — write them in config.js → thoughts")}</p>`;
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

  // projects — curated in config.js, nothing auto-pulled
  (() => {
    const el = $("#repos");
    const list = (C.projects || []).filter((p) => p && (C.showTodos !== false || has(p.title)));
    if (!list.length) { el.innerHTML = `<div class="placeholder">${todo("add your projects in config.js → projects")}</div>`; return; }
    const stLabel = { done: "shipped", doing: "in progress", blocked: "blocked", idea: "idea" };
    el.innerHTML = list
      .map((p, i) => {
        const st = ["done", "doing", "blocked", "idea"].includes(p.status) ? p.status : "idea";
        const link = safeUrl(p.link);
        const repo = /^[\w.-]+\/[\w.-]+$/.test(String(p.repo || "").trim()) ? String(p.repo).trim() : "";
        const tags = (p.tags || []).filter(has);
        return `<article class="proj${p.featured ? " featured" : ""}" data-reveal>
          <div class="proj-top mono"><span class="proj-n">${String(i + 1).padStart(2, "0")}</span><span class="tag ${st === "done" ? "proven" : st === "doing" ? "conjecture" : st === "blocked" ? "open" : ""}"><i class="st ${st}"></i>${stLabel[st]}</span>${has(p.year) ? `<span class="dim">${esc(p.year)}</span>` : ""}</div>
          <h4>${or(p.title, "project title")}</h4>
          <p>${or(p.blurb, "what it is, in a sentence or two")}</p>
          ${tags.length ? `<div class="proj-tags mono">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : C.showTodos !== false ? `<div class="proj-tags mono">${todo("tags")}</div>` : ""}
          <div class="proj-links mono">
            ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">open ↗</a>` : ""}
            ${repo ? `<a href="https://github.com/${esc(repo)}" target="_blank" rel="noopener">source ↗</a><span class="dim" data-stars="${esc(repo)}"></span>` : ""}
          </div>
        </article>`;
      })
      .join("");
    reveal(el);
    // optional live star counts for projects that name a repo
    $$("[data-stars]", el).forEach(async (s) => {
      try { const r = await gh(`/repos/${s.dataset.stars}`); s.textContent = `★ ${r.stargazers_count}`; } catch { /* keep quiet */ }
    });
  })();

  // embedded pages are mounted only while near the viewport and taken out when far away:
  // a live site in an iframe keeps animating (and costing frames) even when scrolled off
  const frameIO = new IntersectionObserver((ents) => ents.forEach((e) => {
    const box = e.target, cur = box.querySelector("iframe");
    if (e.isIntersecting && !cur) {
      const f = document.createElement("iframe");
      f.src = box.dataset.frameSrc; f.title = box.dataset.frameTitle || ""; f.referrerPolicy = "no-referrer";
      box.appendChild(f);
    } else if (!e.isIntersecting && cur) box.removeChild(cur);
  }), { rootMargin: "500px 0px" });
  const lazyFrames = (scope) => $$("[data-frame-src]", scope).forEach((b) => frameIO.observe(b));

  // ledger
  (async () => {
    const el = $("#ledgerBody");
    const L = C.ledger || {};
    const site = safeUrl(L.site);
    const btns = site
      ? `<div class="ledger-cta" data-reveal>${(L.links || [])
          .map((l) => `<a class="btn${l.primary ? " btn-hi" : ""}" href="${esc(site + (l.hash ? "#" + encodeURIComponent(l.hash) : ""))}" target="_blank" rel="noopener">${esc(l.label)} ${l.primary ? "♥" : "↗"}</a>`)
          .join("")}<a class="btn btn-ghost mono" href="${esc(site)}" target="_blank" rel="noopener">open the ledger ↗</a></div>`
      : "";
    const embed = site
      ? `<div class="panel ledger-live" data-reveal>
          <div class="panel-head mono"><span><span class="dot-live"></span> live · ${esc(site.replace(/^https?:\/\//, ""))}</span><a href="${esc(site)}" target="_blank" rel="noopener">full screen ↗</a></div>
          <div class="ledger-frame" data-frame-src="${esc(site)}" data-frame-title="Ledger: donations, expenses and receipts"></div>
        </div>`
      : "";
    const about = `${has(L.about) ? `<p class="lead">${esc(L.about)}</p>` : `<p class="lead">${todo("ledger.about — what is the ledger?")}</p>`}
      <p class="ledger-why">${has(L.why) ? esc(L.why) : todo("ledger.why — what support goes toward")}</p>${btns}${embed}
      <h3 class="sub" data-reveal><span class="h-mark">###</span> built in public</h3>`;
    if (!has(L.repo)) {
      el.innerHTML = `${about}<div class="placeholder" data-reveal>$ git clone <b>&lt;ledger&gt;</b><br>${todo("set ledger.repo in config.js — e.g. \"Ahmadhussain0033/ledger\"")}</div>`;
      reveal(el);
      lazyFrames(el);
      return;
    }
    el.innerHTML = `${about}<div class="loading mono">reading ${esc(L.repo)}<span class="dots"></span></div>`;
    lazyFrames(el);
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
      lazyFrames(el);
    } catch (err) {
      el.innerHTML = `${about}<div class="placeholder">couldn't load ${esc(L.repo)} (${esc(err.message)})</div>`;
      lazyFrames(el);
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
          ${!locked && url && has(a.linkLabel) ? `<a class="medal-link mono" href="${esc(url)}" target="_blank" rel="noopener">${esc(a.linkLabel)} ↗</a>` : ""}
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

  /* ---------------- persona-style date ---------------- */
  function fillDates() {
    const d = new Date(), h = d.getHours();
    const md = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    const wd = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d.getDay()];
    const ph = h < 5 ? "late night" : h < 8 ? "early morning" : h < 12 ? "morning" : h < 14 ? "midday" : h < 17 ? "afternoon" : h < 20 ? "evening" : "night";
    $$(".pdate").forEach((el) => (el.innerHTML = `<span class="md">${md}</span><span class="wd">${wd}</span><span class="ph">${ph}</span>`));
  }
  fillDates();
  setInterval(fillDates, 60000);

  /* ---------------- typing feel: sounds, pops, live wpm (all inputs) ---------------- */
  let mirror = null;
  function caretXY(el) {
    let pos = null;
    try { pos = el.selectionEnd; } catch { pos = null; }
    if (pos == null) pos = (el.value || "").length;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!mirror) { mirror = document.createElement("div"); mirror.setAttribute("aria-hidden", "true"); document.body.appendChild(mirror); }
    ["boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textTransform", "wordSpacing", "tabSize"].forEach((k) => (mirror.style[k] = cs[k]));
    Object.assign(mirror.style, { position: "absolute", visibility: "hidden", top: "0", left: "-9999px", height: "auto", overflow: "hidden", borderStyle: "solid",
      whiteSpace: el.tagName === "TEXTAREA" ? "pre-wrap" : "pre", overflowWrap: "break-word" });
    mirror.textContent = (el.value || "").slice(0, pos);
    const sp = document.createElement("span");
    sp.textContent = "​";
    mirror.appendChild(sp);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 18;
    return { x: clamp(r.left + sp.offsetLeft - el.scrollLeft, r.left + 4, r.right - 4), y: clamp(r.top + sp.offsetTop - el.scrollTop + lh / 2, r.top + 4, r.bottom - 4) };
  }
  const typeTimes = [];
  const hudWpm = $("#hudWpm"), hudWpmN = $("#hudWpmN");
  let wpmHideT;
  function bumpWpm() {
    const now = performance.now();
    typeTimes.push(now);
    while (typeTimes.length && now - typeTimes[0] > 8000) typeTimes.shift();
    if (typeTimes.length >= 4) {
      const mins = Math.max(1500, now - typeTimes[0]) / 60000;
      const w = Math.round(typeTimes.length / 5 / mins);
      hudWpmN.textContent = w;
      if (typeTimes.length >= 15) stats.bestWpm = Math.max(stats.bestWpm || 0, w);
      hudWpm.classList.add("show");
    }
    clearTimeout(wpmHideT);
    wpmHideT = setTimeout(() => { hudWpm.classList.remove("show"); typeTimes.length = 0; }, 2500);
  }
  function pulse(el) { el.classList.remove("typing-pulse"); void el.offsetWidth; el.classList.add("typing-pulse"); }
  document.addEventListener("keydown", (e) => {
    const el = e.target;
    if (!editable(el) || e.ctrlKey || e.metaKey || e.altKey) return;
    let kind = null;
    if (e.key.length === 1) kind = e.key === " " ? "space" : "key";
    else if (e.key === "Backspace") kind = "back";
    else if (e.key === "Enter") kind = "enter";
    if (!kind) return;
    keySound(kind);
    if (el.type === "range" || el.type === "radio" || el.type === "checkbox") return;
    pulse(el);
    if (kind === "key" || kind === "space") bumpWpm();
    if (fxOn && kind === "key") requestAnimationFrame(() => { const p = caretXY(el); charPops.push({ x: p.x, y: p.y, ch: e.key, t: performance.now(), vx: (Math.random() - 0.5) * 30 }); });
  }, true);


  /* ---------------- smooth caret (monkeytype-style) ---------------- */
  const scaret = $("#scaret");
  const caretable = (el) => el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|email|search|url|tel|password|)$/.test(el.type)));
  let caretEl = null, caretIdle;
  function moveCaret() {
    if (!caretEl || !fxOn || !finePointer) return;
    const p = caretXY(caretEl);
    const cs = getComputedStyle(caretEl);
    const h = Math.round((parseFloat(cs.fontSize) || 16) * 1.25);
    scaret.style.height = h + "px";
    scaret.style.transform = `translate3d(${p.x - 1}px, ${p.y - h / 2}px, 0)`;
    scaret.classList.add("moving");
    clearTimeout(caretIdle);
    caretIdle = setTimeout(() => scaret.classList.remove("moving"), 450);
  }
  document.addEventListener("focusin", (e) => {
    if (!caretable(e.target) || !fxOn || !finePointer) return;
    caretEl = e.target;
    caretEl.classList.add("own-caret");
    scaret.classList.add("on");
    requestAnimationFrame(moveCaret);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target !== caretEl) return;
    caretEl.classList.remove("own-caret");
    caretEl = null;
    scaret.classList.remove("on");
  });
  ["input", "keyup", "click", "select"].forEach((ev) => document.addEventListener(ev, (e) => { if (e.target === caretEl) requestAnimationFrame(moveCaret); }));
  document.addEventListener("selectionchange", () => { if (caretEl && document.activeElement === caretEl) requestAnimationFrame(moveCaret); });
  addEventListener("scroll", () => { if (caretEl) moveCaret(); }, { passive: true });
  document.addEventListener("scroll", (e) => { if (e.target === caretEl) moveCaret(); }, true);

  /* ---------------- results screen ---------------- */
  (() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el.textContent !== String(v)) el.textContent = v; };
    const gEl = $("#resGrade");
    let visible = false;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe($("#results"));
    function update() {
      if (!visible) return;
      const g = grade();
      if (gEl.textContent !== g) { gEl.textContent = g; gEl.className = "grade-big g-" + g; }
      set("resGradeNote", hitsTotal() ? `${hitsTotal()} hits judged` : "click anything to start");
      set("resScore", String(stats.score).padStart(8, "0"));
      set("r300", stats.n300); set("r100", stats.n100); set("r50", stats.n50); set("rMiss", stats.miss);
      set("rAcc", (accuracy() * 100).toFixed(2) + "%");
      set("rCombo", stats.maxCombo + "x");
      set("rExplored", `${stats.seen.size} / ${sections.length}`);
      const secs = Math.floor((Date.now() - stats.t0) / 1000);
      set("rTime", `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
      const bw = Math.round(stats.bestWpm || 0);
      set("rWpm", bw ? bw + " wpm" : "—");
      set("rMods", stats.mods.size ? [...stats.mods].join(" ") : "none");
    }
    setInterval(update, 400);
    $("#resRetry").addEventListener("click", () => {
      Object.assign(stats, { n300: 0, n100: 0, n50: 0, miss: 0, score: 0, maxCombo: 0, t0: Date.now() });
      stats.seen = new Set([sections[activeIdx].id]);
      stats.mods = new Set(mods);
      combo = 0; comboN.textContent = "0";
      toast("retrying…");
    });
  })();

  /* ---------------- boot ---------------- */
  addEventListener("resize", resize);
  resize();
  applyMods();
  setFps(fpsOn);
  renderSoundPicker();
  reveal();
  onScroll();
  requestAnimationFrame(loop);
  if (!finePointer) body.classList.remove("has-mouse");
  window.__site = { go, openPal, toggleMusic, isPlaying, hit, stats, grade, accuracy, toggleMod };
})();
