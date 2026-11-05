#!/usr/bin/env python3
"""
Self-hosted README stats (replaces third-party streak / activity-graph services).

Fetches the contribution calendar from GitHub's GraphQL API and writes:
  assets/readme/streak.svg   — total contributions, current streak, longest streak
  assets/readme/contrib.svg  — last-52-weeks heatmap + last-30-days line

usage:
  GITHUB_TOKEN=... python3 tools/stats_svg.py [login]
  python3 tools/stats_svg.py --placeholder        # "syncing" state, no network
  python3 tools/stats_svg.py --demo               # synthetic data, for previewing the design only

Only the standard library is used. Runs daily via .github/workflows/readme-stats.yml.
"""
import datetime as dt
import json
import os
import random
import sys
import urllib.request

LOGIN = next((a for a in sys.argv[1:] if not a.startswith("--")), "Ahmadhussain0033")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "readme")

BG, PANEL, LINE, FG, HI, DIM, MUTE, ACC = "#0a0a0b", "#101012", "#222226", "#d6d6da", "#f5f5f6", "#8a8a93", "#5d5d65", "#4fe3ff"
RAMP = ["#1c1c21", "#0f4a57", "#167f93", "#2bb8d1", "#4fe3ff"]  # sequential, lightness increases monotonically
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
SANS = "'Segoe UI',Ubuntu,'Helvetica Neue',Arial,sans-serif"


