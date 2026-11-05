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
    "an infophile at heart",
    "a CS undergrad, mostly self-taught",
    "a freelancer",
  ],
  motto: "Nothing matters so everything matters equally", // typed out under your name (unless tagline is set), on the about card + README
  tagline: "", // optional one-liner under your name; blank → the motto is shown there
  location: "Karachi, Pakistan",
  timezone: "Asia/Karachi", // IANA name — powers the live clock in contact
  // README level = your age. birthday "MM-DD" makes it level up on the day (+ an xp bar
  // through the year); without it the level stays at value.
  age: { value: 19, asOf: "2026-11-05", birthday: "01-22" },
  pronouns: "he/him",

  /* ---------- about.md ---------- */
  photo: "", // path or URL to a photo — blank uses your GitHub avatar
  intro: "Infophile at Heart", // one bold line at the top of about
  about: [
    // each string = one paragraph. supports **bold**, *italic*, `code`, [links](https://…)
    "i'm ahmad, 19, from karachi. i'm a BSCS undergrad at IBA (2nd year, 3rd semester), but most of what i know i taught myself.",
    "i care about **algorithmic information theory**, compression, and learning itself. right now i'm building **infoverse**, a platform that judges theoretical and practical compressors and information theory, teaches and verifies it, and builds a collective database that doesn't rely on anyone. the whole process is transparent and everyone gets a fair shot. alongside it i'm doing my own research on compression frameworks and laws, and freelancing.",
    "i got into information theory through a question i proposed to myself. it spiralled.",
    "outside of that: football, the gym, arm wrestling, robotics and hardware, chess, and coding. fuelled by energy drinks and coffee. the anime and nerdy side of life shaped a lot of me: pokémon, persona, dbz, beyblade, real steel, pacific rim, and a lot of music and AMVs.",
  ],
  facts: [
    // quick facts table:  [label, value]
    ["based in", "Karachi, Pakistan 🇵🇰"],
    ["timezone", "PKT · UTC+5"],
    ["languages i speak", "English, Urdu, Arabic"],
    ["studying", "BSCS at IBA · 2nd year, 3rd semester · mostly self-taught"],
    ["currently", "building infoverse · research · freelancing"],
    ["my company", "Hexoro (founder)"],
    ["good at", "football, gym, arm wrestling, robotics & hardware, chess"],
    ["fuelled by", "energy drinks & coffee"],
    ["on repeat", "STRUCT — super slowed + reverb"],
  ],
  askMeAbout: ["algorithmic information theory", "compression", "learning itself", "competitions", "games"],
  journey: [
    // a short timeline of you — { when, text }, oldest first
    { when: "2007", text: "born in karachi" },
    { when: "2025", text: "started BSCS at IBA" },
    { when: "nov 2025", text: "found and disclosed a critical vulnerability in Compyle.ai (YC F25)" },
    { when: "2026", text: "building infoverse · launched this site" },
  ],

  /* ---------- now.md (what you're doing these days) ---------- */
  nowUpdated: "Nov 2026",
  now: [
    // { text, status: "done" | "doing" | "blocked" }
    { text: "building infoverse: a transparent platform that judges compressors and information theory, teaches, verifies, and keeps a collective database", status: "doing" },
    { text: "my own research on compression frameworks and laws", status: "doing" },
    { text: "freelancing", status: "doing" },
    { text: "getting information theory and compression out there", status: "doing" },
  ],

  /* ---------- everything.md (you're not just one thing) ---------- */
  interests: [
    { group: "think", items: ["information theory", "algorithmic information theory", "compression", "learning itself"] },
    { group: "make", items: ["robotics", "hardware", "code", "photography"] },
    { group: "play", items: ["football", "chess", "arm wrestling", "gym", "games"] },
    { group: "love", items: ["anime", "light novels", "pokémon", "persona", "competitions"] },
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
    { title: "compression frameworks & laws", blurb: "my own research into frameworks and laws of compression.", status: "open", link: "" },
    { title: "infoverse", blurb: "judging theoretical and practical compressors, with teaching, verification and a collective database that doesn't rely on anyone.", status: "open", link: "" },
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
    {
      title: "infoverse",
      blurb: "a platform that judges theoretical and practical compressors and information theory, teaches and verifies it, and builds a collective database that doesn't rely on anyone. the whole process is transparent and everyone gets a fair shot.",
      tags: ["information theory", "compression", "platform"], status: "doing", year: "2026", link: "", repo: "", featured: true,
    },
    {
      title: "compression research",
      blurb: "papers and work about compression, and learning as a whole.",
      tags: ["research", "compression", "learning"], status: "doing", year: "", link: "", repo: "",
    },
    {
      title: "RX0",
      blurb: "my own compressor.",
      tags: ["compression"], status: "doing", year: "", link: "", repo: "",
    },
    {
      title: "Arky",
      blurb: "the pet hexapod i'm making.",
      tags: ["robotics", "hardware"], status: "doing", year: "", link: "", repo: "",
    },
    {
      title: "closed energy generator",
      blurb: "my own energy device: trying to perfect a closed Stirling engine.",
      tags: ["hardware", "energy"], status: "doing", year: "", link: "", repo: "",
    },
  ],
  github: "Ahmadhussain0033", // used for the footer + palette "open github"

  /* ---------- ledger/ (one repo, shown as a live dashboard) ---------- */
  ledger: {
    site: "https://ahmadhussain0033.github.io/Ledger/", // the live ledger — embedded + linked
    repo: "Ahmadhussain0033/Ledger",                     // source repo — shows recent commits
    about: "Every donation, expense and receipt in one place. What I'm working on, where the money goes, with receipts.",
    why: "support goes toward new tools i find, premium subscriptions (like for reading), API access, quality-of-life stuff, and a bunch of other things that help me while i work.",
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
    { when: "now", title: "building", items: [
      { text: "infoverse", status: "doing" },
      { text: "research on compression frameworks and laws", status: "doing" },
      { text: "freelancing", status: "doing" },
    ] },
    { when: "2027", title: "next year", items: [
      { text: "finish infoverse", status: "todo" },
      { text: "publish at least one paper on my research", status: "todo" },
      { text: "get better and align myself", status: "todo" },
      { text: "get in touch with other information theory people", status: "todo" },
    ] },
    { when: "always", title: "the big one", items: [{ text: "get information theory and compression out there", status: "todo" }] },
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
    spoken: ["English", "Urdu", "Arabic"],
    tools: ["Obsidian", "Arch Linux", "Neovim", "VS Code", "Python", "C++", "Verilog", "Lean", "Assembly", "HTML", "CSS", "JS", "Spotify", "OBS"],
    creative: ["Adobe", "photography"],
    other: ["robotics & hardware"],
  },

  /* ---------- library/ (books, films, anything that shaped you) ---------- */
  library: [
    // { kind: "book" | "film" | "album" | "paper" | "game" | "anime" | …, title, by, note }
    { kind: "game", title: "Pokémon", by: "", note: "genuinely huge for me" },
    { kind: "game", title: "Persona", by: "Atlus", note: "" },
    { kind: "game", title: "Minecraft", by: "", note: "" },
    { kind: "game", title: "chess", by: "", note: "" },
    { kind: "game", title: "PSP games", by: "", note: "" },
    { kind: "film", title: "Real Steel", by: "", note: "" },
    { kind: "film", title: "Pacific Rim", by: "", note: "" },
    { kind: "film", title: "Rocky (the series)", by: "", note: "" },
    { kind: "book", title: "How to Train Your Dragon (the books)", by: "Cressida Cowell", note: "" },
    { kind: "book", title: "light novels", by: "", note: "" },
    { kind: "anime", title: "Dragon Ball Z", by: "", note: "" },
    { kind: "anime", title: "Beyblade", by: "", note: "" },
    { kind: "music", title: "AMVs & music in general", by: "", note: "the anime and nerdy part of life shaped a lot of me" },
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
  email: "ahmad.hussain.a301@gmail.com", // the address shown + used by the copy button / mailto fallback
  availability: { status: "green", text: "open to gigs & long-term remote work" }, // green | yellow | red
  responseTime: "usually within 48h",
  bookingUrl: "", // e.g. a cal.com / calendly link → "book a call" button
  // best ways to reach you, in order — { via, note }
  reachMe: [
    { via: "email", note: "ahmad.hussain.a301@gmail.com" },
    { via: "discord", note: "nerdatronic" },
    { via: "the form below", note: "lands in my inbox" },
  ],
  openTo: ["gigs / freelance work", "long-term remote work", "anyone who wants to help: you're welcome"],
  notOpenTo: [],
  contactFaq: [
    // { q, a }
    { q: "can i hire you?", a: "yes. gigs, freelance, or something long-term and remote. email me with what you need." },
    { q: "i want to help with infoverse or your research", a: "you're welcome. reach out and tell me what you'd like to do." },
  ],
  // https://web3forms.com → free key, messages arrive in your inbox.
  // leave blank → the form falls back to opening the visitor's email app.
  web3formsKey: "",
  socials: [
    // { label, url } — add / remove freely
    { label: "github", url: "https://github.com/Ahmadhussain0033" },
    { label: "support (ledger)", url: "https://ahmadhussain0033.github.io/Ledger/" },
    { label: "youtube", url: "" },
    { label: "discord", url: "https://discord.com" },
    { label: "instagram · @ahemod", url: "https://instagram.com/ahemod" },
    { label: "spotify", url: "https://open.spotify.com/user/31dz3lsjwqvgd2a55ofvyt5px5g4" },
  ],

  /* ---------- hexoro — your company (only shown as a fact + a small tag) ---------- */
  hexoro: { name: "Hexoro", role: "founder" },

  /* ---------- music ---------- */
  music: {
    src: "assets/audio/struct.mp3",
    title: "STRUCT",
    artist: "super slowed + reverb",
    volume: 0.45,
  },
};
