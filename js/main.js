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
  // tiny inline markdown: **bold**, *em*, `code`, [text](https://…), [text](#section)
  const mdInline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[(.+?)\]\(#([\w-]+)\)/g, '<a href="#$2" data-nav>$1</a>');

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
  // typing sound: one fixed voice (the picker was removed; the other voices stay in keySound for later)
  const keyMode = "click";
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
    if (!hitOn) return;
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
    const worst = Math.min(fps, g.fps || fps); // colour by whichever is slower
    fpsEl.className = "hud-fps mono " + (worst >= hz * 0.9 ? "ok" : worst >= hz * 0.6 ? "meh" : "bad");
    // page fps (main thread) + the 3D's own fps — with the worker they run independently
    const g3 = g.fps ? `3d ${Math.round(g.fps)} fps${g.mode ? " · " + g.mode + " thread" : ""}` : "";
    const res = g.pr ? `res ${Math.round((g.pr / (devicePixelRatio || 1)) * 100)}%` : "";
    fpsEl.innerHTML = `<b>${Math.round(fps)}</b> fps <span>${ms.toFixed(1)}ms · worst ${fpsWorst.toFixed(1)}ms</span>${g3 ? `<span>${g3}${res ? " · " + res : ""}</span>` : ""}`;
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
    { t: "sound effects (hits + typing)", f: "sfx", run: () => { hitOn = !hitOn; store.set("hits", hitOn); toast("sound effects " + (hitOn ? "on" : "off")); }, on: () => hitOn, keep: true },
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
    const line = has(C.tagline) ? C.tagline : C.motto;
    if (!has(line)) { el.innerHTML = todo("tagline — set it in config.js"); return; }
    el.textContent = "";
    await sleep(900);
    for (const ch of line) {
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
  const stc = (st) => (["done", "doing", "blocked"].includes(st) ? st : "planned"); // never "todo": that's the placeholder style

  // about
  (() => {
    const photo = C.photo && (safeUrl(C.photo) || /^[\w./-]+\.(png|jpe?g|webp|gif|avif)$/i.test(C.photo)) ? C.photo : has(C.github) ? `https://github.com/${encodeURIComponent(C.github)}.png?size=320` : "";
    const img = $("#aboutPhoto");
    if (photo) img.src = photo; else img.parentElement.classList.add("empty");
    $("#aboutDot").className = "st " + ((C.availability || {}).status || "");
    $("#aboutName").textContent = C.name || "";
    $("#aboutHandle").textContent = has(C.handle) ? "@" + C.handle : "";
    if (has(C.motto)) $("#aboutMotto").textContent = C.motto;
    else $("#aboutMotto").remove();
    const hx = C.hexoro || {};
    $("#aboutTags").innerHTML = [C.pronouns, C.location].filter(has).map((t) => `<span>${esc(t)}</span>`).join("")
      + (has(hx.name) ? `<a href="#hexoro" data-nav>${esc(hx.name)}${has(hx.role) ? " · " + esc(hx.role) : ""}</a>` : "");
    const intro = has(C.intro) ? `<p class="about-intro">${mdInline(C.intro)}</p>` : "";
    $("#aboutText").innerHTML = intro + (C.about || []).filter(has).map((p) => `<p>${mdInline(p)}</p>`).join("");
    $("#facts tbody").innerHTML = (C.facts || []).filter((f) => has(f[1])).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");

    // at a glance: level (= age, ticks over on the birthday), local time, languages, what's being built
    const tiles = [];
    const A = C.age || {};
    if (Number(A.value) > 0) {
      let lvl = Number(A.value), sub = "", pct = null;
      const bd = /^(\d{2})-(\d{2})$/.exec(A.birthday || "");
      if (bd) {
        const mm = +bd[1] - 1, dd = +bd[2];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const asOf = new Date((A.asOf || "") + "T00:00:00");
        if (!isNaN(asOf)) for (let y = asOf.getFullYear(); y <= today.getFullYear(); y++) { const b = new Date(y, mm, dd); if (b > asOf && b <= today) lvl++; }
        let next = new Date(today.getFullYear(), mm, dd);
        if (next <= today) next = new Date(today.getFullYear() + 1, mm, dd);
        const prev = new Date(next.getFullYear() - 1, mm, dd);
        const days = Math.round((next - today) / 864e5);
        pct = ((today - prev) / (next - prev)) * 100;
        sub = +today === +prev ? "levelled up today" : `lv.${lvl + 1} in ${days} day${days === 1 ? "" : "s"}`;
      }
      tiles.push({ k: "level · = age", v: `lv.${lvl}`, sub, pct });
    }
    if (has(C.timezone)) tiles.push({ k: "local time" + (has(C.location) ? " · " + C.location.split(",")[0].toLowerCase() : ""), v: "—", sub: "", clock: true });
    const spoken = ((C.toolbox || {}).spoken || []).filter(has);
    if (spoken.length) tiles.push({ k: "speaks", v: `${spoken.length} language${spoken.length > 1 ? "s" : ""}`, sub: spoken.join(" · ") });
    const flag = (C.projects || []).find((p) => p && p.featured && has(p.title));
    if (flag) { const more = (C.projects || []).filter((p) => p && has(p.title)).length - 1; tiles.push({ k: "building", v: flag.title, sub: more > 0 ? `+ ${more} more in <a href="#work" data-nav>the work →</a>` : "", html: true }); }
    (C.glance || []).filter((g) => has(g.k) && has(g.v)).forEach((g) => tiles.push({ k: g.k, v: g.v, sub: g.sub || "" }));
    $("#glance").innerHTML = tiles
      .map((t) => `<div class="gl-tile panel" data-reveal><div class="gl-k mono">${esc(t.k)}</div><div class="gl-v"${t.clock ? ' id="glClock"' : ""}>${esc(t.v)}</div>${t.sub ? `<div class="gl-sub mono">${t.html ? t.sub : esc(t.sub)}</div>` : t.clock ? '<div class="gl-sub mono" id="glPhase"></div>' : ""}${t.pct != null ? `<div class="gl-bar"><i style="transform:scaleX(${(t.pct / 100).toFixed(3)})"></i></div>` : ""}</div>`)
      .join("");
    if ($("#glClock")) {
      let tf = null;
      try { tf = new Intl.DateTimeFormat([], { timeZone: C.timezone, hour: "2-digit", minute: "2-digit", hour12: false }); } catch { tf = null; }
      const hf = tf && new Intl.DateTimeFormat("en-GB", { timeZone: C.timezone, hour: "numeric", hour12: false });
      const t = () => {
        if (!tf) return;
        $("#glClock").textContent = tf.format(new Date());
        const h = +hf.format(new Date()) % 24;
        $("#glPhase").textContent = h < 5 ? "late night there · probably still up" : h < 8 ? "early morning there" : h < 12 ? "morning there" : h < 17 ? "afternoon there" : h < 21 ? "evening there" : "night there";
      };
      t(); setInterval(t, 15000);
    }

    // good at: osu-style hit circles, numbered in order
    const good = (C.goodAt || []).filter(has);
    if (good.length) $("#goodAt").innerHTML = good.map((g, i) => `<div class="skill" data-reveal><span class="hc mono">${i + 1}</span><b>${esc(g)}</b></div>`).join("");
    else { $("#goodAt").previousElementSibling.remove(); $("#goodAt").remove(); }

    const ask = (C.askMeAbout || []).filter(has);
    $("#askMe").innerHTML = ask.map((t) => `<a class="ask" href="#contact" data-nav data-ask="${esc(t)}">${esc(t)}</a>`).join("");
    if (!ask.length) $("#askMe").parentElement.remove();
    // clicking a topic jumps to the form with it pre-written
    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-ask]");
      if (!a) return;
      const m = $("#cfMsg");
      if (m && !m.value.trim()) { m.value = `hey! i wanted to ask you about ${a.dataset.ask}: `; m.dispatchEvent(new Event("input")); }
    });
    const j = (C.journey || []).filter((x) => has(x.text));
    $("#journey").innerHTML = j.map((x) => `<li data-reveal><span class="mono">${esc(x.when || "")}</span><span>${esc(x.text)}</span></li>`).join("");
    if (!j.length) $("#journey").parentElement.remove();
  })();

  // now — a small dashboard: the main focus, everything else in motion, and live widgets
  (() => {
    if (has(C.nowUpdated)) $("#nowUpdated").textContent = "· updated " + C.nowUpdated;
    const items = (C.now || []).filter((n) => n && has(n.text));
    const split = (t) => { const i = t.indexOf(":"); return i > 0 && i < 48 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [t.trim(), ""]; };
    const stLabel = { done: "done", doing: "in progress", blocked: "blocked" };
    const focus = items.find((n) => n.focus) || items[0];
    const card = (n) => {
      const [h, d] = split(n.text), st = esc(n.status || "");
      return `<article class="now-card" data-reveal><div class="now-st mono"><span class="box ${stc(n.status)}">${box(n.status)}</span>${esc(stLabel[n.status] || "")}</div><h4>${esc(h)}</h4>${d ? `<p>${esc(d)}</p>` : ""}</article>`;
    };
    const parts = [];
    if (focus) {
      const [h, d] = split(focus.text);
      parts.push(`<article class="now-focus panel" data-reveal>
        <div class="nf-label mono"><span class="dot-live"></span> main focus</div>
        <h3>${esc(h)}</h3>${d ? `<p>${esc(d)}</p>` : ""}
        <div class="nf-foot mono"><span class="box ${stc(focus.status)}">${box(focus.status)}</span> ${esc(stLabel[focus.status] || "")}${$("#work") ? ` · <a href="#work" data-nav>see it in the work →</a>` : ""}</div>
        <div class="nf-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      </article>`);
    }
    // widgets
    if (has(C.timezone)) parts.push(`<div class="now-w panel" data-reveal><div class="nw-k mono">local time</div><div class="nw-clock" id="nwClock">—</div><div class="nw-sub mono dim" id="nwDate"></div></div>`);
    items.filter((n) => n !== focus).forEach((n) => parts.push(card(n)));
    const think = ((C.interests || []).find((g) => g.group === "think") || {}).items || [];
    if (think.filter(has).length) parts.push(`<div class="now-w panel" data-reveal><div class="nw-k mono">on my mind</div><div class="nw-chips">${think.filter(has).map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>`);
    const nextPh = (C.roadmap || []).find((p) => !/^(now|always)$/i.test(String(p.when || "").trim()) && (p.items || []).some((i) => i.status !== "done" && has(i.text)));
    if (nextPh) {
      const nx = nextPh.items.filter((i) => i.status !== "done" && has(i.text)).slice(0, 3);
      parts.push(`<div class="now-w now-next panel" data-reveal><div class="nw-k mono">next up · ${esc(nextPh.when || "")}<a href="#roadmap" data-nav>roadmap →</a></div><ul>${nx.map((i) => `<li><span class="box ${stc(i.status)}">${box(i.status)}</span>${esc(i.text)}</li>`).join("")}</ul></div>`);
    }
    $("#nowGrid").innerHTML = parts.join("");
    if ($("#nwClock")) {
      let tf = null, df = null;
      try {
        tf = new Intl.DateTimeFormat([], { timeZone: C.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        df = new Intl.DateTimeFormat("en-GB", { timeZone: C.timezone, weekday: "long", day: "numeric", month: "short", timeZoneName: "short" });
      } catch { tf = null; }
      const t = () => { if (tf) { $("#nwClock").textContent = tf.format(new Date()); $("#nwDate").textContent = df.format(new Date()).toLowerCase(); } };
      t(); setInterval(t, 1000);
    }
  })();

  // interests → the drag-able word sphere (a widget in about)
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
    new ResizeObserver(() => (R = Math.min(150, Math.max(90, wrap.clientWidth * 0.36)))).observe(wrap);
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

  // the work — projects + research in one place (curated in config.js, nothing auto-pulled)
  const tabsFilter = (tabsEl, items, keyOf, label, onPick) => {
    // a row of filter tabs: "all" + every key present, with counts; onPick(key | "all")
    const keys = [...new Set(items.map(keyOf).filter(has))];
    if (keys.length < 2) { tabsEl.remove(); return; }
    const n = (k) => items.filter((x) => keyOf(x) === k).length;
    tabsEl.innerHTML = [["all", items.length], ...keys.map((k) => [k, n(k)])]
      .map(([k, c], i) => `<button role="tab" aria-selected="${i === 0}" data-k="${esc(k)}">${esc(label(k))}<span>${c}</span></button>`).join("");
    tabsEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]");
      if (!b) return;
      $$("button", tabsEl).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      onPick(b.dataset.k);
    });
  };
  const filterCards = (cards, keep) => cards.forEach((c, i) => {
    const show = keep(c);
    c.classList.toggle("filtered-out", !show);
    if (show) { c.style.setProperty("--i", i % 8); c.classList.remove("card-in"); void c.offsetWidth; c.classList.add("card-in"); }
  });
  (() => {
    const list = (C.projects || []).filter((p) => p && has(p.title));
    const KIND = { platform: ["PLT", "platform", "platforms"], research: ["RES", "research track", "research tracks"], software: ["SW", "software project", "software projects"], hardware: ["HW", "hardware build", "hardware builds"] };
    const kindOf = (p) => (KIND[p.kind] ? p.kind : "other");
    const stLabel = { done: "shipped", doing: "in progress", blocked: "blocked", idea: "idea" };
    const stOf = (p) => (["done", "doing", "blocked", "idea"].includes(p.status) ? p.status : "idea");
    const tagCls = (st) => (st === "done" ? "proven" : st === "doing" ? "conjecture" : st === "blocked" ? "open" : "");
    const links = (p) => {
      const link = safeUrl(p.link);
      const repo = /^[\w.-]+\/[\w.-]+$/.test(String(p.repo || "").trim()) ? String(p.repo).trim() : "";
      const h = (link ? `<a href="${esc(link)}" target="_blank" rel="noopener">open ↗</a>` : "") + (repo ? `<a href="https://github.com/${esc(repo)}" target="_blank" rel="noopener">source ↗</a><span class="dim" data-stars="${esc(repo)}"></span>` : "");
      return h ? `<div class="proj-links mono">${h}</div>` : "";
    };
    const tags = (p) => { const t = (p.tags || []).filter(has); return t.length ? `<div class="proj-tags mono">${t.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""; };

    // numbers across the top
    const counts = {};
    list.forEach((p) => (counts[kindOf(p)] = (counts[kindOf(p)] || 0) + 1));
    const active = list.filter((p) => stOf(p) === "doing").length;
    $("#workStats").innerHTML = [
      `<span><b>${list.length}</b> thing${list.length === 1 ? "" : "s"} on the bench</span>`,
      ...Object.keys(KIND).filter((k) => counts[k]).map((k) => `<span><b>${counts[k]}</b> ${KIND[k][counts[k] === 1 ? 1 : 2]}</span>`),
      active ? `<span><i class="st doing"></i><b>${active}</b> in progress</span>` : "",
    ].join("");

    // the flagship
    const flag = list.find((p) => p.featured);
    if (flag) {
      const st = stOf(flag);
      const pillars = (flag.pillars || []).filter(has);
      $("#flagship").innerHTML = `<article class="flagship panel" data-reveal>
        <div class="fl-main">
          <div class="fl-label mono"><span>flagship</span><span>${esc((KIND[kindOf(flag)] || [, "project"])[1])}</span>${has(flag.year) ? `<span>${esc(flag.year)}</span>` : ""}</div>
          <h3>${esc(flag.title)}</h3>
          <span class="tag ${tagCls(st)}"><i class="st ${st}"></i>${stLabel[st]}</span>
          <p>${esc(flag.blurb || "")}</p>
          ${tags(flag)}${links(flag)}
        </div>
        ${pillars.length ? `<ol class="fl-pillars">${pillars.map((x, i) => `<li><span class="mono">${String(i + 1).padStart(2, "0")}</span>${esc(x)}</li>`).join("")}</ol>` : ""}
        <div class="fl-rings" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </article>`;
    }

    // everything else, filterable by kind
    const rest = list.filter((p) => p !== flag);
    const grid = $("#workGrid");
    grid.innerHTML = rest
      .map((p, i) => {
        const st = stOf(p), k = kindOf(p);
        return `<article class="wk" data-kind="${esc(k)}" data-reveal>
          <span class="wk-n" aria-hidden="true">${String(i + 2).padStart(2, "0")}</span>
          <div class="wk-top mono"><span class="wk-kind" title="${esc((KIND[k] || [, k])[1])}">${esc((KIND[k] || ["··"])[0])}</span><span>${esc((KIND[k] || [, k])[1])}</span>${has(p.year) ? `<span class="dim">${esc(p.year)}</span>` : ""}</div>
          <h4>${esc(p.title)}</h4>
          <p>${esc(p.blurb || "")}</p>
          <div class="wk-foot"><span class="tag ${tagCls(st)}"><i class="st ${st}"></i>${stLabel[st]}</span>${tags(p)}</div>
          ${links(p)}
        </article>`;
      })
      .join("");
    const cards = $$(".wk", grid);
    tabsFilter($("#workTabs"), list, kindOf, (k) => k, (k) => {
      // the flagship is part of the filter too: it dims when its kind isn't picked
      const fl = $(".flagship");
      if (fl) fl.classList.toggle("dimmed", k !== "all" && kindOf(flag) !== k);
      filterCards(cards, (c) => k === "all" || c.dataset.kind === k);
    });
    if (!$("#workTabs")) $(".work-bar").remove();
    reveal($("#work"));
    // optional live star counts for projects that name a repo
    $$("[data-stars]", $("#work")).forEach(async (s) => {
      try { const r = await gh(`/repos/${s.dataset.stars}`); s.textContent = `★ ${r.stargazers_count}`; } catch { /* keep quiet */ }
    });

    // your thoughts + papers: only shown once there's something in them
    if (has(C.thoughtsTitle)) $("#thoughtsTitle").textContent = C.thoughtsTitle;
    const paras = (C.thoughts || []).filter(has);
    if (paras.length) $("#thoughts").innerHTML = paras.map((p) => `<p>${mdInline(p)}</p>`).join("");
    else { $("#thoughtsHead").remove(); $("#thoughts").remove(); }
    const papers = (C.papers || []).filter((p) => p && has(p.title));
    if (papers.length) {
      $("#papers").innerHTML = papers.map((p) => {
        const url = safeUrl(p.link);
        return `<div class="paper" data-reveal><span class="y">${esc(p.year || "")}</span><div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)} <span class="dim mono small">${esc(p.venue || "")}</span></div></div>`;
      }).join("");
    } else { $("#papersHead").remove(); $("#papers").remove(); }
  })();

  // hexoro — the company, and everything rolled out under it (projects with hexoro: true)
  (() => {
    const H = C.hexoro || {};
    const el = $("#hexoroBody");
    if (!el) return;
    const name = has(H.name) ? H.name : "Hexoro";
    const under = (C.projects || []).filter((p) => p && p.hexoro && has(p.title));
    const coming = (H.coming || []).filter(has);
    const stLabel = { done: "shipped", doing: "in progress", blocked: "blocked", idea: "idea" };
    const n2 = (i) => String(i + 1).padStart(2, "0");
    // a little README: the plan, as a markdown file with the steps drawn as a pipeline
    const RM = H.readme || {};
    const plan = (RM.plan || []).filter((s) => s && has(s.title));
    const readme = has(RM.intro) || plan.length ? `<article class="hx-readme panel" data-reveal>
        <div class="panel-head mono"><span>${esc(name.toLowerCase())}/README.md</span><span class="dim">${plan.length ? `${plan.length} steps` : ""}</span></div>
        <div class="hx-md">
          <h4><span class="h-mark">#</span> ${esc(name.toLowerCase())}</h4>
          ${has(RM.intro) ? `<p>${mdInline(RM.intro)}</p>` : ""}
          ${plan.length ? `<h5><span class="h-mark">##</span> the plan</h5>
          <ol class="hx-plan">${plan.map((s, i) => `<li><span class="hp-n mono">${n2(i)}</span><b>${esc(s.title)}</b>${has(s.text) ? `<span>${esc(s.text)}</span>` : ""}</li>`).join("")}</ol>` : ""}
        </div>
      </article>` : "";
    el.innerHTML = `<article class="hx panel" data-reveal>
        <div class="hx-id">
          <div class="hx-word" role="img" aria-label="${esc(name)}"><span aria-hidden="true">${esc(name)}</span><span aria-hidden="true">${esc(name)}</span><b aria-hidden="true">${esc(name)}</b></div>
          <div class="hx-role mono">${esc(C.name || "")}${has(H.role) ? " · " + esc(H.role) : ""}</div>
        </div>
        <div class="hx-body">
          <div class="hx-label mono"><span>the company</span><span>${under.length} under it${coming.length ? ` · ${coming.length} on the way` : ""}</span></div>
          ${has(H.tagline) ? `<h3>${esc(H.tagline)}</h3>` : ""}
          ${(H.about || []).filter(has).map((x) => `<p>${mdInline(x)}</p>`).join("")}
          <dl class="hx-kv">
            ${has(H.role) ? `<dt class="mono">${esc(H.role)}</dt><dd>${esc(C.name || "")}</dd>` : ""}
            ${has(H.team) ? `<dt class="mono">team</dt><dd>${esc(H.team)}</dd>` : ""}
          </dl>
        </div>
        <div class="hx-cells" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </article>
      ${readme}
      ${under.length || coming.length ? `<h3 class="sub" data-reveal><span class="h-mark">###</span> under ${esc(name.toLowerCase())}</h3>
      <div class="hx-grid">
        ${under.map((p, i) => `<a class="hx-item" href="#work" data-nav data-reveal>
            <span class="hx-hex mono">${n2(i)}</span>
            <span class="hx-txt"><span class="hx-k mono"><span>${esc(p.kind || "project")}</span><span><i class="st ${stc(p.status)}"></i>${esc(stLabel[p.status] || "idea")}</span></span>
            <b>${esc(p.title)}</b>${has(p.blurb) ? `<span class="hx-p">${esc(p.blurb)}</span>` : ""}</span>
          </a>`).join("")}
        ${coming.map((c) => `<div class="hx-item soon" data-reveal>
            <span class="hx-hex mono">+</span>
            <span class="hx-txt"><span class="hx-k mono"><span>on the way</span></span><b>${esc(c)}</b></span>
          </div>`).join("")}
      </div>` : ""}`;
  })();

  // embedded pages are mounted only while near the viewport and taken out when far away:
  // a live site in an iframe keeps animating (and costing frames) even when scrolled off
  const frameIO = new IntersectionObserver((ents) => ents.forEach((e) => {
    const box = e.target, cur = box.querySelector("iframe");
    if (e.isIntersecting && !cur) {
      const f = document.createElement("iframe");
      f.src = box.dataset.frameSrc; f.title = box.dataset.frameTitle || ""; f.referrerPolicy = "no-referrer";
      box.insertBefore(f, box.firstChild); // stays under the click-to-use cover
    } else if (!e.isIntersecting && cur) box.removeChild(cur);
  }), { rootMargin: "500px 0px" });
  // a click-to-use cover keeps the mouse wheel scrolling the page instead of the embedded
  // site; it comes back when the pointer leaves the frame
  const lazyFrames = (scope) => $$("[data-frame-src]", scope).forEach((b) => {
    frameIO.observe(b);
    if (b.querySelector(".frame-shield")) return;
    b.insertAdjacentHTML("beforeend", `<button class="frame-shield" type="button"><span class="mono">click to use the ledger here</span></button>`);
    b.querySelector(".frame-shield").addEventListener("click", () => b.classList.add("live"));
    b.addEventListener("pointerleave", () => b.classList.toggle("live", false));
  });

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

  // roadmap — the mission on top, then the plan as acts with progress
  (() => {
    const phases = (C.roadmap || []).filter((p) => p && (p.items || []).some((i) => has(i.text)));
    const always = phases.find((p) => /^always$/i.test(String(p.when || "").trim()));
    const acts = phases.filter((p) => p !== always);
    if (always) {
      const m = always.items.filter((i) => has(i.text));
      $("#mission").innerHTML = `<div class="ms-label mono"><span>${esc(always.title || "the mission")}</span><span>${esc(always.when)}</span></div>
        ${m.map((i) => `<p class="ms-text">${esc(i.text)}</p>`).join("")}
        <div class="ms-scan" aria-hidden="true"></div>`;
    } else $("#mission").remove();

    // where the year is + totals
    const now = new Date(), y = now.getFullYear();
    const y0 = new Date(y, 0, 1), y1 = new Date(y + 1, 0, 1);
    const pct = ((now - y0) / (y1 - y0)) * 100;
    const left = Math.ceil((y1 - now) / 864e5);
    const all = acts.flatMap((p) => p.items.filter((i) => has(i.text)));
    const c = (st) => all.filter((i) => stc(i.status) === st).length;
    $("#roadMeta").innerHTML = `
      <div class="rm-year panel"><div class="rm-k mono"><span>${y}</span><span>${Math.floor(pct)}% through · ${left} day${left === 1 ? "" : "s"} to ${y + 1}</span></div><div class="rm-bar"><i style="transform:scaleX(${(pct / 100).toFixed(4)})"></i></div></div>
      <div class="rm-counts mono">
        <span><b>${all.length}</b> goals</span>
        <span><i class="st doing"></i><b>${c("doing")}</b> in progress</span>
        <span><i class="st planned"></i><b>${c("planned")}</b> planned</span>
        <span><i class="st done"></i><b>${c("done")}</b> done</span>
        ${c("blocked") ? `<span><i class="st blocked"></i><b>${c("blocked")}</b> blocked</span>` : ""}
      </div>`;

    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    const R = 26, L = 2 * Math.PI * R;
    $("#acts").innerHTML = acts
      .map((p, k) => {
        const items = p.items.filter((i) => has(i.text));
        const done = items.filter((i) => i.status === "done").length;
        const doing = items.filter((i) => i.status === "doing").length;
        const agg = items.some((i) => i.status === "blocked") ? "blocked" : doing ? "doing" : done === items.length ? "done" : "planned";
        const f = items.length ? done / items.length : 0, g = items.length ? doing / items.length : 0;
        const arc = (cls, frac, off) => (frac > 0 ? `<circle cx="32" cy="32" r="${R}" class="${cls}" style="stroke-dasharray:${Math.max(0.1, L * frac - 4).toFixed(1)} ${L.toFixed(1)};stroke-dashoffset:${(-L * off).toFixed(1)}"/>` : "");
        return `<article class="act panel ${agg}" data-reveal>
          <div class="act-top">
            <div><div class="act-n mono">act ${ROMAN[k] || k + 1} · ${esc(p.when || "")}</div><h4>${esc(p.title || "")}</h4></div>
            <svg class="ring" viewBox="0 0 64 64" aria-label="${done} of ${items.length} done, ${doing} in progress"><circle cx="32" cy="32" r="${R}" class="rg-bg"/>${arc("rg-fg", f, 0)}${arc("rg-doing", g, f)}<text x="32" y="36" text-anchor="middle">${done}/${items.length}</text></svg>
          </div>
          <ul class="quests">${items.map((i) => `<li class="${stc(i.status)}"><span class="box ${stc(i.status)}">${box(i.status)}</span><span>${esc(i.text)}</span></li>`).join("")}</ul>
          <div class="act-foot mono dim">${doing ? `${doing} in progress` : done === items.length ? "complete" : "not started yet"}${k < acts.length - 1 ? '<span class="act-arrow">→</span>' : ""}</div>
        </article>`;
      })
      .join("");
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

  // toolbox — one card per category, or the raw object as toolbox.json
  (() => {
    const tb = C.toolbox || {};
    const keys = Object.keys(tb).filter((k) => (tb[k] || []).some(has));
    const total = keys.reduce((n, k) => n + tb[k].filter(has).length, 0);
    $("#tbLead").insertAdjacentHTML("beforeend", ` <span class="mono dim small">· ${total} things across ${keys.length} categories</span>`);
    $("#tbGrid").innerHTML = keys
      .map((k) => {
        const vals = tb[k].filter(has);
        return `<div class="tb panel" data-reveal><div class="panel-head mono"><span>${esc(k)}</span><span class="dim">${vals.length}</span></div>
          <div class="tb-items">${vals.map((v) => `<span class="tool"><i class="mono">${esc(v.replace(/[^\p{L}\p{N}+#]/gu, "").slice(0, 2))}</i>${esc(v)}</span>`).join("")}</div></div>`;
      })
      .join("");
    // toolbox.json view
    const lines = [`<span class="tk-p">{</span>`];
    keys.forEach((k, ki) => {
      const vals = tb[k].filter(has);
      const str = (v) => `<span class="tk-s">"${esc(v)}"</span>`;
      const sep = '<span class="tk-p">, </span>';
      const end = `<span class="tk-p">]${ki < keys.length - 1 ? "," : ""}</span>`;
      const head = `  <span class="tk-k">"${esc(k)}"</span><span class="tk-p">: [</span>`;
      if (vals.length <= 6) { lines.push(head + vals.map(str).join(sep) + end); return; }
      // long lists wrap like a formatter would: one row of up to 5 per line
      lines.push(head);
      for (let i = 0; i < vals.length; i += 5) {
        const last = i + 5 >= vals.length;
        lines.push(`    ${vals.slice(i, i + 5).map(str).join(sep)}${last ? "" : '<span class="tk-p">,</span>'}`);
      }
      lines.push("  " + end);
    });
    lines.push(`<span class="tk-p">}</span>`);
    $("#toolboxCode").innerHTML = lines.map((l) => `<span class="ln">${l}</span>`).join("");
    $$("[data-tbview]").forEach((b) => b.addEventListener("click", () => {
      $$("[data-tbview]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const json = b.dataset.tbview === "json";
      $("#tbGrid").hidden = json;
      $("#toolboxCode").hidden = !json;
    }));
  })();

  // library — a shelf, filterable by kind
  (() => {
    const list = (C.library || []).filter((x) => x && has(x.title));
    const shelf = $("#shelf");
    shelf.innerHTML = list
      .map((x, i) => `<article class="bk${x.featured ? " featured" : ""}" data-kind="${esc(x.kind || "")}" data-reveal>
          <div class="bk-top mono"><span>${esc(x.kind || "")}</span><span class="dim">${String(i + 1).padStart(2, "0")}</span></div>
          <h4>${esc(x.title)}</h4>
          ${has(x.by) ? `<div class="bk-by mono">${esc(x.by)}</div>` : ""}
          ${has(x.note) ? `<p>${esc(x.note)}</p>` : ""}
        </article>`)
      .join("");
    const cards = $$(".bk", shelf);
    tabsFilter($("#libTabs"), list, (x) => x.kind || "", (k) => k, (k) => filterCards(cards, (c) => k === "all" || c.dataset.kind === k));
  })();

  // media — YouTube: one big player + a playlist beside it (videos load only when clicked)
  (() => {
    const Y = C.youtube || {};
    const link = $("#ytLink");
    const url = safeUrl(Y.url);
    if (url) link.href = url; else link.style.display = "none";
    const bodyEl = $("#ytBody");
    const idOf = (v) => {
      const s = String((v && typeof v === "object" ? v.id || v.url : v) || "").trim();
      const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
      return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : "";
    };
    const seen = new Set();
    const vids = (Y.videos || []).concat(Y.featured ? [Y.featured] : [])
      .map((v) => ({ id: idOf(v), title: (v && typeof v === "object" && v.title) || "" }))
      .filter((v) => v.id && !seen.has(v.id) && seen.add(v.id));
    const frame = (src) => `<iframe src="${esc(src)}" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    const thumb = (id, q = "hqdefault") => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
    const cid = String(Y.channelId || "").trim();
    if (!vids.length) {
      if (/^UC[\w-]{20,}$/.test(cid)) { bodyEl.innerHTML = `<div class="stage">${frame(`https://www.youtube-nocookie.com/embed/videoseries?list=UU${cid.slice(2)}`)}</div>`; return; }
      bodyEl.classList.add("empty");
      bodyEl.innerHTML = `<div class="stage"><div class="placeholder">▶ channel coming soon<br>${todo("youtube.videos in config.js")}</div></div>
        <ol class="playlist skel" aria-hidden="true">${[1, 2, 3].map((n) => `<li><span class="pl-th"></span><span class="pl-t"><i></i><i></i></span></li>`).join("")}</ol>`;
      return;
    }
    $("#ytCount").textContent = `· ${vids.length} video${vids.length > 1 ? "s" : ""}`;
    bodyEl.classList.toggle("single", vids.length === 1);
    bodyEl.innerHTML = `<div class="stage" id="ytStage"></div>${vids.length > 1 ? `<ol class="playlist" id="ytList">${vids.map((v, i) => `<li><button data-i="${i}"><span class="pl-th"><img alt="" loading="lazy" src="${thumb(v.id, "mqdefault")}"><span class="pl-n mono">${String(i + 1).padStart(2, "0")}</span></span><span class="pl-t" data-title="${i}">${esc(v.title || "video " + (i + 1))}</span></button></li>`).join("")}</ol>` : ""}`;
    const stage = $("#ytStage");
    let cur = 0;
    const show = (i, autoplay) => {
      cur = i;
      const v = vids[i];
      stage.innerHTML = autoplay
        ? frame(`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`)
        : `<button class="lite" style="background-image:url('${thumb(v.id)}')" aria-label="Play ${esc(v.title || "video")}"><span class="lite-play"></span><span class="lite-t" data-title="${i}">${esc(v.title || "")}</span></button>`;
      $$("#ytList button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
    };
    stage.addEventListener("click", (e) => { if (e.target.closest(".lite")) show(cur, true); });
    if ($("#ytList")) $("#ytList").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) show(+b.dataset.i, true); });
    show(0, false);
    // titles for videos listed by id only (YouTube oEmbed allows cross-origin reads); cached a day
    vids.forEach(async (v, i) => {
      if (v.title) return;
      const key = "ah:yt:" + v.id;
      let t = "";
      try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 864e5) t = c.title; } catch { /* ignore */ }
      if (!t) {
        try {
          const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + v.id)}`);
          if (r.ok) { t = (await r.json()).title || ""; try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), title: t })); } catch { /* ignore */ } }
        } catch { /* keep the fallback */ }
      }
      if (!t) return;
      v.title = t;
      $$(`[data-title="${i}"]`).forEach((el) => (el.textContent = t));
    });
  })();

  // media — listening: spotify profile + live track from discord presence when playing
  (() => {
    const el = $("#listen");
    const sp = (C.socials || []).find((s) => /spotify/i.test(s.label || "") && safeUrl(s.url));
    const music = (C.library || []).filter((x) => x && x.kind === "music" && has(x.title));
    if (!sp && !music.length) { el.parentElement.classList.add("solo"); el.remove(); return; }
    el.innerHTML = `<div class="panel-head mono"><span>♫ listening</span>${sp ? `<a href="${esc(safeUrl(sp.url))}" target="_blank" rel="noopener me">spotify ↗</a>` : ""}</div>
      <div class="ls-live" id="lsLive" hidden></div>
      <div class="ls-idle" id="lsIdle"><div class="dc-label mono">not playing anything right now</div><p class="dim small">when i'm listening on spotify, the track shows up here live.</p></div>
      ${music.length ? `<div class="dc-label mono">shaped by</div><ul class="ls-list">${music.map((m) => `<li><b>${esc(m.title)}</b>${has(m.note) ? `<span class="dim small">${esc(m.note)}</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${sp ? `<a class="btn" href="${esc(safeUrl(sp.url))}" target="_blank" rel="noopener me">my spotify profile ↗</a>` : ""}`;
    window.addEventListener("presence", (e) => {
      const d = e.detail || {}, s = d.listening_to_spotify && d.spotify;
      $("#lsIdle").hidden = !!s;
      const live = $("#lsLive");
      live.hidden = !s;
      if (!s) return;
      live.innerHTML = `<div class="dc-rich"><div class="dc-art">${s.album_art_url ? `<img alt="" src="${esc(s.album_art_url)}" loading="lazy">` : "♪"}</div>
        <div class="dc-meta"><div class="dc-kind mono"><span class="dot-live"></span> listening now</div><a class="dc-title" href="https://open.spotify.com/track/${esc(s.track_id || "")}" target="_blank" rel="noopener">${esc(s.song)}</a><div class="dim small">by ${esc(s.artist)}</div></div></div>`;
    });
  })();

  // discord — a real profile card: live over Lanyard's websocket (status, custom status,
  // activities with ticking timers, Spotify with album art, platforms), plus a live server card
  (() => {
    const D = C.discord || {};
    const card = $("#dcCard"), server = $("#dcServer");
    const isId = (v) => /^\d{15,22}$/.test(String(v || "").trim());
    const uid = String(D.userId || "").trim();
    const profile = isId(uid) ? `https://discord.com/users/${uid}` : "https://discord.com/app";
    const uname = D.username || "";
    card.innerHTML = `
      <div class="dc-banner" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="dc-body">
        <div class="dc-top">
          <div class="dc-av" id="dcAv"><span>${esc((uname || "?")[0].toUpperCase())}</span><i class="st offline" id="dcSt" title="offline"></i></div>
          <div class="dc-plat mono" id="dcPlat"></div>
        </div>
        <div class="dc-name" id="dcName">${or(D.displayName || uname, "display name")}</div>
        <div class="dc-handle mono"><span id="dcUser">${has(uname) ? "@" + esc(uname) : todo("discord.username")}</span><span class="dc-tag" id="dcTag" hidden></span></div>
        <div class="dc-custom" id="dcCustom" hidden></div>
        <div class="dc-sep"></div>
        ${has(D.about) ? `<div class="dc-label mono">about me</div><p class="dc-about">${mdInline(D.about)}</p>` : ""}
        <div class="dc-label mono" id="dcActLabel">${isId(uid) ? "status" : "live status"}</div>
        <div id="dcActs"><div class="dc-act">${isId(uid) ? `<span class="dim">connecting to lanyard<span class="dots"></span></span>` : `${todo("discord.userId in config.js → live status, activities & spotify (and join discord.gg/lanyard once)")}`}</div></div>
        <div class="dc-actions">
          <button class="btn btn-hi" id="dcCopy">copy username</button>
          <a class="btn" href="${esc(profile)}" target="_blank" rel="noopener">${isId(uid) ? "open profile ↗" : "open discord ↗"}</a>
        </div>
        <div class="dc-foot mono dim" id="dcLive">${isId(uid) ? "connecting…" : "not connected"}</div>
      </div>`;
    $("#dcCopy").addEventListener("click", () => copy(uname, "discord username"));

    /* ---------- server card ---------- */
    const sid = String(D.serverId || "").trim();
    const inv = safeUrl(D.serverInvite);
    const invCode = (inv.match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]+)/i) || [])[1] || "";
    const head = (right) => `<div class="panel-head mono"><span>server</span>${right || ""}</div>`;
    const joinBtn = (href) => (href ? `<a class="btn btn-hi" href="${esc(href)}" target="_blank" rel="noopener">join the server ↗</a>` : "");
    const serverCard = ({ name, icon, online, members, avatars, invite }) => `
      ${head(`<span class="dim">${online != null ? `<i class="st online"></i> live` : ""}</span>`)}
      <div class="dsv-top">
        <div class="dsv-icon">${icon ? `<img alt="" src="${esc(icon)}" loading="lazy">` : esc((name || "?")[0].toUpperCase())}</div>
        <div><div class="dsv-name">${esc(name || "server")}</div>
          <div class="dsv-counts mono">${online != null ? `<span><i class="st online"></i>${online.toLocaleString()} online</span>` : ""}${members != null ? `<span><i class="st offline"></i>${members.toLocaleString()} members</span>` : ""}</div></div>
      </div>
      ${avatars && avatars.length ? `<div class="dc-label mono">online now</div><ul class="dsv-members">${avatars.map((m) => `<li title="${esc(m.name)}"><img alt="" src="${esc(m.img)}" loading="lazy"><i class="st ${esc(m.status)}"></i><span>${esc(m.name)}</span></li>`).join("")}</ul>` : ""}
      <div class="dc-actions">${joinBtn(invite || inv)}</div>`;
    async function loadServer() {
      if (isId(sid)) {
        // public widget JSON (Server Settings → Widget → Enable Server Widget)
        try {
          const r = await fetch(`https://discord.com/api/guilds/${sid}/widget.json`);
          if (!r.ok) throw new Error(r.status === 403 ? "widget disabled" : "HTTP " + r.status);
          const w = await r.json();
          server.innerHTML = serverCard({
            name: w.name, online: w.presence_count, invite: w.instant_invite,
            avatars: (w.members || []).slice(0, 14).map((m) => ({ name: m.username, img: m.avatar_url, status: m.status })),
          });
          return;
        } catch (e) {
          if (!invCode) { server.innerHTML = `${head()}<div class="placeholder">couldn't read the server widget (${esc(e.message)})<br>${todo("Server Settings → Widget → enable")}</div>`; return; }
        }
      }
      if (invCode) {
        // invite lookup: server name, icon and member counts, no setup needed
        try {
          const r = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(invCode)}?with_counts=true`);
          if (!r.ok) throw new Error("HTTP " + r.status);
          const j = await r.json();
          const g = j.guild || {};
          server.innerHTML = serverCard({
            name: g.name, members: j.approximate_member_count, online: j.approximate_presence_count,
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : "",
          });
          return;
        } catch { /* fall through to the plain card */ }
        server.innerHTML = `${head()}<div class="placeholder">${joinBtn(inv)}</div>`;
        return;
      }
      // no server yet → no server card (set discord.serverInvite / serverId to bring it back)
      server.remove();
    }
    loadServer();

    if (!isId(uid)) return;

    /* ---------- live presence ---------- */
    const STATUS = { online: "online", idle: "idle", dnd: "do not disturb", offline: "offline" };
    const VERB = { 0: "playing", 1: "streaming", 2: "listening to", 3: "watching", 5: "competing in" };
    const asset = (a, app) => {
      if (!a) return "";
      if (a.startsWith("mp:")) return "https://media.discordapp.net/" + a.slice(3);
      if (a.startsWith("spotify:")) return "https://i.scdn.co/image/" + a.slice(8);
      return app ? `https://cdn.discordapp.com/app-assets/${app}/${a}.png` : "";
    };
    const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
    let last = null, tickT = 0, visible = false;

    function render(d) {
      last = d;
      window.dispatchEvent(new CustomEvent("presence", { detail: d })); // media → listening reads spotify from here
      const u = d.discord_user || {};
      const st = d.discord_status || "offline";
      $("#dcSt").className = "st " + st;
      $("#dcSt").title = STATUS[st] || st;
      $("#dcName").textContent = u.global_name || u.display_name || D.displayName || u.username || uname;
      $("#dcUser").textContent = "@" + (u.username || uname);
      const tag = $("#dcTag"), pg = u.primary_guild;
      if (pg && pg.tag) { tag.hidden = false; tag.textContent = pg.tag; } else tag.hidden = true;
      const av = $("#dcAv");
      if (u.avatar) {
        const src = `https://cdn.discordapp.com/avatars/${uid}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "webp"}?size=160`;
        let img = $("img.av", av);
        if (!img) { av.insertAdjacentHTML("afterbegin", `<img class="av" alt="">`); img = $("img.av", av); const sp = $("span", av); if (sp) sp.hidden = true; }
        if (img.getAttribute("src") !== src) img.src = src;
      }
      const deco = u.avatar_decoration_data && u.avatar_decoration_data.asset;
      let dimg = $("img.deco", av);
      if (deco) { if (!dimg) { av.insertAdjacentHTML("beforeend", `<img class="deco" alt="">`); dimg = $("img.deco", av); } dimg.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco}.png?size=160&passthrough=true`; }
      else if (dimg) dimg.parentNode.removeChild(dimg);
      $("#dcPlat").innerHTML = [["desktop", d.active_on_discord_desktop], ["mobile", d.active_on_discord_mobile], ["web", d.active_on_discord_web]]
        .filter((p) => p[1]).map((p) => `<span>${p[0]}</span>`).join("");

      const acts = d.activities || [];
      const custom = acts.find((a) => a.type === 4);
      const cEl = $("#dcCustom");
      if (custom && (custom.state || custom.emoji)) {
        const em = custom.emoji;
        const emo = em ? (em.id ? `<img alt="" src="https://cdn.discordapp.com/emojis/${em.id}.${em.animated ? "gif" : "webp"}?size=32">` : esc(em.name || "")) : "";
        cEl.innerHTML = `${emo}<span>${esc(custom.state || "")}</span>`;
        cEl.hidden = false;
      } else cEl.hidden = true;

      const items = [];
      if (d.listening_to_spotify && d.spotify) {
        const s = d.spotify;
        items.push(`<div class="dc-act dc-rich" data-start="${s.timestamps?.start || ""}" data-end="${s.timestamps?.end || ""}">
          <div class="dc-art">${s.album_art_url ? `<img alt="" src="${esc(s.album_art_url)}" loading="lazy">` : "♪"}</div>
          <div class="dc-meta"><div class="dc-kind mono">listening to spotify</div>
            <a class="dc-title" href="https://open.spotify.com/track/${esc(s.track_id || "")}" target="_blank" rel="noopener">${esc(s.song)}</a>
            <div class="dim small">by ${esc(s.artist)}</div><div class="dim small">on ${esc(s.album)}</div>
            <div class="dc-bar"><span></span></div><div class="dc-times mono"><span class="t0"></span><span class="t1"></span></div></div></div>`);
      }
      for (const a of acts) {
        if (a.type === 4 || (a.type === 2 && a.name === "Spotify" && d.listening_to_spotify)) continue;
        const big = asset(a.assets?.large_image, a.application_id), small = asset(a.assets?.small_image, a.application_id);
        items.push(`<div class="dc-act dc-rich" data-start="${a.timestamps?.start || ""}" data-end="${a.timestamps?.end || ""}">
          <div class="dc-art">${big ? `<img alt="${esc(a.assets?.large_text || "")}" src="${esc(big)}" loading="lazy">` : "▶"}${small ? `<img class="sm" alt="" src="${esc(small)}" loading="lazy">` : ""}</div>
          <div class="dc-meta"><div class="dc-kind mono">${VERB[a.type] || "doing"}</div><div class="dc-title">${esc(a.name)}</div>
            ${a.details ? `<div class="dim small">${esc(a.details)}</div>` : ""}${a.state ? `<div class="dim small">${esc(a.state)}</div>` : ""}
            <div class="dc-elapsed mono small"></div></div></div>`);
      }
      $("#dcActLabel").textContent = items.length ? "activity" : "status";
      $("#dcActs").innerHTML = items.length ? items.join("") : `<div class="dc-act">${st === "offline" ? "offline right now. leave a message and i'll see it later." : `${STATUS[st]}. say hi.`}</div>`;
      tick();
    }
    function tick() {
      $$(".dc-rich", card).forEach((el) => {
        const s = +el.dataset.start, e = +el.dataset.end, now = Date.now();
        if (s && e) {
          const bar = $(".dc-bar span", el);
          if (bar) bar.style.transform = `scaleX(${Math.min(1, (now - s) / (e - s)).toFixed(4)})`;
          const t0 = $(".t0", el), t1 = $(".t1", el);
          if (t0) { t0.textContent = clock(now - s); t1.textContent = clock(e - s); }
          const el2 = $(".dc-elapsed", el); if (el2) el2.textContent = clock(e - now) + " left";
        } else if (s) { const el2 = $(".dc-elapsed", el); if (el2) el2.textContent = clock(now - s) + " elapsed"; }
      });
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      clearInterval(tickT);
      if (visible) tickT = setInterval(tick, 1000);
    }).observe(card);

    const setLive = (t) => ($("#dcLive").textContent = t);
    const notTracked = () => {
      $("#dcActs").innerHTML = `<div class="dc-act">${todo("join discord.gg/lanyard once so lanyard can see your presence")}</div>`;
      setLive("lanyard isn't tracking this account yet");
    };
    // REST fallback (also used if the websocket can't connect)
    let pollT = 0;
    async function poll() {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${uid}`);
        const j = await r.json();
        if (!j.success) { notTracked(); return; }
        render(j.data);
        setLive("live · polling every 30s");
      } catch { setLive("couldn't reach lanyard"); }
      clearTimeout(pollT);
      pollT = setTimeout(poll, 30000);
    }
    let tries = 0;
    function connect() {
      let ws, hb = 0, gotData = false;
      try { ws = new WebSocket("wss://api.lanyard.rest/socket"); } catch { poll(); return; }
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.op === 1) {
          ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: uid } }));
          hb = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })), m.d.heartbeat_interval);
        } else if (m.op === 0 && (m.t === "INIT_STATE" || m.t === "PRESENCE_UPDATE")) {
          const d = m.d && m.d.discord_user ? m.d : m.d && m.d[uid];
          if (!d || !d.discord_user) { if (!gotData) { ws.close(); poll(); } return; }
          gotData = true; tries = 0;
          clearTimeout(pollT);
          render(d);
          setLive("live · real-time");
        }
      };
      ws.onclose = () => {
        clearInterval(hb);
        if (!gotData && tries === 0) { tries++; poll(); return; } // not tracked or blocked → REST tells us which
        if (gotData) { setLive("reconnecting…"); setTimeout(connect, Math.min(30000, 2000 * ++tries)); }
      };
      ws.onerror = () => ws.close();
    }
    connect();
  })();

  // guestbook — works with no setup: entries are GitHub issues made from the guestbook issue
  // form (.github/ISSUE_TEMPLATE/guestbook.yml). Visitors write here (with the typing feel),
  // then sign on GitHub. Close an issue to hide an entry. giscus is used instead if configured.
  (() => {
    const G = C.giscus || {};
    const boxEl = $("#giscusBox");
    if ([G.repo, G.repoId, G.category, G.categoryId].every(has)) {
      const s = document.createElement("script");
      s.src = "https://giscus.app/client.js";
      Object.entries({ repo: G.repo, "repo-id": G.repoId, category: G.category, "category-id": G.categoryId, mapping: "specific", term: "guestbook", "reactions-enabled": "1", "emit-metadata": "0", "input-position": "top", theme: "transparent_dark", lang: "en", loading: "lazy" })
        .forEach(([k, v]) => s.setAttribute("data-" + k, v));
      s.crossOrigin = "anonymous";
      s.async = true;
      boxEl.appendChild(s);
      return;
    }
    const repo = (C.guestbook && C.guestbook.repo) || "";
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { boxEl.innerHTML = `<div class="placeholder">${todo("guestbook.repo in config.js, e.g. \"Ahmadhussain0033/Ahmadhussain0033\"")}</div>`; return; }
    boxEl.classList.add("gb");
    boxEl.innerHTML = `
      <form class="gb-form" id="gbForm">
        <div class="panel-head mono"><span>$ sign --guestbook</span><span class="dim">signed with github</span></div>
        <div class="field"><label for="gbName">name / alias</label><input id="gbName" type="text" maxlength="60" autocomplete="nickname" placeholder="anonymous"></div>
        <div class="field"><label for="gbFrom">where are you from? <span class="dim">— optional</span></label><input id="gbFrom" type="text" maxlength="60"></div>
        <div class="field"><label for="gbMsg">your note</label><textarea id="gbMsg" rows="4" maxlength="600" required placeholder="say hi, leave a thought, ask a question…"></textarea>
          <div class="field-row"><span class="err mono" id="gbErr"></span><span class="mono dim" id="gbCount">0 / 600</span></div></div>
        <div class="cf-actions"><button class="btn btn-hi" type="submit">sign on github →</button><span class="mono dim small">opens github with your note filled in, you just press submit</span></div>
      </form>
      <div class="gb-wall">
        <div class="panel-head mono"><span id="gbHead">the wall</span><a href="https://github.com/${esc(repo)}/issues?q=is%3Aissue+is%3Aopen+label%3Aguestbook" target="_blank" rel="noopener">all entries →</a></div>
        <ul class="gb-list" id="gbList"><li class="dim mono">reading the wall<span class="dots"></span></li></ul>
      </div>`;
    const msg = $("#gbMsg"), cnt = $("#gbCount");
    msg.addEventListener("input", () => (cnt.textContent = `${msg.value.length} / 600`));
    $("#gbForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = msg.value.trim();
      if (text.length < 2) { $("#gbErr").textContent = "write a little something first"; msg.focus(); return; }
      $("#gbErr").textContent = "";
      const name = $("#gbName").value.trim() || "hello";
      const q = new URLSearchParams({ template: "guestbook.yml", title: `[guestbook] ${name}`, message: text, from: $("#gbFrom").value.trim() });
      window.open(`https://github.com/${repo}/issues/new?${q}`, "_blank", "noopener");
      toast("finish signing on github ↗");
    });

    // issue-form bodies look like "### heading\n\nanswer\n\n### heading …"
    const field = (body, name) => {
      const parts = String(body || "").split(/^###\s+/m);
      const hit = parts.find((p) => p.toLowerCase().startsWith(name));
      if (!hit) return "";
      const v = hit.slice(hit.indexOf("\n") + 1).trim();
      return /^_no response_$/i.test(v) ? "" : v;
    };
    (async () => {
      const list = $("#gbList");
      try {
        const issues = await gh(`/repos/${repo}/issues?state=open&per_page=100`);
        const entries = issues.filter((i) => !i.pull_request && ((i.labels || []).some((l) => l.name === "guestbook") || /^\[guestbook\]/i.test(i.title)));
        $("#gbHead").textContent = `the wall · ${entries.length} ${entries.length === 1 ? "signature" : "signatures"}`;
        if (!entries.length) { list.innerHTML = `<li class="gb-empty">no signatures yet. be the first one on the wall.</li>`; return; }
        list.innerHTML = entries.slice(0, 40).map((i) => {
          const note = field(i.body, "your note") || field(i.body, "message") || String(i.body || "").trim();
          const from = field(i.body, "where");
          const alias = i.title.replace(/^\[guestbook\]\s*/i, "").trim();
          const hearts = (i.reactions && (i.reactions.heart + i.reactions["+1"])) || 0;
          return `<li class="gb-entry" data-reveal>
            <a href="${esc(i.user.html_url)}" target="_blank" rel="noopener"><img alt="" src="${esc(i.user.avatar_url)}&s=80" loading="lazy"></a>
            <div><div class="gb-meta mono"><a href="${esc(i.html_url)}" target="_blank" rel="noopener"><b>${esc(alias && alias !== "hello" ? alias : i.user.login)}</b></a> <span>@${esc(i.user.login)}</span>${from ? ` <span>· ${esc(from)}</span>` : ""} <span>· ${esc(ago(i.created_at))}</span>${hearts ? ` <span class="gb-heart">♥ ${hearts}</span>` : ""}</div>
            <p>${mdInline(note.slice(0, 600))}</p></div></li>`;
        }).join("");
        reveal(list);
      } catch (err) {
        list.innerHTML = `<li class="gb-empty">couldn't read the wall right now (${esc(err.message)}). <a href="https://github.com/${esc(repo)}/issues?q=label%3Aguestbook" target="_blank" rel="noopener">see it on github →</a></li>`;
      }
    })();
  })();

  // contact
  (() => {
    const A = C.availability || {};
    $("#availDot").className = "st " + (A.status || "");
    $("#availText").innerHTML = or(A.text, "availability");
    $("#respTime").innerHTML = or(C.responseTime);
    $("#emailTxt").innerHTML = or(C.email, "email");
    if (!has(C.email)) $("#copyEmail").remove();
    else $("#copyEmail").addEventListener("click", () => copy(C.email, "email"));

    // live local time
    const lt = $("#localTime");
    let tf = null;
    if (has(C.timezone)) { try { tf = new Intl.DateTimeFormat([], { timeZone: C.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }); } catch { tf = null; } }
    if (tf) { const t = () => (lt.textContent = tf.format(new Date())); t(); setInterval(t, 1000); }
    else lt.innerHTML = todo("timezone");

    // quick contact cards
    const dcUser = C.discord?.username;
    const quick = [
      has(dcUser) && { k: "discord", v: "@" + dcUser, act: `<button class="btn btn-hi" data-copy="${esc(dcUser)}" data-copy-label="discord username">copy</button>`, note: "usually the fastest" },
      { k: "email", v: has(C.email) ? C.email : "", act: has(C.email) ? `<button class="btn btn-hi" data-copy="${esc(C.email)}" data-copy-label="email">copy</button><a class="btn" href="mailto:${esc(C.email)}">write ↗</a>` : "", note: "for anything longer" },
      safeUrl(C.bookingUrl) && { k: "book a call", v: "pick a time that works", act: `<a class="btn btn-hi" href="${esc(safeUrl(C.bookingUrl))}" target="_blank" rel="noopener">book ↗</a>`, note: "15–30 min, video or voice" },
      safeUrl((C.ledger || {}).site) && { k: "support", v: "back what i'm working on", act: `<a class="btn btn-hi" href="${esc(safeUrl(C.ledger.site) + "#donate")}" target="_blank" rel="noopener">support ♥</a>`, note: "every expense is public" },
    ].filter(Boolean);
    $("#quickContact").innerHTML = quick
      .map((q) => `<div class="qc panel" data-reveal><div class="qc-k mono">${esc(q.k)}</div><div class="qc-v">${q.v ? esc(q.v) : todo(q.k === "email" ? "email in config.js" : "bookingUrl in config.js")}</div><div class="qc-note mono dim">${esc(q.note)}</div><div class="qc-act">${q.act}</div></div>`)
      .join("");
    document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copy(b.dataset.copy, b.dataset.copyLabel || "text"); });

    // best way to reach me / open to
    $("#reachMe").innerHTML = (C.reachMe || []).filter((r) => has(r.via)).map((r) => `<li><b>${esc(r.via)}</b><span>${or(r.note, "why this one")}</span></li>`).join("") || `<li>${todo("reachMe")}</li>`;
    const yes = (C.openTo || []).map((t) => `<li class="yes">${or(t, "something you're open to")}</li>`);
    const no = (C.notOpenTo || []).filter((t) => has(t) || C.showTodos !== false).map((t) => `<li class="no">${or(t, "something you're not open to (optional)")}</li>`);
    $("#openTo").innerHTML = yes.concat(no).join("");

    // faq — grouped by topic, searchable; nothing matching → ask it in the form
    (() => {
      const faq = (C.contactFaq || []).filter((x) => x && has(x.q));
      const wrap = $("#faqWrap");
      if (!faq.length) { wrap.previousElementSibling.remove(); wrap.remove(); return; }
      const list = $("#contactFaq");
      list.innerHTML = faq
        .map((x, i) => `<details class="faq-item" data-topic="${esc(x.topic || "")}" data-reveal>
            <summary><span class="fq-n mono">${String(i + 1).padStart(2, "0")}</span><span class="fq-q">${esc(x.q)}</span><span class="fq-t mono">${esc(x.topic || "")}</span><span class="fq-i" aria-hidden="true"></span></summary>
            <div class="fq-a"><p>${has(x.a) ? mdInline(x.a) : todo("the answer")}</p></div>
          </details>`)
        .join("");
      const items = $$(".faq-item", list);
      const q = $("#faqQ"), none = $("#faqNone");
      let topic = "all";
      const apply = () => {
        const s = q.value.trim().toLowerCase();
        let shown = 0;
        items.forEach((d, i) => {
          const ok = (topic === "all" || d.dataset.topic === topic) && (!s || (faq[i].q + " " + faq[i].a).toLowerCase().includes(s));
          d.hidden = !ok;
          if (ok) shown++;
        });
        none.hidden = shown > 0;
        $("#faqNoneQ").textContent = s ? `“${q.value.trim()}”` : "that";
        $("#faqCount").textContent = `${shown} of ${faq.length}`;
      };
      tabsFilter($("#faqTabs"), faq, (x) => x.topic || "", (k) => k, (k) => { topic = k; apply(); });
      q.addEventListener("input", apply);
      apply();
      $("#faqAll").addEventListener("click", () => {
        const open = !items.some((d) => d.open && !d.hidden);
        items.forEach((d) => { if (!d.hidden) d.open = open; });
        $("#faqAll").textContent = open ? "collapse all" : "expand all";
      });
      // didn't find it → the form, with the question already written
      $("#faqAsk").addEventListener("click", () => {
        const m = $("#cfMsg");
        if (m && !m.value.trim()) { m.value = q.value.trim() ? `hey! quick question: ${q.value.trim()}` : "hey! quick question: "; m.dispatchEvent(new Event("input")); }
        go("contact");
        setTimeout(() => m && m.focus({ preventScroll: true }), 700);
      });
    })();

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
    try { const r = await gh(`/repos/${C.github}/${C.siteRepo || C.github}`); el.textContent = "updated " + ago(r.pushed_at); }
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

  /* ---------------- boot ---------------- */
  addEventListener("resize", resize);
  resize();
  applyMods();
  setFps(fpsOn);
  reveal();
  onScroll();
  requestAnimationFrame(loop);
  if (!finePointer) body.classList.remove("has-mouse");
  window.__site = { go, openPal, toggleMusic, isPlaying, hit, stats, grade, accuracy, toggleMod };
})();
