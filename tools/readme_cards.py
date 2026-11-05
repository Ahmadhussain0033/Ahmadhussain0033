#!/usr/bin/env python3
"""
Generates the animated cards in the middle of README.md from js/config.js + live stats:
  assets/readme/card-player.svg   osu!-style profile card (avatar, rank, stats, level bar)
  assets/readme/card-medals.svg   achievements as medals (locked ones included)
  assets/readme/card-now.svg      what you're on right now (config.now + next-year goals)
  assets/readme/card-support.svg  the ledger / support strip

Data:
  js/config.js               read through node (it's plain JS)
  assets/readme/stats.json   written by tools/stats_svg.py (contributions, streaks, repos)
  GitHub (optional)          your avatar; the cards still render without it

usage: pip install fonttools && python3 tools/readme_cards.py
Runs in .github/workflows/readme-stats.yml, so editing config.js updates the README by itself.
Text is converted to vector paths (SVGs inside <img> can't load web fonts).
"""
import base64
import datetime as dt
import json
import math
import os
import re
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from readme_art import load, text_path  # noqa: E402

OUT = os.path.join(ROOT, "assets", "readme")
FONTS = os.path.join(HERE, "fonts")

BG, PANEL, LINE, LINE2 = "#0a0a0b", "#0f0f12", "#1f1f24", "#2a2a30"
FG, HI, DIM, MUTE = "#d6d6da", "#f5f5f6", "#8a8a93", "#5d5d65"
ACC, GREEN, YELLOW, RED = "#4fe3ff", "#6ee7a0", "#ffd166", "#ff5d73"
GRADE_COL = {"SS": HI, "S": ACC, "A": GREEN, "B": "#9aa4c7", "C": "#b79bd9", "D": RED}
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""


# ------------------------------------------------------------------ data
def site_config():
    js = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.SITE))"
    out = subprocess.run(["node", "-e", js, os.path.join(ROOT, "js", "config.js")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def http(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "readme-cards", "Accept": "application/vnd.github+json"})
    if TOKEN and "api.github.com" in url:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
            return data if binary else json.loads(data)
    except Exception as e:  # cards still render without live data
        print("  (skipped", url, "-", e, ")")
        return None


def has(v):
    return v is not None and str(v).strip() != ""


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def age_level(C, today=None):
    """level = age. With birthday "MM-DD" it ticks up on the day and returns progress
    through the current year; without it, the configured value and no progress."""
    A = C.get("age") or {}
    val = A.get("value")
    if not isinstance(val, int):
        return None, None
    today = today or dt.date.today()
    bday = str(A.get("birthday") or "")
    try:
        m, d = (int(x) for x in bday.split("-"))
        as_of = dt.date.fromisoformat(A.get("asOf") or today.isoformat())
    except ValueError:
        return val, None

    def on(year):  # the birthday in a given year (29 Feb → 28 Feb in non-leap years)
        try:
            return dt.date(year, m, d)
        except ValueError:
            return dt.date(year, m, 28)

    born = as_of.year - val - (0 if as_of >= on(as_of.year) else 1)
    last = on(today.year) if today >= on(today.year) else on(today.year - 1)
    nxt = on(last.year + 1)
    return last.year - born, (today - last).days / max(1, (nxt - last).days)


# ------------------------------------------------------------------ text helpers
class T:
    """text → vector path, with measuring and alignment"""

    def __init__(self):
        self.disp = load(os.path.join(FONTS, "outfit.ttf"), 800)
        self.semi = load(os.path.join(FONTS, "outfit.ttf"), 600)
        self.mono = load(os.path.join(FONTS, "jbm.ttf"), 500)
        self.monob = load(os.path.join(FONTS, "jbm.ttf"), 700)

    def path(self, font, text, size, x, y, fill, sp=0.0, anchor="start", extra=""):
        d, w = text_path(font, text, size, 0, 0, sp)
        d = re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}".rstrip("0").rstrip("."), d)  # 0.1px is plenty
        if anchor == "middle":
            x -= w / 2
        elif anchor == "end":
            x -= w
        return f'<path transform="translate({x:.1f} {y:.1f})" d="{d}" fill="{fill}"{extra}/>', w

    def width(self, font, text, size, sp=0.0):
        return text_path(font, text, size, 0, 0, sp)[1]

    def fit(self, font, text, size, maxw, sp=0.0):
        """shrink text until it fits maxw (min 60%), then truncate with …"""
        s = size
        while s > size * 0.6 and self.width(font, text, s, sp) > maxw:
            s -= 0.5
        while self.width(font, text, s, sp) > maxw and len(text) > 2:
            text = text[:-2] + "…"
        return text, s


