/* =====================================================================
   scene-worker.js — runs the 3D space on its own thread.
   The page hands over an OffscreenCanvas; from then on every frame is
   rendered here, so scrolling, typing and page scripts on the main thread
   never delay the background (and the background never delays them).
   ===================================================================== */
import { createScene } from "./scene-core.js";

const S = {};
let api = null;

self.onmessage = (e) => {
  const m = e.data || {};
  switch (m.type) {
    case "caps": {
      // can this browser render WebGL inside a worker, with a vsync-aligned frame loop?
      let gl = false;
      try { const c = new OffscreenCanvas(1, 1); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { gl = false; }
      self.postMessage({ type: "caps", raf: typeof self.requestAnimationFrame === "function", gl });
      break;
    }
    case "init":
      Object.assign(S, m.state);
      try {
        api = createScene(m.canvas, m.env, S, (g) => self.postMessage({ type: "gfx", gfx: { ...g } }));
        self.postMessage({ type: "ready" });
      } catch (err) {
        self.postMessage({ type: "fail", error: String(err && err.message ? err.message : err) });
      }
      break;
    case "state": Object.assign(S, m.state); break;
    case "resize": if (api) api.resize(m.w, m.h, m.dpr); break;
    case "warp": if (api) api.warp(); break;
    case "enter": if (api) api.enter(); break;
  }
};
