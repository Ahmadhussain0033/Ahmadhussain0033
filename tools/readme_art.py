#!/usr/bin/env python3
"""
Generates the animated SVGs used in README.md:
  assets/readme/banner.svg     — space + rotating 3D wireframe + name
  assets/readme/divider.svg    — waveform that goes from noise to signal
  assets/readme/nowplaying.svg — little "now playing" card

Text is converted to vector paths (so it looks identical everywhere — SVGs shown
through <img> can't load web fonts).

usage:  pip install fonttools && python3 tools/readme_art.py [fonts_dir]
fonts_dir must contain outfit.ttf and jbm.ttf (Google Fonts: Outfit, JetBrains Mono variable).
"""
import math
import os
import random
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = sys.argv[1] if len(sys.argv) > 1 else "fonts"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "readme")
os.makedirs(OUT, exist_ok=True)
random.seed(7)

NAME_A, NAME_B = "AHMAD", "HUSSAIN"
HANDLE = "@nerdatronic"
SUB = "aspiring information theorist  ·  researcher  ·  a bit of everything"
BAND = "  INFORMATION THEORY  //  RESEARCH  //  SIGNAL FROM NOISE  //  A BIT OF EVERYTHING  //"

BG, FG, HI, DIM, MUTE, Y = "#0a0a0b", "#d6d6da", "#f5f5f6", "#8a8a93", "#5d5d65", "#4fe3ff"  # Y = accent (cyan)


def load(path, wght):
    f = TTFont(path)
    return instancer.instantiateVariableFont(f, {"wght": wght})


def text_path(font, text, size, x, y, spacing=0.0):
    """Return (svg path d, advance width) for text with baseline at (x, y)."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    s = size / upm
    d, cx = [], x
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            cx += size * 0.5
            continue
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, (s, 0, 0, -s, cx, y)))
        d.append(pen.getCommands())
        cx += gs[gname].width * s + spacing
    return " ".join(d), cx - x - spacing


# ---------------------------------------------------------------- geometry
def icosahedron(sub=1):
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    v = [tuple(c / math.sqrt(sum(a * a for a in p)) for c in p) for p in v]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(sub):
        cache, nf = {}, []

        def mid(a, b):
            k = tuple(sorted((a, b)))
            if k not in cache:
                p = [(v[a][i] + v[b][i]) / 2 for i in range(3)]
                n = math.sqrt(sum(c * c for c in p))
                v.append(tuple(c / n for c in p))
                cache[k] = len(v) - 1
            return cache[k]

        for a, b, c in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    edges = set()
    for a, b, c in f:
        for e in ((a, b), (b, c), (c, a)):
            edges.add(tuple(sorted(e)))
    return v, sorted(edges)


def rot(p, ax, ay):
    x, y, z = p
    y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
    x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
    return x, y, z


def proj(p, cx, cy, R, cam=4.2):
    x, y, z = p
    k = cam / (cam - z)
    return cx + x * R * k, cy - y * R * k, z


def wire_frames(sub, R, cx, cy, frames, tilt=0.42):
    v, e = icosahedron(sub)
    out = []
    for i in range(frames):
        ay = (i / frames) * 2 * math.pi
        P = [proj(rot(p, tilt, ay), cx, cy, R) for p in v]
        out.append(" ".join(f"M{P[a][0]:.1f} {P[a][1]:.1f}L{P[b][0]:.1f} {P[b][1]:.1f}" for a, b in e))
    return out


def ellipse_path(cx, cy, rx, ry):
    return f"M{cx - rx} {cy}a{rx} {ry} 0 1 0 {2 * rx} 0a{rx} {ry} 0 1 0 {-2 * rx} 0"


# ---------------------------------------------------------------- banner
def banner(display, display_b, mono):
    W, H = 1200, 420
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Ahmad Hussain — aspiring information theorist">']
    o.append(f"""<defs>
  <radialGradient id="neb1" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9a9aa2" stop-opacity=".30"/><stop offset="1" stop-color="#9a9aa2" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{Y}" stop-opacity=".10"/><stop offset="1" stop-color="{Y}" stop-opacity="0"/></radialGradient>
  <radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
  <pattern id="half" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.3" fill="#fff" fill-opacity=".09"/></pattern>
  <linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="halfMask"><rect width="{W}" height="{H}" fill="url(#fadeL)"/></mask>
  <clipPath id="clip"><rect width="{W}" height="{H}" rx="18"/></clipPath>
  <clipPath id="bandClip"><polygon points="560,{H} 1200,268 1200,314 754,{H}"/></clipPath>
  <style>
    .tw{{animation:tw 3s ease-in-out infinite}} @keyframes tw{{50%{{opacity:.15}}}}
    .drift{{animation:drift 30s ease-in-out infinite alternate}} @keyframes drift{{to{{transform:translate(-60px,20px)}}}}
    .ap{{transform-origin:900px 200px;animation:ap 2.4s linear infinite}} @keyframes ap{{0%{{transform:scale(1.9);opacity:0}}25%{{opacity:.7}}100%{{transform:scale(1);opacity:0}}}}
    .spin{{transform-origin:900px 200px;animation:spin 18s linear infinite}} .spin2{{transform-origin:900px 200px;animation:spin 26s linear infinite reverse}} @keyframes spin{{to{{transform:rotate(360deg)}}}}
    .slab{{animation:slab .9s cubic-bezier(.22,1,.36,1) both}} @keyframes slab{{from{{transform:translateX(-80px);opacity:0}}}}
    .caret{{animation:blink 1s steps(2) infinite}} @keyframes blink{{50%{{opacity:0}}}}
  </style>