def wrap(text, n):
    words, lines, cur = str(text).split(), [], ""
    for w in words:
        if len(cur) + len(w) + (1 if cur else 0) > n:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}" if cur else w
    if cur:
        lines.append(cur)
    return lines


def hexagon(cx, cy, r, rot=-90):
    pts = []
    for i in range(6):
        a = math.radians(rot + 60 * i)
        pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    return " ".join(pts)


def frame(W, H, inner, label):
    """shared panel chrome: rounded panel, faint halftone corner, skewed accent shards"""
    dots = "".join(f'<circle cx="{W - 26 - c * 11}" cy="{22 + r * 11}" r="{1.6 - (c + r) * 0.09:.2f}" fill="{HI}" fill-opacity=".07"/>'
                   for r in range(7) for c in range(12) if 1.6 - (c + r) * 0.09 > 0.25)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(label)}">
<defs>
  <linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="panel"><rect x="1" y="1" width="{W - 2}" height="{H - 2}" rx="20"/></clipPath>
</defs>
<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="20" fill="{PANEL}" stroke="{LINE}"/>
<g clip-path="url(#panel)">
  {dots}
  <rect x="-300" y="-40" width="140" height="{H + 80}" fill="url(#shine)" transform="skewX(-18)"><animate attributeName="x" values="-300;{W + 300}" dur="7s" repeatCount="indefinite"/></rect>
  {inner}
