/* =====================================================================
   scene.js — hosts the 3D space (js/scene-core.js).

   Preferred: render on a separate thread. The canvas is transferred to a
   Web Worker as an OffscreenCanvas, and this file only forwards page state
   (scroll, pointer, music beat, effects on/off, visibility, size) as small
   messages. The main thread stays free for scrolling, typing and the UI.

   Fallback (no OffscreenCanvas WebGL / no worker frame loop, or ?noworker):
   the same core renders on the page.

   window.__gfx = { mode: "worker" | "page", refresh, pr, fps } feeds the
   fps counter (press f).
   ===================================================================== */
const host = document.getElementById("space");

if (host) start();

function start() {
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lite = body.dataset.scene === "lite";
  const S = {
    sy: scrollY, maxScroll: 1, tx: 0, ty: 0, mx: innerWidth / 2, my: innerHeight / 2, beat: 0,
    fxOff: body.classList.contains("fx-off"), hasMouse: body.classList.contains("has-mouse"), hidden: document.hidden,
  };
  const env = () => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, reduce, lite });
  let canvas = document.createElement("canvas");
  host.appendChild(canvas);

  // until a renderer is up, everything is queued into S (and replayed on start)
  let send = (type, data) => { if (type === "state") Object.assign(S, data); };
  let pendingEnter = false;
  const gfx = (window.__gfx = window.__gfx || {});
  const setGfx = (g) => Object.assign(gfx, g);
  const ready = (mode) => { gfx.mode = mode; body.classList.add("gl"); if (pendingEnter) send("enter"); };

  /* ---------- page → scene state ---------- */
  const state = (data) => { Object.assign(S, data); send("state", data); };
  addEventListener("scroll", () => state({ sy: scrollY }), { passive: true });
  const measure = () => state({ maxScroll: Math.max(1, document.documentElement.scrollHeight - innerHeight) });
  new ResizeObserver(measure).observe(body);
  addEventListener("resize", () => { measure(); send("resize", { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 }); });
  measure();
  addEventListener("pointermove", (e) => {
    const d = { tx: (e.clientX / innerWidth) * 2 - 1, ty: (e.clientY / innerHeight) * 2 - 1 };
    if (e.pointerType === "mouse") { d.mx = e.clientX; d.my = e.clientY; }
    state(d);
  }, { passive: true });
  new MutationObserver(() => {
    const fxOff = body.classList.contains("fx-off"), hasMouse = body.classList.contains("has-mouse");
    if (fxOff !== S.fxOff || hasMouse !== S.hasMouse) state({ fxOff, hasMouse });
  }).observe(body, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", () => state({ hidden: document.hidden }));
  // the music beat is computed by main.js each frame (window.__beat); forward it when it moves
  let lastBeat = 0;
  (function beatLoop() {
    const b = window.__beat || 0;
    if (Math.abs(b - lastBeat) > 0.004 || (b === 0 && lastBeat !== 0)) { lastBeat = b; state({ beat: b }); }
    requestAnimationFrame(beatLoop);
  })();
  window.__warp = () => send("warp");
  window.__sceneEnter = () => { pendingEnter = true; send("enter"); };

  /* ---------- renderer: worker first, page as fallback ---------- */
  const forceInline = /[?&]noworker\b/.test(location.search);
  const canWorker = !forceInline && "transferControlToOffscreen" in canvas && typeof Worker !== "undefined";

  function inline() {
    import("./scene-core.js")
      .then(({ createScene }) => {
        const api = createScene(canvas, env(), S, setGfx);
        send = (type, data) => {
          if (type === "state") return; // S is shared directly
          if (type === "resize") api.resize(data.w, data.h, data.dpr);
          else if (type === "warp") api.warp();
          else if (type === "enter") api.enter();
        };
        ready("page");
      })
      .catch(() => { body.classList.add("no-webgl"); canvas.remove(); });
  }

  if (!canWorker) return inline();
  let worker;
  try { worker = new Worker(new URL("./scene-worker.js", import.meta.url), { type: "module" }); }
  catch { return inline(); }
  let settled = false;
  const fallBack = () => { if (settled) return; settled = true; try { worker.terminate(); } catch { /* ignore */ } inline(); };
  const capsTimer = setTimeout(fallBack, 3000); // module workers unsupported / blocked
  worker.onerror = fallBack;
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === "caps") {
      clearTimeout(capsTimer);
      if (!(m.gl && m.raf)) return fallBack();
      settled = true;
      const off = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: off, env: env(), state: S }, [off]);
      send = (type, data) => {
        if (type === "state") worker.postMessage({ type, state: data });
        else worker.postMessage({ type, ...(data || {}) });
      };
    } else if (m.type === "ready") ready("worker");
    else if (m.type === "gfx") setGfx(m.gfx);
    else if (m.type === "fail") {
      // WebGL failed inside the worker: try once more on the page with a fresh canvas
      worker.terminate();
      canvas.remove();
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
      inline();
    }
  };
  worker.postMessage({ type: "caps" });
}
