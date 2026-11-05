/* =====================================================================
   config.js — EVERYTHING personal lives here.
   ---------------------------------------------------------------------
   • Empty strings ""  → shown as a dim  // todo  placeholder
     (set showTodos: false to hide empty entries completely).
   • Empty arrays []   → section shows a "nothing here yet" state.
   • You never need to touch index.html / main.js to update content.
   ===================================================================== */

window.SITE = {
  showTodos: true,

  /* ---------- identity ---------- */
  name: "Ahmad Hussain",
  handle: "nerdatronic",
  // the rotating words in the hero — shown as "i'm <role>", so include a / an
  roles: [
    "an aspiring information theorist",
    "a researcher",
    "", // e.g. "a writer"
    "", // e.g. "a musician"
    "", // e.g. "a builder of things"
  ],
  motto: "Nothing matters so everything matters equally", // typed out under your name (unless tagline is set), on the about card + README
  tagline: "", // optional one-liner under your name; blank → the motto is shown there
  location: "",
  timezone: "", // IANA name, e.g. "Asia/Karachi" — powers the live clock in contact
  pronouns: "",

  /* ---------- about.md ---------- */
  photo: "", // path or URL to a photo — blank uses your GitHub avatar
  intro: "", // one bold line at the top of about, e.g. "i like finding the pattern in things"
  about: [
    // each string = one paragraph. supports **bold**, *italic*, `code`, [links](https://…)
    "", // who you are
    "", // what you do / study
    "", // how you got here
    "", // outside of all that
  ],
  facts: [
    // quick facts table:  [label, value]
    ["based in", ""],
    ["timezone", ""],
    ["languages i speak", ""],
    ["currently", ""],
    ["studying", ""],
    ["my organization", "Hexoro"],
    ["fuelled by", ""],
    ["on repeat", "STRUCT — super slowed + reverb"],
    ["fun fact", ""],
  ],
  askMeAbout: ["information theory", "", "", ""], // chips: topics people can start a conversation with
  journey: [
    // a short timeline of you — { when, text }, oldest first
    { when: "", text: "" },
    { when: "", text: "" },
    { when: "", text: "" },
    { when: "2026", text: "launched this site" },
  ],

  /* ---------- now.md (what you're doing these days) ---------- */
  nowUpdated: "", // e.g. "Nov 2026"
  now: [
    // { text, status: "done" | "doing" | "blocked" }
    { text: "", status: "doing" },
    { text: "", status: "doing" },
    { text: "", status: "doing" },
  ],

  /* ---------- everything.md (you're not just one thing) ---------- */
  interests: [
    { group: "think", items: ["information theory", "research", "", ""] },
    { group: "make", items: ["", "", ""] },
    { group: "play", items: ["", "", ""] },
    { group: "learn", items: ["", "", ""] },
  ],

  /* ---------- research/ → your own thoughts on information theory ---------- */
  thoughtsTitle: "my take on information theory",
  thoughts: [
    // each string = one paragraph. supports **bold**, *italic*, `code`, [links](https://…)
    "",
    "",
  ],

  /* ---------- research/ ---------- */
  research: [
    // { title, blurb, status: "proven" | "open" | "conjecture" | "idea", link }
    { title: "", blurb: "", status: "open", link: "" },
    { title: "", blurb: "", status: "idea", link: "" },
  ],
  papers: [
    // { title, venue, year, link }
  ],

  /* ---------- projects/ — YOUR curated portfolio (nothing is auto-pulled) ---------- */
  // Only what you list here shows up, in this order. Copy a block to add more.
  //   title    — project name
  //   blurb    — 1–2 sentences: what it is / why it matters
  //   tags     — short labels, e.g. ["python", "compression", "research"]
  //   status   — "done" | "doing" | "blocked" | "idea"   (green / yellow / red / grey)
  //   year     — e.g. "2026"
  //   link     — live demo / paper / video (optional)
  //   repo     — "owner/name" → adds a source link + live ★ count (optional)
  //   featured — true → card spans full width at the top (optional)
  projects: [
    { title: "", blurb: "", tags: [], status: "doing", year: "", link: "", repo: "", featured: true },
    { title: "", blurb: "", tags: [], status: "done", year: "", link: "", repo: "" },
    { title: "", blurb: "", tags: [], status: "done", year: "", link: "", repo: "" },
  ],
  github: "Ahmadhussain0033", // used for the footer + palette "open github"

  /* ---------- ledger/ (one repo, shown as a live dashboard) ---------- */
  ledger: {
    site: "https://ahmadhussain0033.github.io/Ledger/", // the live ledger — embedded + linked
    repo: "Ahmadhussain0033/Ledger",                     // source repo — shows recent commits
    about: "Every donation, expense and receipt in one place. What I'm working on, where the money goes, with receipts.",
    why: "", // todo: in your words — what support goes toward / what you need it for
    // buttons → sections of the ledger site
    links: [
      { label: "support me", hash: "donate", primary: true },
      { label: "where the money goes", hash: "spending" },
      { label: "funding drives", hash: "drives" },
      { label: "backers", hash: "supporters" },
    ],
  },

  /* ---------- roadmap.md ---------- */
  roadmap: [
    // { when, title, items: [{ text, status: "done" | "doing" | "blocked" | "todo" }] }
    { when: "", title: "", items: [{ text: "", status: "done" }, { text: "", status: "doing" }] },
    { when: "", title: "", items: [{ text: "", status: "todo" }] },
    { when: "", title: "", items: [{ text: "", status: "todo" }] },
  ],

  /* ---------- achievements/ ---------- */
  achievements: [
    // grade: "SS" | "S" | "A" | "B" — empty title shows as a LOCKED medal
    // example ↓ — copy this shape for new ones. link can be a URL or a file in the repo.
    {
      grade: "SS",
      title: "Critical vulnerability · Compyle.ai",
      detail: "Found and responsibly disclosed a critical credit-system bypass in Compyle.ai (YC F25), an AI coding agent. Fully remediated; formally acknowledged by the founder & CTO.",
      date: "Nov 2025",
      link: "assets/docs/compyle-security-acknowledgment-2025.pdf",
      linkLabel: "read the acknowledgment",
    },
    { grade: "A", title: "", detail: "", date: "", link: "" },
    { grade: "SS", title: "", detail: "", date: "", link: "" },
    { grade: "B", title: "", detail: "", date: "", link: "" },
    { grade: "S", title: "", detail: "", date: "", link: "" },
    { grade: "A", title: "", detail: "", date: "", link: "" },
    { grade: "SS", title: "", detail: "", date: "", link: "" },
    { grade: "B", title: "", detail: "", date: "", link: "" },
  ],

  /* ---------- toolbox.json ---------- */
  toolbox: {
    spoken: ["", ""],
    tools: ["", "", ""],
    creative: ["", ""],
    other: [""],
  },

  /* ---------- library/ (books, films, anything that shaped you) ---------- */
  library: [
    // { kind: "book" | "film" | "album" | "paper" | "game", title, by, note }
    { kind: "book", title: "", by: "", note: "" },
    { kind: "film", title: "", by: "", note: "" },
    { kind: "album", title: "", by: "", note: "" },
  ],

  /* ---------- media/ (YouTube) ---------- */
  youtube: {
    url: "", // e.g. "https://youtube.com/@yourchannel"
    channelId: "", // starts with "UC..." — enables the live uploads player
    featured: "", // a video id to feature, e.g. "dQw4w9WgXcQ"
  },

  /* ---------- discord ---------- */
  discord: {
    username: "nerdatronic",
    displayName: "", // shown until live data arrives (live data uses your real display name)
    about: "", // a line for the profile card's "about me"
    // numeric user ID → live profile card: avatar, status, custom status, activities with
    // timers, Spotify. Discord → Settings → Advanced → Developer Mode, then right-click
    // yourself → Copy User ID. Also join discord.gg/lanyard once (that's what makes it live).
    userId: "970194006069903441",
    // a server invite alone → server name, icon, online + member counts (no setup)
    serverInvite: "", // e.g. "https://discord.gg/xxxx"
    // server ID + Server Settings → Widget → Enable → also shows who's online right now
    serverId: "",
  },

  /* ---------- log/ (short posts) ---------- */
  log: [
    // { date: "2026-11-05", title, body (markdown-ish: **bold**, *em*, `code`, [link](url)) }
    { date: "2026-11-05", title: "hello, world", body: "the site is live. more soon." },
  ],

  /* ---------- guestbook ---------- */
  // works out of the box: notes are GitHub issues from the guestbook form in this repo.
  // close an issue on GitHub to take an entry off the wall.
  guestbook: { repo: "Ahmadhussain0033/Ahmadhussain0033" },
  // optional: fill all four (from giscus.app) to use giscus discussions instead
  giscus: {
    repo: "", // e.g. "Ahmadhussain0033/Ahmadhussain0033"
    repoId: "",
    category: "",
    categoryId: "",
  },

  /* ---------- contact ---------- */
  email: "", // the address shown + used by the copy button / mailto fallback
  availability: { status: "green", text: "open to collaborations & conversations" }, // green | yellow | red
  responseTime: "usually within 48h",
  bookingUrl: "", // e.g. a cal.com / calendly link → "book a call" button
  // best ways to reach you, in order — { via, note }
  reachMe: [
    { via: "discord", note: "" }, // e.g. "fastest, i'm on most days"
    { via: "email", note: "" }, // e.g. "for anything longer"
    { via: "the form below", note: "" },
  ],
  openTo: ["", "", ""], // e.g. "research collaborations", "talks / podcasts", "freelance"
  notOpenTo: [""], // optional, e.g. "unpaid spec work"
  contactFaq: [
    // { q, a }
    { q: "", a: "" },
    { q: "", a: "" },
  ],
  // https://web3forms.com → free key, messages arrive in your inbox.
  // leave blank → the form falls back to opening the visitor's email app.
  web3formsKey: "",
  socials: [
    // { label, url } — add / remove freely
    { label: "github", url: "https://github.com/Ahmadhussain0033" },
    { label: "hexoro (my org)", url: "https://github.com/Hexoro" },
    { label: "support (ledger)", url: "https://ahmadhussain0033.github.io/Ledger/" },
    { label: "youtube", url: "" },
    { label: "discord", url: "https://discord.com" },
    { label: "x / twitter", url: "" },
    { label: "linkedin", url: "" },
    { label: "instagram", url: "" },
    { label: "google scholar", url: "" },
    { label: "reddit", url: "" },
    { label: "twitch", url: "" },
    { label: "spotify", url: "" },
  ],

  /* ---------- hexoro — your organization (section here + its own page at /hexoro/) ---------- */
  hexoro: {
    name: "Hexoro",
    tagline: "", // one line: what Hexoro is
    github: "Hexoro", // github.com/Hexoro — public repos show up live
    website: "",
    email: "", // business contact
    founded: "",
    location: "",
    role: "", // your role, e.g. "founder"
    about: ["", ""], // paragraphs — supports **bold**, *italic*, `code`, [links](https://…)
    // what Hexoro does — { title, blurb }
    focus: [
      { title: "", blurb: "" },
      { title: "", blurb: "" },
      { title: "", blurb: "" },
    ],
    // products / projects — { name, blurb, status: "done" | "doing" | "idea", link }
    products: [
      { name: "", blurb: "", status: "doing", link: "" },
      { name: "", blurb: "", status: "idea", link: "" },
    ],
    // team — { name, role, link }
    team: [
      { name: "Ahmad Hussain", role: "", link: "https://ahmadhussain0033.github.io/Ahmadhussain0033/" },
      { name: "", role: "", link: "" },
    ],
    values: ["", "", ""],
    // milestones — { when, text }
    timeline: [
      { when: "", text: "" },
      { when: "", text: "" },
    ],
    joinText: "", // e.g. "we're looking for …" — leave blank to hide the join block
  },

  /* ---------- music ---------- */
  music: {
    src: "assets/audio/struct.mp3",
    title: "STRUCT",
    artist: "super slowed + reverb",
    volume: 0.45,
  },
};
