# About-Me — site setup

Setup notes for the personal site of **Ahmad Hussain** (`nerdatronic`): aspiring information theorist, researcher, and a little bit of everything.

It's a plain static site (HTML, CSS and JS, no build step) hosted on GitHub Pages.

## Editing content

All personal content lives in **`js/config.js`**.

- An empty string `""` shows up on the page as a dim `// todo` placeholder.
- Set `showTodos: false` to hide empty entries completely.
- You don't need to touch `index.html` or `main.js` to update content.

| Want to… | Edit in `config.js` |
|---|---|
| change bio, facts, now-list, interests | `about`, `facts`, `now`, `interests` |
| your project portfolio | `projects` (curated; nothing is pulled automatically. `featured: true` makes a card full-width) |
| add research / papers | `research`, `papers` |
| update roadmap / medals | `roadmap`, `achievements` (an empty `title` shows as a locked medal) |
| feature YouTube | `youtube.channelId` (starts with `UC…`) or `youtube.featured` (a video id) |
| live Discord status | `discord.userId` (numeric), then join [discord.gg/lanyard](https://discord.gg/lanyard) once |
| Discord server widget | `discord.serverId` (Server Settings → Widget → enable) and/or `discord.serverInvite` |
| make the contact form deliver email | free key from [web3forms.com](https://web3forms.com) → `web3formsKey` |
| guestbook | enable Discussions, install [giscus](https://github.com/apps/giscus), copy the values from [giscus.app](https://giscus.app) → `giscus` |
| swap the music | drop a file in `assets/audio/` and update `music.src` |

## Keyboard

| key | action |
|---|---|
| `/` or `ctrl+k` | quick-nav menu |
| `m` | play / pause music |
| `j` / `k` | next / previous section |
| `esc` | close menu |

## osu-style extras

- **Hits.** Every click is judged `300` / `100` / `50` / `miss`. While the music plays, clicks on the beat score `300`.
- **HUD.** A score and accuracy display (top right), a combo counter (bottom left), and live WPM whenever you type.
- **Mods.** Press `/` and type `mod`:
  - `HT`: half time, even more slowed
  - `DT`: double time
  - `NC`: nightcore
  - `FL`: flashlight
  - `AT`: autopilot, which auto-scrolls the page
- **Ranking.** The **results** section grades the visit osu!-style:
  - **SS**: all 300s
  - **S**: over 90% 300s, under 1% 50s, no misses
  - **A, B, C, D**: lower bands
- **Typing feel.** In every text box: a smooth gliding cyan caret, synthesized key sounds (no sample files), cyan letter pops, and a live WPM counter. Pick the sound (`click`, `thock`, `typewriter`, `pop`, `piano` or `off`) under the contact form or from the `/` menu.

## Profile README

`README.md` is written as a GitHub profile README. To use it on your profile:
1. Create a repo named exactly `Ahmadhussain0033`.
2. Copy `README.md` into it.

All images use absolute URLs, so you don't need to copy any other files.

To regenerate the animated SVGs in `assets/readme/` (for example, after changing the subtitle):
- Edit the constants at the top of `tools/readme_art.py`.
- Run `pip install fonttools`.
- Run `python3 tools/readme_art.py <fonts_dir>`. The fonts directory must contain `outfit.ttf` and `jbm.ttf`, the Outfit and JetBrains Mono variable fonts from Google Fonts.

## Hosting

Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.

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
- Lanyard (Discord presence)
- Discord widget
- YouTube embeds
- Web3Forms (contact form)
- giscus (guestbook)
- Google Fonts

## README stats

The streak card and contribution graph are generated in this repo, not by third-party services:
- `.github/workflows/readme-stats.yml` runs `tools/stats_svg.py` every 6 hours (and on demand from the Actions tab).
- It reads your contribution calendar through GitHub's API using the repo's built-in token, and commits fresh `assets/readme/streak.svg` and `contrib.svg`.

If they still say "syncing", open **Actions → readme stats → Run workflow**.