</defs>""")
    o.append(f'<g clip-path="url(#clip)"><rect width="{W}" height="{H}" fill="{BG}"/>')
    # nebula
    o.append(f'<g class="drift"><ellipse cx="880" cy="170" rx="420" ry="230" fill="url(#neb1)"/><ellipse cx="1000" cy="250" rx="260" ry="160" fill="url(#neb2)"/><ellipse cx="260" cy="360" rx="380" ry="160" fill="url(#neb1)" opacity=".5"/></g>')
    # stars
    for i in range(170):
        x, y = random.uniform(0, W), random.uniform(0, H)
        r = random.choice([0.6, 0.7, 0.8, 1.0, 1.2, 1.6]) if random.random() > 0.05 else 2.2
        col = Y if random.random() < 0.03 else "#e8e8ec"
        cls = ' class="tw"' if random.random() < 0.4 else ""
        delay = f' style="animation-delay:{random.uniform(0, 3):.2f}s"' if cls else ""
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{col}" opacity="{random.uniform(.35, .95):.2f}"{cls}{delay}/>')
    # halftone on the left
    o.append(f'<rect width="{W}" height="{H}" fill="url(#half)" mask="url(#halfMask)"/>')
    # 3D wireframe (rotating via path morph)
    frames = 36
    outer = wire_frames(1, 150, 900, 200, frames)
    inner = wire_frames(0, 62, 900, 200, frames, tilt=-0.7)
    vals = ";".join(outer + [outer[0]])
    vals_i = ";".join(inner[::-1] + [inner[-1]])
    o.append(f'<circle class="ap" cx="900" cy="200" r="160" fill="none" stroke="#fff" stroke-width="2"/>')
    o.append(f'<path d="{outer[0]}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1"><animate attributeName="d" dur="16s" repeatCount="indefinite" values="{vals}"/></path>')
    o.append(f'<path d="{inner[-1]}" fill="none" stroke="#c8c8cc" stroke-opacity=".9" stroke-width="1.4"><animate attributeName="d" dur="10s" repeatCount="indefinite" values="{vals_i}"/></path>')
    o.append('<circle cx="900" cy="200" r="34" fill="#8a8a90" fill-opacity=".18"/>')
    # gyroscope rings
    e1, e2, e3 = ellipse_path(900, 200, 205, 58), ellipse_path(900, 200, 222, 74), ellipse_path(900, 200, 240, 40)
    o.append(f'<g class="spin"><path id="r2" d="{e2}" fill="none" stroke="{Y}" stroke-opacity=".85" stroke-width="1.6" transform="rotate(-28 900 200)"/>'
             f'<circle r="5" fill="{Y}"><animateMotion dur="5s" repeatCount="indefinite" rotate="auto"><mpath href="#r2"/></animateMotion></circle></g>')
    o.append(f'<g class="spin2"><path d="{e1}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" transform="rotate(14 900 200)"/><path d="{e3}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1" transform="rotate(62 900 200)"/></g>')
    # band (persona-ish diagonal marquee)
    o.append('<g clip-path="url(#bandClip)">')
    o.append(f'<polygon points="560,{H} 1200,268 1200,314 754,{H}" fill="{Y}"/>')
    bd, bw = text_path(mono, BAND, 17, 0, 0, 1.5)
    slope = (268 - H) / (1200 - 560)
    ang = math.degrees(math.atan(slope))
    x0 = 700
    y0 = H + (x0 - 560) * slope + 29
    o.append(f'<g transform="translate({x0} {y0:.1f}) rotate({ang:.2f})"><g><path d="{bd}" fill="#0a0a0b"/><path d="{bd}" fill="#0a0a0b" transform="translate({bw:.1f} 0)"/>'
             f'<animateTransform attributeName="transform" type="translate" from="0 0" to="{-bw:.1f} 0" dur="22s" repeatCount="indefinite"/></g></g>')
    o.append("</g>")
    # name
    a_d, a_w = text_path(display, NAME_A, 112, 64, 168, -2)
    b_d, b_w = text_path(display_b, NAME_B, 92, 86, 286, -1)
    o.append(f'<g class="slab"><path d="{a_d}" fill="{HI}"/></g>')
    sk = 22
    o.append(f'<g class="slab" style="animation-delay:.15s"><polygon points="{64 + sk},196 {86 + b_w + 34 + sk},196 {86 + b_w + 34},306 64,306" fill="{HI}"/>'
             f'<polygon points="{64 + sk + 8},196 {64 + sk + 22},196 {64 + 14},306 64,306" fill="{Y}"/>'
             f'<path d="{b_d}" fill="{BG}"/></g>')
    h_d, h_w = text_path(mono, HANDLE, 17, 0, 0, 0.5)
    hx, hy = 64 + a_w + 26, 112
    o.append(f'<g transform="translate({hx:.0f} {hy}) rotate(-7)"><rect x="-12" y="-22" width="{h_w + 24:.0f}" height="32" fill="{Y}"/><path d="{h_d}" fill="{BG}"/></g>')
    s_d, s_w = text_path(mono, SUB, 16, 66, 346, 0.2)
    o.append(f'<path d="{s_d}" fill="{DIM}"/>')
    o.append(f'<rect class="caret" x="{66 + s_w + 8:.0f}" y="332" width="9" height="17" fill="{HI}"/>')
    # top-left mono tag
    t_d, _ = text_path(mono, "~/ahmad/readme.md", 13, 66, 52, 0.3)
    o.append(f'<circle cx="54" cy="47.5" r="4" fill="#6ee7a0"/><path d="{t_d}" fill="{MUTE}"/>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vig)" pointer-events="none"/>')
    o.append(f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="18" fill="none" stroke="#222226"/>')
    o.append("</g></svg>")
    return "\n".join(o)


# ---------------------------------------------------------------- divider
def divider():
    W, H, n = 1200, 36, 160
    frames = []
    rnd = [random.gauss(0, 1) for _ in range(n + 1)]
    for amp in (1.0, 0.7, 0.4, 0.15, 0.0, 0.0, 0.15, 0.4, 0.7, 1.0):
        pts = []
        for i in range(n + 1):
            x = i / n * W
            env = math.sin(math.pi * i / n)
            y = H / 2 + env * (7 * math.sin(i / n * 2 * math.pi * 9) + amp * 6 * rnd[i])
            pts.append(f"{x:.1f} {y:.1f}")
        frames.append("M" + " L".join(pts))
    vals = ";".join(frames)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="divider">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="{FG}" stop-opacity="0"/><stop offset=".5" stop-color="{FG}"/><stop offset="1" stop-color="{FG}" stop-opacity="0"/></linearGradient></defs>
<path d="{frames[0]}" fill="none" stroke="url(#g)" stroke-width="1.6"><animate attributeName="d" dur="6s" repeatCount="indefinite" values="{vals}"/></path>
<circle cx="600" cy="{H / 2}" r="3.5" fill="{Y}"><animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite"/></circle>
</svg>"""


