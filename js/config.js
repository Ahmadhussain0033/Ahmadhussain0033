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
  tagline: "", // one-liner under your name, e.g. "finding the signal in everything"
  location: "",
  timezone: "", // IANA name, e.g. "Asia/Karachi" — powers the live clock in contact
  pronouns: "",

  /* ---------- about.md ---------- */
  about: [
    // each string = one paragraph
    "",
    "",
  ],
  facts: [
    // quick facts table:  [label, value]
    ["based in", ""],
    ["languages i speak", ""],
    ["currently", ""],
    ["fuelled by", ""],
    ["fun fact", ""],
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

  /* ---------- research/ ---------- */
  research: [
    // { title, blurb, status: "proven" | "open" | "conjecture" | "idea", link }
    { title: "", blurb: "", status: "open", link: "" },
    { title: "", blurb: "", status: "idea", link: "" },
  ],
  papers: [
    // { title, venue, year, link }
  ],

  /* ---------- projects/ (pulled live from GitHub) ---------- */
  github: "Ahmadhussain0033",
  projectsLimit: 6,
  hideRepos: [], // repo names to hide, e.g. ["About-Me"]

  /* ---------- ledger/ (one repo, shown as a live dashboard) ---------- */
  ledger: {
    repo: "Ahmadhussain0033/Ledger",
    about: "", // a sentence on what the ledger is
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

  /* ---------- principles.md ---------- */
  principles: ["", "", ""],

  /* ---------- media/ (YouTube) ---------- */
  youtube: {
    url: "", // e.g. "https://youtube.com/@yourchannel"
    channelId: "", // starts with "UC..." — enables the live uploads player
    featured: "", // a video id to feature, e.g. "dQw4w9WgXcQ"
  },

  /* ---------- discord ---------- */
  discord: {
    username: "nerdatronic",
    userId: "", // numeric ID → live presence via Lanyard (join discord.gg/lanyard once)
    serverId: "", // enables the server widget (Server Settings → Widget → enable)
    serverInvite: "", // e.g. "https://discord.gg/xxxx"
  },

  /* ---------- log/ (short posts) ---------- */
  log: [
    // { date: "2026-11-05", title, body (markdown-ish: **bold**, *em*, `code`, [link](url)) }
    { date: "2026-11-05", title: "hello, world", body: "the site is live. more soon." },
  ],

  /* ---------- guestbook (giscus — github.com/apps/giscus) ---------- */
  giscus: {
    repo: "", // e.g. "Ahmadhussain0033/About-Me"
    repoId: "",
    category: "",
    categoryId: "",
  },

  /* ---------- contact ---------- */
  email: "", // the address shown + used by the copy button / mailto fallback
  availability: { status: "green", text: "open to collaborations & conversations" }, // green | yellow | red
  responseTime: "usually within 48h",
  // https://web3forms.com → free key, messages arrive in your inbox.
  // leave blank → the form falls back to opening the visitor's email app.
  web3formsKey: "",
  socials: [
    // { label, url } — add / remove freely
    { label: "github", url: "https://github.com/Ahmadhussain0033" },
    { label: "youtube", url: "" },
    { label: "discord", url: "https://discord.com" },
    { label: "x / twitter", url: "" },
    { label: "linkedin", url: "" },
    { label: "instagram", url: "" },
    { label: "google scholar", url: "" },
  ],

  /* ---------- music ---------- */
  music: {
    src: "assets/audio/struct.mp3",
    title: "STRUCT",
    artist: "super slowed + reverb",
    volume: 0.45,
  },
};