</g>
</svg>"""


# ------------------------------------------------------------------ cards
def player_card(t, C, st, avatar):
    W, H = 1200, 400
    name = (C.get("name") or "").upper()
    handle = "@" + (C.get("handle") or "")
    roles = [r for r in (C.get("roles") or []) if has(r)]
    roles = [r.split(" ", 1)[1] if r.split(" ", 1)[0] in ("a", "an", "the") and " " in r else r for r in roles]
    org = (C.get("hexoro") or {}).get("name") or ""
    ach = C.get("achievements") or []
    unlocked = [a for a in ach if has(a.get("title"))]
    order = ["SS", "S", "A", "B", "C", "D"]
    best = min(unlocked, key=lambda a: order.index(a.get("grade", "D")) if a.get("grade") in order else 9) if unlocked else None
    total = int(st.get("total") or 0)
    lvl, prog = age_level(C)
    if lvl is None:  # no age configured → fall back to a level from contributions
        lvl = int(math.isqrt(total)) if total > 0 else 0
        prog = (total - lvl * lvl) / max(1, (lvl + 1) ** 2 - lvl * lvl)
    ring = prog if prog is not None else 1.0

    parts = []
    # persona-style skewed shards behind the right side
    parts.append(f'<polygon points="760,0 1200,0 1200,{H} 640,{H}" fill="{ACC}" fill-opacity=".05"/>')
    parts.append(f'<polygon points="910,0 960,0 860,{H} 810,{H}" fill="{ACC}" fill-opacity=".09"/>')
    parts.append(f'<polygon points="986,0 994,0 894,{H} 886,{H}" fill="{ACC}" fill-opacity=".5"/>')

    # avatar + rings
    cx, cy, R = 160, 176, 96
    if avatar:
        parts.append(f'<defs><clipPath id="av"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath>'
                     f'<filter id="gray"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.08"/><feFuncG type="linear" slope="1.08"/><feFuncB type="linear" slope="1.08"/></feComponentTransfer></filter></defs>'
                     f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="{LINE2}"/>'
                     f'<image href="{avatar}" x="{cx - R}" y="{cy - R}" width="{2 * R}" height="{2 * R}" clip-path="url(#av)" filter="url(#gray)" preserveAspectRatio="xMidYMid slice"/>')
    else:
        a, _ = t.path(t.disp, (name or "?")[0], 90, cx, cy + 32, HI, anchor="middle")
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="{LINE2}"/>{a}')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 8}" fill="none" stroke="{BG}" stroke-width="6"/>')
    circ = 2 * math.pi * (R + 16)
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 16}" fill="none" stroke="{LINE2}" stroke-width="4"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 16}" fill="none" stroke="{ACC}" stroke-width="4" stroke-linecap="round" '
                 f'stroke-dasharray="0 {circ:.1f}" transform="rotate(-90 {cx} {cy})">'
                 f'<animate attributeName="stroke-dasharray" values="0 {circ:.1f};{circ * ring:.1f} {circ:.1f}" dur="1.6s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/></circle>')
    ticks = "".join(f'<line x1="{cx}" y1="{cy - R - 26}" x2="{cx}" y2="{cy - R - (32 if i % 6 == 0 else 29)}" stroke="{HI if i % 6 == 0 else MUTE}" stroke-width="{2 if i % 6 == 0 else 1}" transform="rotate({i * 7.5} {cx} {cy})"/>' for i in range(48))
    parts.append(f'<g>{ticks}<animateTransform attributeName="transform" type="rotate" from="0 {cx} {cy}" to="360 {cx} {cy}" dur="60s" repeatCount="indefinite"/></g>')
    lv, _ = t.path(t.monob, f"LV.{lvl}", 13, cx, cy + R + 52, HI, 1.5, "middle")
    parts.append(f'<rect x="{cx - 36}" y="{cy + R + 34}" width="72" height="26" rx="13" fill="{BG}" stroke="{ACC}"/>{lv}')

    # name block
    x0 = 320
    nm, ns = t.fit(t.disp, name, 60, 560, 0.5)
    p, _ = t.path(t.disp, nm, ns + 0, x0 + 4, 112, ACC, 0.5, extra=' fill-opacity=".9"')
    parts.append(p)
    p, _ = t.path(t.disp, nm, ns, x0, 108, HI, 0.5)
    parts.append(p)
    p, hw = t.path(t.mono, handle, 17, x0, 146, DIM)
    parts.append(p)
    if org:
        ow = t.width(t.monob, org.upper(), 12, 1.5)
        parts.append(f'<g transform="translate({x0 + hw + 16} 128) skewX(-12)"><rect width="{ow + 22}" height="24" rx="5" fill="{ACC}"/></g>')
        p, _ = t.path(t.monob, org.upper(), 12, x0 + hw + 27 + ow / 2, 145, BG, 1.5, "middle")
        parts.append(p)
    if roles:
        line, s = t.fit(t.mono, "  ·  ".join(roles[:3]), 15, 600)
        p, _ = t.path(t.mono, line, s, x0, 180, FG)
        parts.append(p)
    if has(C.get("motto")):
        parts.append(f'<rect x="{x0}" y="192" width="3" height="18" fill="{ACC}"/>')
        line, s = t.fit(t.semi, C["motto"], 15, 560)
        p, _ = t.path(t.semi, line, s, x0 + 12, 206, HI)
        parts.append(p)

    # stats
    stats = [
        (st.get("last_year"), "CONTRIBS · 1Y"),
        (f'{st["current"]}d' if st.get("current") is not None else None, "CURRENT STREAK"),
        (st.get("public_repos"), "PUBLIC REPOS"),
        (f"{len(unlocked)}/{len(ach)}" if ach else None, "MEDALS"),
    ]
    stats = [s for s in stats if s[0] is not None]
    for i, (v, label) in enumerate(stats):
        x = x0 + i * 140
        parts.append(f'<line x1="{x - 14}" y1="230" x2="{x - 14}" y2="290" stroke="{LINE2}"/>' if i else "")
        p, _ = t.path(t.disp, str(v), 44, x, 272, HI)
        parts.append(p)
        p, _ = t.path(t.mono, label, 10.5, x, 290, MUTE, 1.2)
        parts.append(p)

    # level bar
    bx, by, bw = x0, 334, 820
    parts.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="8" rx="4" fill="{LINE2}"/>')
    if prog is not None:
        parts.append(f'<rect x="{bx}" y="{by}" width="0" height="8" rx="4" fill="{ACC}"><animate attributeName="width" values="0;{bw * prog:.1f}" dur="1.6s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/></rect>')
        txt = f"LV.{lvl}  {round(prog * 100)}% to LV.{lvl + 1}  ·  levels up every birthday  ·  {total} contributions"
    else:
        # no birthday set: a scanning sweep instead of a fake progress number
        parts.append(f'<rect x="{bx}" y="{by}" width="120" height="8" rx="4" fill="{ACC}" fill-opacity=".8"><animate attributeName="x" values="{bx};{bx + bw - 120};{bx}" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1"/></rect>')
        txt = f"LV.{lvl}  ·  level = age  ·  {total} contributions all time"
    p, _ = t.path(t.mono, txt, 11, bx, by + 30, DIM)
    parts.append(p)

    # rank
    rx, ry = 1060, 162
    if best:
        g = best.get("grade", "SS")
        col = GRADE_COL.get(g, HI)
        parts.append(f'<circle cx="{rx}" cy="{ry}" r="86" fill="{BG}" stroke="{LINE2}" stroke-width="3"/>')
        parts.append(f'<circle cx="{rx}" cy="{ry}" r="74" fill="#141418" stroke="{col}" stroke-width="7"/>')
        parts.append(f'<circle cx="{rx}" cy="{ry}" r="86" fill="none" stroke="{ACC}" stroke-width="2" stroke-dasharray="6 10" opacity=".8">'
                     f'<animateTransform attributeName="transform" type="rotate" from="0 {rx} {ry}" to="-360 {rx} {ry}" dur="24s" repeatCount="indefinite"/></circle>')
        p, _ = t.path(t.disp, g, 64, rx, ry + 23, col, 1, "middle", extra=f' transform-origin="{rx} {ry}"')
        parts.append(f'<g transform="skewX(-10) translate({ry * math.tan(math.radians(10)):.1f} 0)">{p}</g>')
        parts.append(f'<circle cx="{rx}" cy="{ry}" r="74" fill="none" stroke="{col}" stroke-width="2" opacity=".0"><animate attributeName="r" values="74;96" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="2.4s" repeatCount="indefinite"/></circle>')
        p, _ = t.path(t.monob, "BEST RANK", 11, rx, ry + 116, MUTE, 2, "middle")
        parts.append(p)
        lbl = best.get("title", "").split("·")[-1].strip().upper()
        lbl, s = t.fit(t.mono, lbl, 13, 200)
        p, _ = t.path(t.mono, lbl, s, rx, ry + 136, HI, 0.5, "middle")
        parts.append(p)
    if st.get("updated"):
        p, _ = t.path(t.mono, st["updated"], 10, W - 24, H - 18, MUTE, 0.5, "end")
        parts.append(p)
    return frame(W, H, "\n".join(parts), f"{C.get('name')} — level {lvl}, {st.get('last_year', 0)} contributions in the last year")


def medals_card(t, C):
    W, H = 600, 330
    ach = (C.get("achievements") or [])[:8]
    unlocked = sum(1 for a in ach if has(a.get("title")))
    parts = []
    p, tw = t.path(t.disp, "MEDALS", 28, 28, 52, HI, 1)
    parts.append(p)
    p, _ = t.path(t.mono, f"{unlocked} / {len(ach)} unlocked", 12, 28 + tw + 14, 50, DIM)
    parts.append(p)
    parts.append(f'<rect x="28" y="64" width="{tw}" height="5" fill="{ACC}" transform="skewX(-20)"/>')
    for i, a in enumerate(ach):
        col_i, row = i % 4, i // 4
        cx, cy = 84 + col_i * 144, 128 + row * 122
        g = a.get("grade") or "?"
        on = has(a.get("title"))
        col = GRADE_COL.get(g, HI) if on else LINE2
        delay = f"{0.15 * i:.2f}s"
        inner = [f'<circle cx="{cx}" cy="{cy}" r="38" fill="{BG}" stroke="{LINE2}" stroke-width="2"/>',
                 f'<circle cx="{cx}" cy="{cy}" r="31" fill="#141418" stroke="{col}" stroke-width="{5 if on else 2}"/>']
        if on:
            inner.append(f'<circle cx="{cx}" cy="{cy}" r="38" fill="none" stroke="{ACC}" stroke-width="1.5" stroke-dasharray="4 7">'
                         f'<animateTransform attributeName="transform" type="rotate" from="0 {cx} {cy}" to="360 {cx} {cy}" dur="14s" repeatCount="indefinite"/></circle>')
            p, _ = t.path(t.disp, g, 28, cx, cy + 10, col, 0.5, "middle")
            inner.append(p)
            label = a.get("title", "").split("·")[-1].strip().upper()
            label, s = t.fit(t.monob, label, 11, 130, 0.5)
            p, _ = t.path(t.monob, label, s, cx, cy + 60, HI, 0.5, "middle")
            inner.append(p)
            sub = a.get("date") or ""
            if sub:
                p, _ = t.path(t.mono, sub, 9.5, cx, cy + 75, DIM, 0.5, "middle")
                inner.append(p)
        else:
            # padlock
            inner.append(f'<rect x="{cx - 9}" y="{cy - 2}" width="18" height="14" rx="3" fill="{MUTE}"/>'
                         f'<path d="M{cx - 5.5} {cy - 2} v-5 a5.5 5.5 0 0 1 11 0 v5" fill="none" stroke="{MUTE}" stroke-width="2.5"/>')
            p, _ = t.path(t.mono, "LOCKED", 10, cx, cy + 60, MUTE, 1.5, "middle")
            inner.append(p)
        parts.append(f'<g opacity="0"><animate attributeName="opacity" values="0;1" begin="{delay}" dur=".5s" fill="freeze"/>{"".join(inner)}</g>')
    return frame(W, H, "\n".join(parts), f"medals: {unlocked} of {len(ach)} unlocked")


def now_card(t, C):
    """what you're on right now: config.now (+ the next-year goals from config.roadmap)"""
    W, H = 600, 330
    parts = []
    p, tw = t.path(t.disp, "RIGHT NOW", 28, 28, 52, HI, 1)
    parts.append(p)
    if has(C.get("nowUpdated")):
        p, _ = t.path(t.mono, "updated " + C["nowUpdated"].lower(), 12, 28 + tw + 14, 50, DIM)
        parts.append(p)
    parts.append(f'<rect x="28" y="64" width="{tw}" height="5" fill="{ACC}" transform="skewX(-20)"/>')
    dot = {"done": GREEN, "doing": YELLOW, "blocked": RED}
    y = 102
    items = [n for n in (C.get("now") or []) if has(n.get("text"))][:4]
    for k, n in enumerate(items):
        head, _, rest = str(n["text"]).partition(":")
        col = dot.get(n.get("status"), MUTE)
        parts.append(f'<circle cx="38" cy="{y - 5}" r="5" fill="{col}"><animate attributeName="opacity" values="1;.35;1" dur="2.4s" begin="{k * 0.3:.1f}s" repeatCount="indefinite"/></circle>')
        line, s = t.fit(t.semi, head.strip(), 17, 520)
        p, _ = t.path(t.semi, line, s, 54, y, HI)
        parts.append(p)
        y += 20
        for ln in wrap(rest.strip(), 62)[:2]:
            p, _ = t.path(t.mono, ln, 11, 54, y, DIM)
            parts.append(p)
            y += 16
        y += 12
    nxt = [i.get("text") for ph in (C.get("roadmap") or []) if str(ph.get("title", "")).lower() == "next year" for i in (ph.get("items") or []) if has(i.get("text"))]
    if nxt and y < H - 30:
        line, s = t.fit(t.mono, "NEXT  →  " + "  ·  ".join(nxt[:2]), 11, 540)
        p, _ = t.path(t.mono, line, s, 28, H - 26, ACC)
        parts.append(p)
    return frame(W, H, "\n".join(parts), "right now: " + "; ".join(i["text"] for i in items))