# ---------------------------------------------------------------- now playing
def nowplaying(display, mono):
    W, H = 600, 120
    t_d, _ = text_path(display, "STRUCT", 30, 128, 58, 1)
    a_d, _ = text_path(mono, "super slowed + reverb  ·  site soundtrack", 12, 128, 82, 0.2)
    l_d, _ = text_path(mono, "NOW PLAYING", 10, 128, 30, 2)
    bars = []
    for i in range(18):
        hs = [random.uniform(4, 34) for _ in range(6)]
        v = ";".join(f"{h:.1f}" for h in hs + [hs[0]])
        ys = ";".join(f"{100 - h:.1f}" for h in hs + [hs[0]])
        bars.append(f'<rect x="{440 + i * 8}" y="{100 - hs[0]:.1f}" width="5" height="{hs[0]:.1f}" rx="1" fill="{HI}" fill-opacity="{0.35 + (i % 5) * 0.12:.2f}">'
                    f'<animate attributeName="height" values="{v}" dur="{1.6 + (i % 4) * 0.3:.1f}s" repeatCount="indefinite"/>'
                    f'<animate attributeName="y" values="{ys}" dur="{1.6 + (i % 4) * 0.3:.1f}s" repeatCount="indefinite"/></rect>')
    grooves = "".join(f'<circle cx="62" cy="60" r="{r}" fill="none" stroke="#2a2a30" stroke-width="1"/>' for r in range(20, 44, 3))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="now playing: STRUCT (super slowed)">
