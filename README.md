# About-Me

Personal site of **Ahmad Hussain** (`nerdatronic`): aspiring information theorist, researcher, and a little bit of everything.

It's a plain static site (HTML, CSS and JS, no build step) hosted on GitHub Pages.

## Editing content

All personal content lives in **`js/config.js`**.

- An empty string `""` shows up on the page as a dim `// todo` placeholder.
- Set `showTodos: false` to hide empty entries completely.
- You don't need to touch `index.html` or `main.js` to update content.

| Want to… | Edit in `config.js` |
|---|---|
| change bio, facts, now-list, interests | `about`, `facts`, `now`, `interests` |
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

## Hosting

Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.

## Structure

```
index.html          page skeleton
css/style.css       all styling
js/config.js        ← your content
js/main.js          cursor, fx, audio, palette, renderers, live data
js/scene.js         three.js hero
vendor/             three.js r160 (vendored, no CDN dependency)
assets/audio/       site soundtrack
```

Third-party services the site uses, all called from the browser:
- GitHub REST API (projects, ledger)
- Lanyard (Discord presence)
- Discord widget
- YouTube embeds
- Web3Forms (contact form)
- giscus (guestbook)
- Google Fonts