def support_card(t, C):
    W, H = 1200, 172
    L = C.get("ledger") or {}
    parts = []
    parts.append(f'<polygon points="0,0 230,0 190,{H} 0,{H}" fill="{GREEN}" fill-opacity=".08"/>')
    # heart that beats
    hx, hy = 96, 86
    heart = f"M{hx} {hy + 26} C{hx - 46} {hy - 4} {hx - 26} {hy - 40} {hx} {hy - 18} C{hx + 26} {hy - 40} {hx + 46} {hy - 4} {hx} {hy + 26} Z"
    parts.append(f'<g transform="translate({hx} {hy})"><g><path d="{heart}" transform="translate({-hx} {-hy})" fill="{GREEN}"/>'
                 f'<animateTransform attributeName="transform" type="scale" values="1;1.12;1;1.06;1" dur="1.4s" repeatCount="indefinite"/></g></g>')
    x0 = 230
    p, _ = t.path(t.monob, "SUPPORT", 11, x0, 44, GREEN, 2.5)
    parts.append(p)
    p, _ = t.path(t.disp, "BACK WHAT I'M BUILDING", 34, x0, 84, HI, 0.5)
    parts.append(p)
    about = L.get("why") or L.get("about") or ""
    y = 112
    if has(about):
        for ln in wrap(about, 86)[:2]:
            line, s = t.fit(t.mono, ln, 12.5, 680)
            p, _ = t.path(t.mono, line, s, x0, y, DIM)
            parts.append(p)
            y += 18
    links = "  ·  ".join(l.get("label", "") for l in (L.get("links") or []))
    if links:
        line, s = t.fit(t.mono, links, 11, 640)
        p, _ = t.path(t.mono, line, s, x0, y + 8, MUTE)
        parts.append(p)
    cw = t.width(t.monob, "OPEN THE LEDGER  →", 13, 1)
    bx = W - 60 - cw - 32
    parts.append(f'<g transform="translate({bx} 63) skewX(-10)"><rect width="{cw + 32}" height="46" rx="8" fill="{GREEN}"/></g>')
    p, _ = t.path(t.monob, "OPEN THE LEDGER  →", 13, bx + 20, 91, BG, 1)
    parts.append(p)
    return frame(W, H, "\n".join(parts), "support: open the ledger — every donation, expense and receipt in one place")


# ------------------------------------------------------------------ main
def main():
    C = site_config()
    login = C.get("github") or "Ahmadhussain0033"
    try:
        with open(os.path.join(OUT, "stats.json"), encoding="utf-8") as fh:
            st = json.load(fh)
    except FileNotFoundError:
        st = {}
    avatar = None
    raw = http(f"https://github.com/{login}.png?size=240", binary=True) or http(f"https://avatars.githubusercontent.com/{login}?s=240", binary=True)
    if raw:
        mime = "image/png" if raw[:4] == b"\x89PNG" else "image/jpeg"
        avatar = f"data:{mime};base64," + base64.b64encode(raw).decode()
    t = T()
    for name, svg in (
        ("card-player.svg", player_card(t, C, st, avatar)),
        ("card-medals.svg", medals_card(t, C)),
        ("card-now.svg", now_card(t, C)),
        ("card-support.svg", support_card(t, C)),
    ):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            fh.write(svg)
        print(name, f"{len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