<style>.disc{{transform-origin:62px 60px;animation:s 3.2s linear infinite}}@keyframes s{{to{{transform:rotate(360deg)}}}}</style>
<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" fill="#101012" stroke="#222226"/>
<g class="disc"><circle cx="62" cy="60" r="44" fill="#16161a"/>{grooves}<circle cx="62" cy="60" r="15" fill="{HI}"/><rect x="58" y="47" width="8" height="5" fill="{Y}"/><circle cx="62" cy="60" r="3.5" fill="#0a0a0b"/></g>
<path d="{l_d}" fill="{Y}"/><path d="{t_d}" fill="{HI}"/><path d="{a_d}" fill="{DIM}"/>
<rect x="128" y="94" width="250" height="3" rx="1.5" fill="#2a2a30"/><rect x="128" y="94" width="0" height="3" rx="1.5" fill="{HI}"><animate attributeName="width" values="0;250" dur="40s" repeatCount="indefinite"/></rect>
{''.join(bars)}
</svg>"""


if __name__ == "__main__":
    disp = load(os.path.join(FONTS, "outfit.ttf"), 800)
    disp_b = load(os.path.join(FONTS, "outfit.ttf"), 800)
    mono = load(os.path.join(FONTS, "jbm.ttf"), 500)
    for name, svg in (("banner.svg", banner(disp, disp_b, mono)), ("divider.svg", divider()), ("nowplaying.svg", nowplaying(disp, mono))):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            fh.write(svg)
        print(name, len(svg) // 1024, "KB")
