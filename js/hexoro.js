/* =====================================================================
   hexoro.js — the Hexoro company page (/hexoro/). Content comes from
   config.js → hexoro; anything left blank is filled from the public
   GitHub org (github.com/Hexoro) when it has it, otherwise shown as a todo.
   ===================================================================== */
(() => {
  const C = window.SITE || {};
  const H = C.hexoro || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const has = (v) => v != null && String(v).trim() !== "";
  const todo = (hint) => (C.showTodos === false ? "" : `<span class="todo">${esc(hint || "todo")}</span>`);
  const or = (v, hint) => (has(v) ? esc(v) : todo(hint));
  const md = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const safeUrl = (u) => { const v = String(u || "").trim(); return /^(https?:|mailto:)/i.test(v) ? v : ""; };
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    for (const [n, u] of [[31536000, "y"], [2592000, "mo"], [604800, "w"], [86400, "d"], [3600, "h"], [60, "m"]]) if (s >= n) return Math.floor(s / n) + u + " ago";
    return "just now";
  };
  const name = H.name || "Hexoro";
  const org = H.github || "";
  document.title = name;

  async function gh(path) {
    const key = "ah:gh:" + path;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* ignore */ }
    if (cached && Date.now() - cached.t < 6e5) return cached.d;
    try {
      const r = await fetch("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "rate limited" : "HTTP " + r.status);
      const d = await r.json();
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* ignore */ }
      return d;
    } catch (e) { if (cached) return cached.d; throw e; }
  }

  /* section headers + reveal (same look as the main site) */
  const sections = $$("#hx > section:not(.hx-hero)");
  sections.forEach((s, i) => {
    s.insertAdjacentHTML("afterbegin", `<header class="sec-head" data-reveal>
      <span class="sec-ghost" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
      <div class="sec-tab"><span class="dim">●</span><b>${esc(s.dataset.file)}</b><span class="x">×</span></div>
      <h2 class="sec-title"><span class="h-mark">##</span><span class="tt">${esc(s.dataset.title)}</span></h2></header>`);
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
  const reveal = (scope = document) => $$("[data-reveal]:not(.in)", scope).forEach((el, i) => { el.style.setProperty("--i", i % 6); io.observe(el); });

  /* hero */
  $("#hxBrand").textContent = name;
  $("#hxName").textContent = name;
  $("#hxKicker").innerHTML = `<span class="dot-live"></span> ${has(H.role) ? esc(H.role) + " · " : ""}${esc(C.name || "")}`;
  const meta = () => [
    has(H.founded) && `<span>est. ${esc(H.founded)}</span>`,
    has(H.location) && `<span>${esc(H.location)}</span>`,
    has(org) && `<a href="https://github.com/${esc(org)}" target="_blank" rel="noopener">github.com/${esc(org)} ↗</a>`,
  ].filter(Boolean).join("");
  $("#hxMeta").innerHTML = meta();
  $("#hxTagline").innerHTML = has(H.tagline) ? esc(H.tagline) : todo("hexoro.tagline — one line: what Hexoro is");
  const cta = (site) => [
    `<a class="btn btn-hi" href="#contact">work with us →</a>`,
    safeUrl(site) && `<a class="btn" href="${esc(safeUrl(site))}" target="_blank" rel="noopener">website ↗</a>`,
    has(org) && `<a class="btn btn-ghost mono" href="https://github.com/${esc(org)}" target="_blank" rel="noopener">github ↗</a>`,
  ].filter(Boolean).join("");
  $("#hxCta").innerHTML = cta(H.website);

  /* about */
  const paras = (H.about || []);
  $("#hxAbout").innerHTML = paras.map((p, i) => (has(p) ? `<p data-reveal>${md(p)}</p>` : `<p data-reveal>${todo(i ? "another paragraph" : "hexoro.about — what Hexoro is, why it exists")}</p>`)).join("") || `<p>${todo("hexoro.about")}</p>`;

  /* focus */
  $("#hxFocus").innerHTML = (H.focus || []).map((f, i) => `<div class="hx-f panel" data-reveal><span class="hx-n mono">${String(i + 1).padStart(2, "0")}</span><h3>${or(f.title, "area")}</h3><p>${has(f.blurb) ? md(f.blurb) : todo("what this means")}</p></div>`).join("");

  /* products */
  const ST = { done: "shipped", doing: "building", idea: "idea", blocked: "paused" };
  $("#hxProducts").innerHTML = (H.products || []).map((p) => {
    const link = safeUrl(p.link);
    return `<article class="proj panel" data-reveal>
      <div class="proj-top mono"><span class="st ${esc(p.status)}"></span><span>${esc(ST[p.status] || p.status || "")}</span></div>
      <h4>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${or(p.name, "name")} ↗</a>` : or(p.name, "product name")}</h4>
      <p>${has(p.blurb) ? md(p.blurb) : todo("what it does")}</p></article>`;
  }).join("") || `<div class="placeholder">${todo("hexoro.products")}</div>`;

  /* team */
  $("#hxTeam").innerHTML = (H.team || []).map((m) => {
    const link = safeUrl(m.link);
    const initial = esc((m.name || "?").trim()[0] || "?").toUpperCase();
    const inner = `<div class="hx-av">${initial}</div><div><b>${or(m.name, "name")}</b><div class="mono dim small">${or(m.role, "role")}</div></div>`;
    return `<div class="hx-member panel" data-reveal>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${inner}</a>` : inner}</div>`;
  }).join("");

  /* story + values */
  $("#hxTimeline").innerHTML = (H.timeline || []).map((x) => `<li><span class="mono">${or(x.when, "when")}</span><span>${or(x.text, "milestone")}</span></li>`).join("") || `<li>${todo("hexoro.timeline")}</li>`;
  $("#hxValues").innerHTML = (H.values || []).map((v) => `<li>${or(v, "a value")}</li>`).join("");

  /* contact */
  function renderContact(email) {
    const mail = has(email) ? email : "";
    $("#hxContact").innerHTML = `
      ${has(H.joinText) ? `<div class="panel hx-join" data-reveal><div class="panel-head mono"><span>$ join --hexoro</span></div><p>${md(H.joinText)}</p></div>` : ""}
      <div class="quick-contact">
        <div class="qc panel" data-reveal><div class="qc-k mono">email</div><div class="qc-v">${mail ? esc(mail) : todo("hexoro.email")}</div><div class="qc-note mono dim">business, partnerships, press</div>
          <div class="qc-act">${mail ? `<a class="btn btn-hi" href="mailto:${esc(mail)}?subject=${encodeURIComponent("Hello " + name)}">write ↗</a><button class="btn" id="hxCopy">copy</button>` : ""}</div></div>
        ${has(org) ? `<div class="qc panel" data-reveal><div class="qc-k mono">github</div><div class="qc-v">@${esc(org)}</div><div class="qc-note mono dim">code, issues, open source</div><div class="qc-act"><a class="btn btn-hi" href="https://github.com/${esc(org)}" target="_blank" rel="noopener">open ↗</a></div></div>` : ""}
        <div class="qc panel" data-reveal><div class="qc-k mono">founder</div><div class="qc-v">${esc(C.name || "")}</div><div class="qc-note mono dim">say hi directly</div><div class="qc-act"><a class="btn btn-hi" href="../#contact">contact →</a></div></div>
      </div>`;
    const cp = $("#hxCopy");
    if (cp) cp.addEventListener("click", async () => { try { await navigator.clipboard.writeText(mail); cp.textContent = "copied"; } catch { cp.textContent = mail; } });
    reveal($("#hxContact"));
  }
  renderContact(H.email);
  $("#hxFoot").textContent = `${name} · ${new Date().getFullYear()}`;
  reveal();

  /* live from the GitHub org: fills blanks (tagline, website, email, location) + repos */
  (async () => {
    const box = $("#hxRepos");
    if (!has(org)) { box.innerHTML = `<div class="placeholder">${todo("hexoro.github")}</div>`; return; }
    box.innerHTML = `<div class="loading mono">reading github.com/${esc(org)}<span class="dots"></span></div>`;
    try {
      const [o, repos] = await Promise.all([gh(`/orgs/${encodeURIComponent(org)}`), gh(`/orgs/${encodeURIComponent(org)}/repos?sort=pushed&per_page=12`)]);
      if (!has(H.tagline) && has(o.description)) $("#hxTagline").textContent = o.description;
      if (!has(H.location) && has(o.location)) H.location = o.location;
      if (!has(H.founded) && o.created_at) H.founded = String(new Date(o.created_at).getFullYear());
      $("#hxMeta").innerHTML = meta();
      if (!has(H.website) && has(o.blog)) $("#hxCta").innerHTML = cta(/^https?:/.test(o.blog) ? o.blog : "https://" + o.blog);
      if (!has(H.email) && has(o.email)) renderContact(o.email);
      const stats = `<div class="hx-stats">
        <div class="stat" data-reveal><b>${o.public_repos ?? 0}</b><span>public repos</span></div>
        <div class="stat" data-reveal><b>${o.followers ?? 0}</b><span>${o.followers === 1 ? "follower" : "followers"}</span></div>
        <div class="stat" data-reveal><b>${o.created_at ? new Date(o.created_at).getFullYear() : "—"}</b><span>on github since</span></div>
      </div>`;
      const list = (repos || []).filter((r) => !r.fork);
      box.innerHTML = stats + (list.length
        ? `<div class="hx-repos">${list.map((r) => `<a class="panel hx-repo" data-reveal href="${esc(r.html_url)}" target="_blank" rel="noopener">
            <div class="mono"><b>${esc(r.name)}</b>${r.archived ? ' <span class="dim">archived</span>' : ""}</div>
            <p>${r.description ? esc(r.description) : '<span class="dim">no description</span>'}</p>
            <div class="mono dim small">${r.language ? esc(r.language) + " · " : ""}★ ${r.stargazers_count} · ${esc(ago(r.pushed_at))}</div></a>`).join("")}</div>`
        : `<div class="placeholder">no public repositories yet<br><span class="dim">they show up here automatically when ${esc(org)} publishes one</span></div>`);
      reveal(box);
    } catch (e) {
      box.innerHTML = `<div class="placeholder">couldn't reach github right now (${esc(e.message)})<br><a href="https://github.com/${esc(org)}" target="_blank" rel="noopener">github.com/${esc(org)} →</a></div>`;
    }
  })();

  // glow follows the mouse (drawn by the scene shader)
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") document.body.classList.add("has-mouse"); }, { passive: true, once: true });
})();