# ------------------------------------------------------------------ data
def gql(token, query, variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Authorization": f"bearer {token}", "Content-Type": "application/json", "User-Agent": "readme-stats"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
    if out.get("errors"):
        raise RuntimeError(out["errors"])
    return out["data"]


def fetch_days(token, login):
    """Return {date: count} for every day since the account was created."""
    created = gql(token, "query($l:String!){user(login:$l){createdAt}}", {"l": login})["user"]["createdAt"]
    start = dt.date.fromisoformat(created[:10])
    today = dt.datetime.now(dt.timezone.utc).date()
    q = """query($l:String!,$f:DateTime!,$t:DateTime!){user(login:$l){contributionsCollection(from:$f,to:$t){
           contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}"""
    days = {}
    y = start.year
    while y <= today.year:  # the API allows at most one year per request
        f = max(start, dt.date(y, 1, 1))
        t = min(today, dt.date(y, 12, 31))
        cal = gql(token, q, {"l": login, "f": f"{f}T00:00:00Z", "t": f"{t}T23:59:59Z"})
        for w in cal["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]:
            for d in w["contributionDays"]:
                days[d["date"]] = d["contributionCount"]
        y += 1
    return days, start


def streaks(days):
    """current streak counts back from today; if today has 0 it counts back from yesterday (today isn't over)."""
    ds = sorted(days)
    if not ds:
        return 0, 0, None, None, None
    longest, lstart, lend, run, rstart = 0, None, None, 0, None
    for d in ds:
        if days[d] > 0:
            if run == 0:
                rstart = d
            run += 1
            if run > longest:
                longest, lstart, lend = run, rstart, d
        else:
            run = 0
    cur, i = 0, len(ds) - 1
    if days[ds[i]] == 0:
        i -= 1
    cstart = None
    while i >= 0 and days[ds[i]] > 0:
        cur += 1
        cstart = ds[i]
        i -= 1
    return cur, longest, (lstart, lend), cstart, ds[-1]


def fmt_date(s):
    if not s:
        return "—"
    d = dt.date.fromisoformat(s)
    return d.strftime("%b ") + str(d.day) + (d.strftime(", %Y") if d.year != dt.date.today().year else "")


# ------------------------------------------------------------------ svgs
def streak_svg(total, since, cur, longest, lrange, cstart, today, note=""):
    W, H = 600, 200
    ring_c = 2 * 3.14159 * 46
    frac = 1.0 if cur else 0.0
    cur_range = f"{fmt_date(cstart)} – {fmt_date(today)}" if cur else "start one today"
    lng_range = f"{fmt_date(lrange[0])} – {fmt_date(lrange[1])}" if longest else "—"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="GitHub streak: {total} contributions, current streak {cur} days, longest {longest} days">
<title>GitHub streak for {LOGIN}: {total} total contributions, current streak {cur} days, longest streak {longest} days</title>
<style>
 .n{{font:800 30px {SANS};fill:{HI}}} .l{{font:600 11px {MONO};fill:{DIM};letter-spacing:.12em;text-transform:uppercase}}
 .d{{font:400 11px {MONO};fill:{MUTE}}} .cn{{font:800 34px {SANS};fill:{HI}}}
 .ring{{stroke-dasharray:{ring_c:.1f};stroke-dashoffset:{ring_c:.1f};animation:fill 1.4s cubic-bezier(.22,1,.36,1) .2s forwards}}
 @keyframes fill{{to{{stroke-dashoffset:{ring_c * (1 - frac):.1f}}}}}
 .ap{{transform-origin:300px 92px;animation:ap 2.4s linear infinite}} @keyframes ap{{0%{{transform:scale(1.3);opacity:0}}30%{{opacity:.5}}100%{{transform:scale(1);opacity:0}}}}
 .in{{animation:in .8s ease both}} @keyframes in{{from{{opacity:0;transform:translateY(6px)}}}}
</style>
<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" fill="{PANEL}" stroke="{LINE}"/>
<line x1="200" y1="36" x2="200" y2="164" stroke="{LINE}"/><line x1="400" y1="36" x2="400" y2="164" stroke="{LINE}"/>
<g class="in"><text x="100" y="96" text-anchor="middle" class="n">{total:,}</text>
<text x="100" y="124" text-anchor="middle" class="l">contributions</text>
<text x="100" y="146" text-anchor="middle" class="d">since {fmt_date(since.isoformat()) if since else "—"}</text></g>
<circle class="ap" cx="300" cy="92" r="46" fill="none" stroke="{HI}" stroke-width="2"/>
<circle cx="300" cy="92" r="46" fill="none" stroke="{LINE}" stroke-width="6"/>
<circle class="ring" cx="300" cy="92" r="46" fill="none" stroke="{ACC}" stroke-width="6" stroke-linecap="round" transform="rotate(-90 300 92)"/>
<text x="300" y="104" text-anchor="middle" class="cn">{cur}</text>
<text x="300" y="164" text-anchor="middle" class="l" style="fill:{ACC}">current streak</text>
<text x="300" y="182" text-anchor="middle" class="d">{cur_range}</text>
<g class="in" style="animation-delay:.15s"><text x="500" y="96" text-anchor="middle" class="n">{longest}</text>
<text x="500" y="124" text-anchor="middle" class="l">longest streak</text>
<text x="500" y="146" text-anchor="middle" class="d">{lng_range}</text></g>
{f'<text x="{W - 14}" y="{H - 10}" text-anchor="end" class="d">{note}</text>' if note else ""}
</svg>"""


def level(c, mx):
    if c <= 0:
        return 0
    if mx <= 1:
        return 4
    return 1 + min(3, int((c - 1) / max(1, mx - 1) * 4))  # 1..4


def contrib_svg(days, note=""):
    W, H = 1200, 250
    today = max(days) if days else dt.date.today().isoformat()
    end = dt.date.fromisoformat(today)
    start = end - dt.timedelta(weeks=52)
    start -= dt.timedelta(days=(start.weekday() + 1) % 7)  # back up to Sunday → 53 columns max
    cells, d = [], start
    while d <= end:
        cells.append((d, days.get(d.isoformat(), 0)))
        d += dt.timedelta(days=1)
    year_vals = [c for _, c in cells]
    mx = max(year_vals) if year_vals else 0
    year_total = sum(year_vals)
    active = sum(1 for v in year_vals if v > 0)

    X0, Y0, S, G = 48, 64, 13, 3
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="GitHub contributions: {year_total} in the last year">',
           f"<title>{LOGIN}: {year_total} contributions in the last year, {active} active days</title>",
           f"<style>.l{{font:600 11px {MONO};fill:{DIM};letter-spacing:.12em;text-transform:uppercase}} .d{{font:400 10px {MONO};fill:{MUTE}}}"
           f" .h{{font:800 22px {SANS};fill:{HI}}} .c{{animation:pop .5s ease both}} @keyframes pop{{from{{opacity:0}}}}"
           f" .ln{{stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw 2s cubic-bezier(.22,1,.36,1) .4s forwards}} @keyframes draw{{to{{stroke-dashoffset:0}}}}</style>",
           f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" fill="{PANEL}" stroke="{LINE}"/>',
           f'<text x="{X0}" y="34" class="l">last 12 months</text>',
           f'<text x="{X0 + 160}" y="35" class="h">{year_total:,}</text><text x="{X0 + 160 + 12 * len(f"{year_total:,}") + 14}" y="34" class="d">contributions · {active} active days</text>']
    # weekday labels
    for r, name in ((1, "mon"), (3, "wed"), (5, "fri")):
        out.append(f'<text x="{X0 - 10}" y="{Y0 + r * (S + G) + 10}" text-anchor="end" class="d">{name}</text>')
    last_month = None
    for i, (day, c) in enumerate(cells):
        col, row = i // 7, (day.weekday() + 1) % 7
        x, y = X0 + col * (S + G), Y0 + row * (S + G)
        if day.day <= 7 and row == 0 and day.month != last_month:
            out.append(f'<text x="{x}" y="{Y0 - 8}" class="d">{day.strftime("%b").lower()}</text>')
            last_month = day.month
        out.append(f'<rect class="c" style="animation-delay:{col * 18}ms" x="{x}" y="{y}" width="{S}" height="{S}" rx="3" fill="{RAMP[level(c, mx)]}"><title>{c} on {day.isoformat()}</title></rect>')
    # legend
    lx, ly = X0 + 53 * (S + G) - 5 * (S + G) - 70, Y0 + 7 * (S + G) + 14
    out.append(f'<text x="{lx - 8}" y="{ly + 10}" text-anchor="end" class="d">less</text>')
    for k in range(5):
        out.append(f'<rect x="{lx + k * (S + G)}" y="{ly}" width="{S}" height="{S}" rx="3" fill="{RAMP[k]}"/>')
    out.append(f'<text x="{lx + 5 * (S + G) + 4}" y="{ly + 10}" class="d">more</text>')

    # last 30 days line (single series → no legend; the label names it)
    PX, PY, PW, PH = 920, 64, 240, 120
    last = cells[-30:]
    vals = [c for _, c in last]
    vmax = max(vals) if vals and max(vals) > 0 else 1
    out.append(f'<text x="{PX}" y="34" class="l">last 30 days</text>')
    out.append(f'<line x1="{PX}" y1="{PY + PH}" x2="{PX + PW}" y2="{PY + PH}" stroke="{LINE}"/>')
    out.append(f'<line x1="{PX}" y1="{PY}" x2="{PX + PW}" y2="{PY}" stroke="{LINE}" stroke-dasharray="2 4"/>')
    out.append(f'<text x="{PX + PW}" y="{PY - 6}" text-anchor="end" class="d">{vmax}/day</text>')
    pts = [(PX + i * PW / max(1, len(vals) - 1), PY + PH - v / vmax * PH) for i, v in enumerate(vals)]
    if pts:
        path = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        area = path + f" L{pts[-1][0]:.1f} {PY + PH} L{pts[0][0]:.1f} {PY + PH} Z"
        out.append(f'<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ACC}" stop-opacity=".28"/><stop offset="1" stop-color="{ACC}" stop-opacity="0"/></linearGradient></defs>')
        out.append(f'<path d="{area}" fill="url(#ar)"/>')
        out.append(f'<path class="ln" d="{path}" fill="none" stroke="{ACC}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
        lx2, ly2 = pts[-1]
        out.append(f'<circle cx="{lx2:.1f}" cy="{ly2:.1f}" r="4" fill="{ACC}" stroke="{PANEL}" stroke-width="2"/>')
        out.append(f'<text x="{PX}" y="{PY + PH + 18}" class="d">{last[0][0].strftime("%b %d").lower()}</text>')
        out.append(f'<text x="{PX + PW}" y="{PY + PH + 18}" text-anchor="end" class="d">today · {vals[-1]}</text>')
    if note:
        out.append(f'<text x="{W - 14}" y="{H - 10}" text-anchor="end" class="d">{note}</text>')
    out.append("</svg>")
    return "\n".join(out)


def write(name, svg):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(svg)
    print("wrote", name)


if __name__ == "__main__":
    stamp = "updated " + dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if "--placeholder" in sys.argv:
        write("streak.svg", streak_svg(0, None, 0, 0, (None, None), None, None, "syncing — first run pending"))
        write("contrib.svg", contrib_svg({}, "syncing — first run pending"))
        sys.exit()
    if "--demo" in sys.argv:  # synthetic data, design preview only — never committed
        random.seed(3)
        end = dt.date.today()
        days = {(end - dt.timedelta(days=i)).isoformat(): (random.choice([0, 0, 1, 2, 3, 5, 8]) if i > 6 else 3) for i in range(400)}
        since = end - dt.timedelta(days=399)
    else:
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if not token:
            sys.exit("GITHUB_TOKEN is required (or use --placeholder / --demo)")
        days, since = fetch_days(token, LOGIN)
    cur, longest, lrange, cstart, today = streaks(days)
    write("streak.svg", streak_svg(sum(days.values()), since, cur, longest, lrange, cstart, today, stamp))
    write("contrib.svg", contrib_svg(days, stamp))
