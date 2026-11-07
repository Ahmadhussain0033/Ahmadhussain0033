# Ahmadhussain0033 — site setup

Setup notes for the personal site of **Ahmad Hussain** (`nerdatronic`): aspiring information theorist, researcher, and a little bit of everything.

It's a plain static site (HTML, CSS and JS, no build step) hosted on GitHub Pages.

## Editing content

All personal content lives in **`js/config.js`**.

- An empty string `""` shows up on the page as a dim `// todo` placeholder.
- Set `showTodos: false` to hide empty entries completely.
- You don't need to touch `index.html` or `main.js` to update content.

| Want to… | Edit in `config.js` |
|---|---|
| about me | `intro`, `about`, `facts`, `glance` (extra "at a glance" tiles; level, local time, languages and what you're building are added automatically), `goodAt`, `askMeAbout`, `journey`, `interests` (the drag-able word sphere under "outside the work"), `photo` (blank = your GitHub avatar) |
| right now (dashboard) | `now` (`focus: true` = the big card; `"title: detail"` splits into a heading and text), `nowUpdated`. The clock and "next up" widgets come from `timezone` and `roadmap` |
| your thoughts on information theory (the work + README `~/thoughts.md`, hidden while empty) | `thoughtsTitle`, `thoughts` |
| ledger / support section | `ledger.site`, `ledger.why`, `ledger.links` (buttons that jump to sections of the ledger site) |
| the work (projects + research) | `projects` (curated; nothing is pulled automatically). `kind`: `platform` / `research` / `software` / `hardware` drives the filter tabs; `featured: true` makes it the flagship card, with `pillars` listed beside it; `hexoro: true` also lists it under Hexoro. `papers` shows under it once you add one |
| hexoro (your company) | `hexoro.name`, `role`, `tagline`, `about`, `team`, `coming` (dashed "on the way" slots), `readme` (`intro` + `plan` steps, shown as a README.md with the steps as a pipeline). Projects with `hexoro: true` are listed under it |
| update roadmap / medals | `roadmap` (the phase with `when: "always"` is the mission banner; the others are the acts), `achievements` (an empty `title` shows as a locked medal) |
| toolbox / library | `toolbox` (`{ category: [items] }`, one card per category), `library` (`featured: true` = the wide card; the tabs come from `kind`) |
| YouTube | `youtube.videos`: ids or links (or `{ id, title }`). The first is the big player, the rest are the playlist next to it; titles load by themselves and a video only loads when it's clicked. With no videos, `youtube.channelId` (starts with `UC…`) plays your latest uploads |
| live Discord profile card in contact (status, custom status, activities with timers, Spotify; the media section's "listening" panel also shows your Spotify track live) | `discord.userId` (Discord → Settings → Advanced → Developer Mode, then right-click yourself → Copy User ID), then join [discord.gg/lanyard](https://discord.gg/lanyard) once |
| Discord server card | `discord.serverInvite` alone shows the server name, icon and online/member counts; add `discord.serverId` + Server Settings → Widget → enable to also list who's online |
| make the contact form deliver email | free key from [web3forms.com](https://web3forms.com) → `web3formsKey` |
| contact extras | `email`, `bookingUrl`, `reachMe`, `openTo`, `notOpenTo`, `socials` |
| FAQ ("before you ask") | `contactFaq`: `{ q, a, topic }`. `topic` makes the filter tabs; answers can link to a section with `[text](#section-id)`. Visitors can search it, and "ask me directly" drops their search into the form |
| guestbook | works out of the box: visitors write their note on the site, then sign it on GitHub (an issue from `.github/ISSUE_TEMPLATE/guestbook.yml`). The wall shows open `[guestbook]` issues; **close an issue to remove an entry**. `.github/workflows/guestbook.yml` creates and applies the `guestbook` label. Fill `giscus` instead if you'd rather use giscus discussions |
| swap the music | drop a file in `assets/audio/` and update `music.src` |

## Keyboard

| key | action |
|---|---|
| `/` or `ctrl+k` | quick-nav menu |
| `m` | play / pause music |
| `j` / `k` | next / previous section |
| `f` | fps counter (fps, frame time, 3D resolution) |
| `esc` | close menu |

## Performance

The site targets your display's full refresh rate (60, 120, 144 Hz and up). Press `f` to show the frame counter.

- **Its own thread.** The 3D background renders in a Web Worker on an `OffscreenCanvas`, so it never competes with scrolling, typing or page scripts on the main thread. Browsers without worker WebGL fall back to rendering on the page. Add `?noworker` to the URL to compare. The fps counter shows the page's fps and the 3D's fps separately.
- **Everything loads up front.** The 3D engine is module-preloaded. Every shader compiles during the intro, including ones hidden until later (warp streaks, shooting stars), so nothing stalls mid-scroll. Connections to GitHub, Lanyard and Discord are opened early, and the music buffers while you're on the intro.
- **Resolution budget.** The 3D background renders at most about 3 million pixels per frame, so 4K and retina screens don't render 4–9× the pixels. Anti-aliasing is only used on normal-density screens.
- **Adaptive quality.** The first frames measure your refresh rate. If the site can't hold it, the 3D resolution steps down, to half at the lowest. The counter shows the current `3d res`.
- **Cheap background.** The nebula noise refreshes at most 50× a second and is shifted smoothly in between. The film grain and cursor glow are drawn in the same shader pass, so there are no extra full-screen layers.
- **No layout in the frame loop.** Scroll position and section positions are cached from scroll events and resize observers.
- **Embeds load on demand.** The ledger embed loads only near the viewport and is removed when you scroll away.
- **Still slow?** Turn effects off from the `/` menu (`toggle effects`).

## osu-style extras

- **Hits.** Every click is judged `300` / `100` / `50` / `miss`. While the music plays, clicks on the beat score `300`.
- **HUD.** A score and accuracy display (top right), a combo counter (bottom left), and live WPM whenever you type.
- **Mods.** Press `/` and type `mod`:
  - `HT`: half time, even more slowed
  - `DT`: double time
  - `NC`: nightcore
  - `FL`: flashlight
  - `AT`: autopilot, which auto-scrolls the page
- **Typing feel.** In every text box: a smooth gliding cyan caret, synthesized key sounds (no sample files), cyan letter pops, and a live WPM counter. Turn all sound effects off with `sound effects` in the `/` menu.

## Profile README

This repo is named `Ahmadhussain0033/Ahmadhussain0033`, so GitHub shows `README.md` on your profile page. The same repo also serves the site:
- site: https://ahmadhussain0033.github.io/Ahmadhussain0033/

The old `/About-Me/` address stopped working when the repo was renamed (GitHub Pages doesn't redirect), so share the new one.

The middle of the README is four generated cards: player, medals, now and support. `tools/readme_cards.py` draws them from `js/config.js` plus live stats. The **readme stats** Action reruns it every 6 hours and whenever `config.js` changes, so your README follows the site.
- The player card's level is √(all-time contributions), shown with its progress to the next level.
- "Best rank" is your highest unlocked medal.
- To run it locally: `pip install fonttools`, then `python3 tools/readme_cards.py`. It needs node.
- To show your thoughts on information theory, uncomment the `~/thoughts.md` block in the README.

To regenerate the banner, divider and now-playing SVGs (for example, after changing the subtitle):
- Edit the constants at the top of `tools/readme_art.py`.
- Run `pip install fonttools`.
- Run `python3 tools/readme_art.py tools/fonts`. The fonts (Outfit and JetBrains Mono, SIL Open Font License) live in `tools/fonts/`.

## Hosting

Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.

### Custom domain

Everything uses relative paths, so the site works on a custom domain as-is.
1. Buy the domain at a registrar.
2. At your DNS provider, add `A` records for the apex pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
3. Add a `CNAME` record for `www` pointing to `ahmadhussain0033.github.io`.
4. In **Settings → Pages → Custom domain**, enter the domain (this commits a `CNAME` file). Tick **Enforce HTTPS** once the certificate is issued. `.dev` domains are HTTPS-only.
5. Update the site URLs in `README.md`.

Don't add the domain before its DNS points at GitHub, or the github.io address will redirect to a domain that doesn't resolve.

## Structure

```
index.html          page skeleton
css/style.css       all styling
js/config.js        ← your content
js/main.js          cursor, fx, audio, palette, renderers, live data
js/scene.js         three.js space: nebula, stars, hero, gates, warp
vendor/             three.js r160 (vendored, no CDN dependency)
assets/audio/       site soundtrack
assets/readme/      animated SVGs for the profile README
tools/              generator for those SVGs
```

Third-party services the site uses, all called from the browser:
- GitHub REST API (projects, ledger)
- Lanyard (Discord presence, over a websocket)
- Discord invite + widget APIs (server card)
- YouTube embeds
- Web3Forms (contact form)
- GitHub issues (guestbook; giscus optional)
- Google Fonts

## README stats

The streak card and contribution graph are generated in this repo, not by third-party services:
- `.github/workflows/readme-stats.yml` runs `tools/stats_svg.py` every 6 hours (and on demand from the Actions tab).
- It reads your contribution calendar through GitHub's API using the repo's built-in token, and commits fresh `assets/readme/streak.svg` and `contrib.svg`.

If they still say "syncing", open **Actions → readme stats → Run workflow**.
