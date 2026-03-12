const Ticker = (() => {
  // ── Config ───────────────────────────────────────────────
  const DISMISS_KEY = "ticker_dismissed";

  const GH_USER = "hahahuy";
  const GH_API = `https://api.github.com/search/commits?q=author:${GH_USER}&per_page=1`;

  const COINGECKO_URL =
    "https://api.coingecko.com/api/v3/simple/price" +
    "?ids=bitcoin,pax-gold&vs_currencies=usd&include_24hr_change=true";

  // HN Firebase (already whitelisted in connect-src via *.firebaseio.com)
  const HN_TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
  const HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/";

  // Wikipedia "On this day" — events for today's date (replaces defunct numbersapi.com)
  const _now = new Date();
  const WIKI_ONTHISDAY_URL =
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/` +
    `${String(_now.getMonth() + 1).padStart(2, "0")}/${String(_now.getDate()).padStart(2, "0")}`;

  const WEATHER_URL = "https://wttr.in/Ho+Chi+Minh?format=%C+%t";

  // ── Fortune quotes (same pool as the `fortune` terminal command) ──
  const FORTUNES = [
    {
      q: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
      a: "Martin Fowler",
    },
    { q: "First, solve the problem. Then, write the code.", a: "John Johnson" },
    { q: "Experience is the name everyone gives to their mistakes.", a: "Oscar Wilde" },
    { q: "In order to be irreplaceable, one must always be different.", a: "Coco Chanel" },
    { q: "Java is to JavaScript what car is to carpet.", a: "Chris Heilmann" },
    { q: "Knowledge is power.", a: "Francis Bacon" },
    {
      q: "Sometimes it pays to stay in bed on Monday rather than spending the rest of the week debugging Sunday's code.",
      a: "Dan Salomon",
    },
    { q: "Simplicity is the soul of efficiency.", a: "Austin Freeman" },
    { q: "Before software can be reusable it first has to be usable.", a: "Ralph Johnson" },
    { q: "Make it work, make it right, make it fast.", a: "Kent Beck" },
    { q: "The best error message is the one that never shows up.", a: "Thomas Fuchs" },
    { q: "Code is like humor. When you have to explain it, it's bad.", a: "Cory House" },
    { q: "Fix the cause, not the symptom.", a: "Steve Maguire" },
    { q: "Optimism is an occupational hazard of programming.", a: "Kent Beck" },
    { q: "When in doubt, use brute force.", a: "Ken Thompson" },
    { q: "Talk is cheap. Show me the code.", a: "Linus Torvalds" },
    {
      q: "Always code as if the person who ends up maintaining your code is a violent psychopath who knows where you live.",
      a: "John Woods",
    },
    {
      q: "The most disastrous thing that you can ever learn is your first programming language.",
      a: "Alan Kay",
    },
    { q: "One man's crappy software is another man's full-time job.", a: "Jessica Gaston" },
    { q: "It works on my machine.", a: "Every Developer" },
  ];

  // ── Clickable command hints ───────────────────────────────
  const HINTS = [
    { html: '💡 <span class="tk-cmd">init</span> — portfolio overview', cmd: "init" },
    { html: '💡 <span class="tk-cmd">cat about.md</span> — read about me', cmd: "cat about.md" },
    { html: '💡 <span class="tk-cmd">hn</span> — top Hacker News stories', cmd: "hn" },
    {
      html: '💡 <span class="tk-cmd">message --name &lt;you&gt;</span> — live chat',
      cmd: "message --name ",
    },
    { html: '💡 <span class="tk-cmd">download resume</span> — get my CV', cmd: "download resume" },
    { html: '💡 <span class="tk-cmd">apis drone</span> — discover open APIs', cmd: "apis drone" },
    { html: '💡 <span class="tk-cmd">fortune</span> — random wisdom', cmd: "fortune" },
    { html: "💡 right-click background — open a new terminal", cmd: null },
  ];

  // ── State ─────────────────────────────────────────────────
  let _bar = null;
  let _track = null;
  let _mounted = false;

  // Fortune rotation
  let _fortuneIdx = Math.floor(Math.random() * FORTUNES.length);

  // HN headlines cache + rotation
  let _hnHeadlines = []; // [{title, url}]
  let _hnIdx = 0;

  // ── Formatting helpers ────────────────────────────────────
  function pct(v) {
    const n = Number.parseFloat(v);
    if (Number.isNaN(n)) return "—";
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  }

  function pctClass(v) {
    const n = Number.parseFloat(v);
    if (Number.isNaN(n)) return "";
    return n >= 0 ? "tk-up" : "tk-dn";
  }

  // ── DOM helpers ───────────────────────────────────────────
  function _makeSegment(icon, labelText, valClass) {
    const span = document.createElement("span");
    span.className = "tk-seg";
    span.innerHTML =
      `<span class="tk-lbl">${icon} ${labelText}</span> ` +
      `<span class="tk-val ${valClass} tk-loading">…</span>`;
    return span;
  }

  function _makeSep() {
    const s = document.createElement("span");
    s.className = "tk-sep";
    s.setAttribute("aria-hidden", "true");
    s.textContent = " ·· ";
    return s;
  }

  // ── Build one content copy ────────────────────────────────
  function _makeCopy(isClone) {
    const copy = document.createElement("div");
    copy.className = "tk-copy";
    if (isClone) copy.setAttribute("aria-hidden", "true");

    copy.appendChild(_makeSegment("₿", "BTC", "tk-btc"));
    copy.appendChild(_makeSep());
    copy.appendChild(_makeSegment("🥇", "GOLD", "tk-gold"));
    copy.appendChild(_makeSep());
    copy.appendChild(_makeSegment("🤖", "COMMITS", "tk-ghcommits"));
    copy.appendChild(_makeSep());

    // Fortune — inline label without icon span so the quote reads cleanly
    const fSeg = document.createElement("span");
    fSeg.className = "tk-seg";
    fSeg.innerHTML =
      `<span class="tk-lbl">💬</span> ` + `<span class="tk-val tk-fortune tk-loading">…</span>`;
    copy.appendChild(fSeg);
    copy.appendChild(_makeSep());

    // HN headline — clickable link
    const hnSeg = document.createElement("span");
    hnSeg.className = "tk-seg";
    hnSeg.innerHTML =
      `<span class="tk-lbl">📰 HN</span> ` +
      `<a class="tk-val tk-hn tk-loading" href="#" target="_blank" rel="noopener noreferrer">…</a>`;
    hnSeg.querySelector(".tk-hn").addEventListener("click", (e) => {
      if (!_hnHeadlines.length) {
        e.preventDefault();
        return;
      }
      // href is already set by _updateHn — just let it open
    });
    copy.appendChild(hnSeg);
    copy.appendChild(_makeSep());

    copy.appendChild(_makeSegment("🔢", "TRIVIA", "tk-numbers"));
    copy.appendChild(_makeSep());
    copy.appendChild(_makeSegment("🌡", "HCM", "tk-weather"));
    copy.appendChild(_makeSep());

    HINTS.forEach((hint, i) => {
      const el = document.createElement("span");
      el.className = "tk-hint";
      el.innerHTML = hint.html;
      if (hint.cmd) el.addEventListener("click", () => _fillInput(hint.cmd));
      copy.appendChild(el);
      if (i < HINTS.length - 1) copy.appendChild(_makeSep());
    });

    copy.appendChild(_makeSep()); // trailing gap at seam
    return copy;
  }

  // ── Build full DOM ────────────────────────────────────────
  function build() {
    _bar = document.createElement("div");
    _bar.id = "ticker-bar";
    _bar.setAttribute("aria-label", "Live ticker");
    _bar.setAttribute("role", "marquee");

    const label = document.createElement("div");
    label.id = "ticker-label";
    label.innerHTML = "<span>LIVE</span>";
    _bar.appendChild(label);

    _track = document.createElement("div");
    _track.id = "ticker-track";

    // Belt wraps both copies — the CSS animation runs on the belt,
    // not on the track, so overflow:hidden on the track clips cleanly.
    const belt = document.createElement("div");
    belt.id = "ticker-belt";
    belt.appendChild(_makeCopy(false));
    belt.appendChild(_makeCopy(true));
    _track.appendChild(belt);
    _bar.appendChild(_track);

    const close = document.createElement("button");
    close.id = "ticker-close";
    close.title = "Dismiss ticker";
    close.textContent = "×";
    close.addEventListener("click", dismiss);
    _bar.appendChild(close);

    document.body.insertBefore(_bar, document.body.firstChild);

    if (!CSS.supports("selector(body:has(#ticker-bar))")) {
      document.body.style.paddingTop =
        Number.parseInt(document.body.style.paddingTop || "0", 10) + 28 + "px";
    }
  }

  // ── Update helpers ────────────────────────────────────────
  // Write text + optional className to every matching element in both copies.
  function _setAll(sel, text, cls) {
    if (!_bar) return;
    _bar.querySelectorAll(sel).forEach((el) => {
      el.textContent = text;
      if (cls !== undefined) el.className = cls;
    });
  }

  // ── Click hint → fill terminal input ─────────────────────
  function _fillInput(cmd) {
    const input = document.querySelector(".terminal-input");
    if (!input) return;
    input.value = cmd;
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ── Prices: BTC + Gold ────────────────────────────────────
  async function fetchPrices() {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const btcChg = data?.bitcoin?.usd_24h_change;
      const btcUsd = data?.bitcoin?.usd;
      const goldChg = data?.["pax-gold"]?.usd_24h_change;
      const goldUsd = data?.["pax-gold"]?.usd;

      _setAll(
        ".tk-btc",
        btcUsd ? `$${Math.round(btcUsd).toLocaleString()} (${pct(btcChg)})` : pct(btcChg),
        `tk-val tk-btc ${pctClass(btcChg)}`,
      );
      _setAll(
        ".tk-gold",
        goldUsd ? `$${Math.round(goldUsd).toLocaleString()} (${pct(goldChg)})` : pct(goldChg),
        `tk-val tk-gold ${pctClass(goldChg)}`,
      );
    } catch (_e) {
      _setAll(".tk-btc", "n/a", "tk-val tk-btc");
      _setAll(".tk-gold", "n/a", "tk-val tk-gold");
    }
  }

  // ── GitHub commit count ───────────────────────────────────
  async function fetchGhCommits() {
    try {
      const res = await fetch(GH_API, {
        headers: { Accept: "application/vnd.github.cloak-preview" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = data?.total_count;
      _setAll(
        ".tk-ghcommits",
        typeof count === "number" ? `${count.toLocaleString()} commits` : "n/a",
        "tk-val tk-ghcommits",
      );
    } catch (_e) {
      _setAll(".tk-ghcommits", "n/a", "tk-val tk-ghcommits");
    }
  }

  // ── Fortune rotation ──────────────────────────────────────
  function _applyFortune() {
    const f = FORTUNES[_fortuneIdx];
    // Truncate very long quotes so the ticker doesn't stall too long
    const q = f.q.length > 90 ? f.q.slice(0, 87) + "…" : f.q;
    _setAll(".tk-fortune", `"${q}" — ${f.a}`, "tk-val tk-fortune");
  }

  function rotateFortune() {
    _fortuneIdx = (_fortuneIdx + 1) % FORTUNES.length;
    _applyFortune();
  }

  // ── HN top stories ───────────────────────────────────────
  // Fetch once: grab top-20 IDs, then fetch first 5 items in parallel.
  // After that, rotate the cached headlines every 60 s — zero re-requests.
  async function fetchHn() {
    try {
      const idsRes = await fetch(HN_TOP_URL);
      if (!idsRes.ok) throw new Error(`HTTP ${idsRes.status}`);
      const ids = await idsRes.json();

      const top5 = ids.slice(0, 5);
      const items = await Promise.all(
        top5.map((id) =>
          fetch(`${HN_ITEM_URL}${id}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );

      _hnHeadlines = items
        .filter((it) => it && it.title)
        .map((it) => ({
          title: it.title,
          url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
        }));

      if (_hnHeadlines.length) _updateHn();
    } catch (_e) {
      _setAll(".tk-hn", "n/a", "tk-val tk-hn");
    }
  }

  function _updateHn() {
    if (!_bar || !_hnHeadlines.length) return;
    const story = _hnHeadlines[_hnIdx];
    // Truncate long titles to keep the ticker moving
    const title = story.title.length > 80 ? story.title.slice(0, 77) + "…" : story.title;
    _bar.querySelectorAll(".tk-hn").forEach((el) => {
      el.textContent = title;
      el.href = story.url;
      el.className = "tk-val tk-hn";
    });
  }

  function rotateHn() {
    if (!_hnHeadlines.length) return;
    _hnIdx = (_hnIdx + 1) % _hnHeadlines.length;
    _updateHn();
  }

  // ── Wikipedia "On this day" — date event trivia ──────────
  // One request on mount for today's date; never refreshed (stable for the day).
  async function fetchNumbers() {
    try {
      const res = await fetch(WIKI_ONTHISDAY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Pick a random event from the list
      const events = json.events;
      if (!events || !events.length) throw new Error("no events");
      const ev = events[Math.floor(Math.random() * events.length)];
      const raw = `${ev.year}: ${ev.text}`;
      const short = raw.length > 80 ? raw.slice(0, 77) + "…" : raw;
      _setAll(".tk-numbers", short, "tk-val tk-numbers");
    } catch (_e) {
      _setAll(".tk-numbers", "n/a", "tk-val tk-numbers");
    }
  }

  // ── Weather ───────────────────────────────────────────────
  async function fetchWeather() {
    try {
      const res = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = (await res.text()).trim().replace(/\n/g, " ");
      _setAll(".tk-weather", text || "n/a", "tk-val tk-weather");
    } catch (_e) {
      _setAll(".tk-weather", "n/a", "tk-val tk-weather");
    }
  }

  // ── Dismiss ───────────────────────────────────────────────
  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (_e) {}
    _mounted = false;
    if (_bar) {
      _bar.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      _bar.style.opacity = "0";
      _bar.style.transform = "translateY(-100%)";
      setTimeout(() => {
        if (_bar && _bar.parentNode) _bar.remove();
        _bar = _track = null;
      }, 230);
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (_mounted) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch (_e) {
      return;
    }

    _mounted = true;
    build();

    // Kick off all fetches immediately
    fetchPrices();
    fetchGhCommits();
    _applyFortune();
    fetchHn();
    fetchNumbers();
    fetchWeather();

    // Prices — every 15 min
    setInterval(fetchPrices, 15 * 60_000);
    // Weather — every 30 min
    setInterval(fetchWeather, 30 * 60_000);
    // GH commits — every 6 h  (unauthenticated GitHub rate limit: 60 req/h)
    setInterval(fetchGhCommits, 6 * 60 * 60_000);
    // Fortune — rotate every 90 s
    setInterval(rotateFortune, 90_000);
    // HN headline — rotate cached list every 60 s, re-fetch every hour
    setInterval(rotateHn, 60_000);
    setInterval(fetchHn, 60 * 60_000);
  }

  // PERF: Defer until terminal boot finishes — avoids competing with boot network requests.
  // Ticker.init() has `if (_mounted) return` guard so double-calling is safe.
  document.addEventListener("terminal:ready", init, { once: true });

  return { init };
})();

App.Ticker = Ticker;
