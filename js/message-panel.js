const MessagePanel = (() => {
  // ── Firebase configuration ────────────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyAAphGUjTSTv-BiI62MajsVtSs1pV_VQWk",
    authDomain: "hahuy-portfolio-f7f16.firebaseapp.com",
    databaseURL: "https://hahuy-portfolio-f7f16-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hahuy-portfolio-f7f16",
    storageBucket: "hahuy-portfolio-f7f16.firebasestorage.app",
    messagingSenderId: "696599126208",
    appId: "1:696599126208:web:716a11feb24714ac2d0d25",
  };

  // ── Rate-limit constants ──────────────────────────────────
  const RATE_KEY = Config.STORAGE.RATE;
  const MAX_SENDS = 5; // max messages
  const WINDOW_MS = 40_000; // per 40 seconds

  // ── Input validation constants ─────────────────────────────
  const MAX_CONTENT_LEN = 500;
  const MAX_NAME_LEN = 32;
  const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
  const RESERVED_NAMES = new Set(["admin", "test", "null", "undefined"]);

  // ── State ─────────────────────────────────────────────────
  let _db = null; // Firebase database reference
  let _active = false; // Is live chat open?
  let _sessionName = null; // Current session name
  let _chatPanel = null; // The chat box DOM element
  let _logEl = null; // .mp-log div inside the panel
  let _listener = null; // Firebase onValue unsubscribe fn
  let _seenKeys = new Set(); // Deduplicate rendered messages

  let _pendingConfirm = false; // Waiting for Y/N input?
  let _pendingContent = ""; // Content of the one-shot message

  // ── Captcha state ─────────────────────────────────────────
  let _pendingCaptcha = false; // Waiting for captcha answer?
  let _captchaAnswer = null; // Expected numeric answer
  let _captchaContent = ""; // Held content pending captcha

  // ── Firebase init (lazy, called once) ────────────────────
  function getDb() {
    if (_db) return _db;

    // Firebase SDK must be loaded by index.html before this module
    if (typeof firebase === "undefined") {
      console.error("MessagePanel: Firebase SDK not loaded.");
      return null;
    }

    // Initialise the app only once (guard against hot-reload)
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    _db = firebase.database();
    return _db;
  }

  // ── Helper: escape HTML — uses shared escHtml from js/utils/html.js ──
  function esc(str) {
    return escHtml(str);
  }

  // ── Helper: format time ───────────────────────────────────
  function fmtTime(ms) {
    const d = new Date(ms || Date.now());
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── Rate limiting ─────────────────────────────────────────
  function isRateLimited() {
    const times = JSON.parse(localStorage.getItem(RATE_KEY) || "[]").filter(
      (t) => Date.now() - t < WINDOW_MS,
    );
    localStorage.setItem(RATE_KEY, JSON.stringify(times));
    return times.length >= MAX_SENDS;
  }

  function recordSend() {
    const times = JSON.parse(localStorage.getItem(RATE_KEY) || "[]");
    times.push(Date.now());
    localStorage.setItem(RATE_KEY, JSON.stringify(times));
  }

  // ── Input validation ──────────────────────────────────────
  function validateContent(content) {
    if (!content || !content.trim()) {
      return "Message cannot be empty.";
    }
    if (content.length > MAX_CONTENT_LEN) {
      return `Message too long. Max ${MAX_CONTENT_LEN} characters (got ${content.length}).`;
    }
    return null; // valid
  }

  function validateName(name) {
    if (!name || !name.trim()) {
      return "Name cannot be empty.";
    }
    if (name.length > MAX_NAME_LEN) {
      return `Name too long. Max ${MAX_NAME_LEN} characters.`;
    }
    if (!NAME_PATTERN.test(name)) {
      return "Name must start with a letter or digit. Allowed characters: letters, numbers, dots (.), hyphens (-), underscores (_).";
    }
    if (RESERVED_NAMES.has(name.toLowerCase())) {
      return `"${name}" is a reserved name. Please choose another.`;
    }
    return null; // valid
  }

  // ── Captcha helpers ───────────────────────────────────────
  function generateCaptcha(content, ctx) {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    _captchaAnswer = a + b;
    _captchaContent = content;
    _pendingCaptcha = true;

    ctx.appendHTML(
      `<span style="color:var(--color-orange)">Solve to send:</span> ` +
        `<span style="color:var(--text-primary)">${a} + ${b} = ?</span> ` +
        `<span style="color:var(--text-muted)">(type your answer and press Enter)</span>`,
      ["output-line"],
    );
    ctx.scrollBottom();
  }

  function hasPendingCaptcha() {
    return _pendingCaptcha;
  }

  function resolvePendingCaptcha(raw, ctx) {
    const answer = Number.parseInt(raw.trim(), 10);

    if (Number.isNaN(answer) || answer !== _captchaAnswer) {
      // Wrong — re-generate
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      _captchaAnswer = a + b;
      ctx.appendLine("Incorrect, try again.", ["error"]);
      ctx.appendHTML(
        `<span style="color:var(--color-orange)">Solve to send:</span> ` +
          `<span style="color:var(--text-primary)">${a} + ${b} = ?</span>`,
        ["output-line"],
      );
      ctx.scrollBottom();
      return;
    }

    // Correct — proceed to Y/N confirmation
    const content = _captchaContent;
    _pendingCaptcha = false;
    _captchaAnswer = null;
    _captchaContent = "";

    // Inline confirmation prompt
    _pendingConfirm = true;
    _pendingContent = content;

    ctx.appendHTML(
      `Send this message? <span style="color:var(--text-muted)">${esc(
        content.length > 60 ? content.slice(0, 60) + "…" : content,
      )}</span>`,
      ["output-line"],
    );
    ctx.appendHTML(
      `<span style="color:var(--color-green)">y</span>` +
        `<span style="color:var(--text-muted)"> / </span>` +
        `<span style="color:var(--color-red)">n</span>` +
        `<span style="color:var(--text-muted)">  (press Enter to confirm)</span>`,
      ["output-line"],
    );
    ctx.scrollBottom();
  }

  // ── Build the chat-box DOM and append to body ─────────────
  function createChatShell(sessionName) {
    const panel = document.createElement("div");
    panel.className = "message-panel";

    panel.innerHTML =
      `<div class="mp-titlebar">` +
      `<span class="dot dot-red"></span>` +
      `<span class="dot dot-yellow"></span>` +
      `<span class="dot dot-green"></span>` +
      `<span class="mp-title">chat — ${esc(sessionName)}</span>` +
      `</div>` +
      `<div class="mp-body">` +
      `<div class="mp-log" id="mpLog">` +
      `<div class="mp-status">Session started. Say hello!</div>` +
      `</div>` +
      `<div class="mp-input-row">` +
      `<input class="mp-input" type="text" ` +
      `placeholder="Type a message…" ` +
      `autocomplete="off" autocorrect="off" ` +
      `autocapitalize="off" spellcheck="false" />` +
      `<button class="mp-send">Send</button>` +
      `</div>` +
      `</div>`;

    document.body.appendChild(panel);

    // Animate in (double rAF so the browser paints opacity:0 first)
    afterLayout(() => {
      panel.classList.add("mp-visible");
    });

    return panel;
  }

  // ── Wire red dot → message --stop ─────────────────────────
  function wireRedDot(panel, ctx) {
    panel.querySelector(".dot-red").addEventListener("click", () => {
      const result = stop(ctx);
      ctx.appendHTML(result.lines[0].html, result.lines[0].classes);
      ctx.scrollBottom();
    });
  }

  // ── Render a single message bubble ────────────────────────
  function renderMessage(key, data) {
    if (_seenKeys.has(key)) return;
    _seenKeys.add(key);

    if (!_logEl) return;

    // Remove placeholder status line if still present
    const placeholder = _logEl.querySelector(".mp-status");
    if (placeholder) placeholder.remove();

    const isVisitor = data.sender === "visitor";
    const isAuto = data.sender === "auto";
    const bubbleCls = isVisitor ? "msg-visitor" : "msg-owner";

    const bubble = document.createElement("div");
    bubble.className = `msg ${bubbleCls}`;
    bubble.textContent = data.content;

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    const senderLabel = isAuto ? "auto" : isVisitor ? "you" : "owner";
    meta.textContent = `${senderLabel} · ${fmtTime(data.timestamp)}`;

    _logEl.appendChild(bubble);
    _logEl.appendChild(meta);
    _logEl.scrollTop = _logEl.scrollHeight;
  }

  // ── Push a visitor message to Firebase ────────────────────
  function pushMessage(content) {
    const db = getDb();
    if (!db || !_sessionName) return;

    // Rate limit live chat sends too
    if (isRateLimited()) {
      if (_logEl) {
        const errEl = document.createElement("div");
        errEl.className = "mp-status";
        errEl.style.color = "var(--color-red)";
        errEl.textContent = "Too many messages. Please wait a minute.";
        _logEl.appendChild(errEl);
        _logEl.scrollTop = _logEl.scrollHeight;
      }
      return;
    }

    // Validate content
    const contentErr = validateContent(content);
    if (contentErr) {
      if (_logEl) {
        const errEl = document.createElement("div");
        errEl.className = "mp-status";
        errEl.style.color = "var(--color-red)";
        errEl.textContent = contentErr;
        _logEl.appendChild(errEl);
        _logEl.scrollTop = _logEl.scrollHeight;
      }
      return;
    }

    recordSend();

    db.ref(`sessions/${_sessionName}/messages`).push({
      content: content,
      sender: "visitor",
      timestamp: Date.now(),
    });
  }

  // ── Wire up the chat-box input ─────────────────────────────
  function wireInput(panel) {
    const inputEl = panel.querySelector(".mp-input");
    const sendBtn = panel.querySelector(".mp-send");

    function send() {
      const val = inputEl.value.trim();
      if (!val) return;
      inputEl.value = "";
      pushMessage(val);
      inputEl.focus();
    }

    sendBtn.addEventListener("click", send);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    });

    // Auto-focus the chat input (without stealing from terminal)
    setTimeout(() => inputEl.focus(), 300);
  }

  // ── Attach Firebase real-time listener ────────────────────
  function attachListener(sessionName) {
    const db = getDb();
    if (!db) return;

    const ref = db.ref(`sessions/${sessionName}/messages`);

    // onValue fires once with all existing data, then on every change
    const handler = (snapshot) => {
      snapshot.forEach((child) => {
        renderMessage(child.key, child.val());
      });
    };

    ref.on("value", handler);

    // Return unsubscribe function
    _listener = () => ref.off("value", handler);
  }

  // ── Detach listener ───────────────────────────────────────
  function detachListener() {
    if (_listener) {
      _listener();
      _listener = null;
    }
  }

  // ══════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════

  // ── One-shot: show captcha then confirmation ──────────────
  function confirmSend(content, ctx) {
    // Rate limit check
    if (isRateLimited()) {
      return { error: "Too many messages. Please wait a minute." };
    }

    // Validate content
    const contentErr = validateContent(content);
    if (contentErr) {
      return { error: contentErr };
    }

    // Show captcha first — captcha resolver will set _pendingConfirm
    generateCaptcha(content, ctx);
    return null; // output already written via ctx
  }

  function hasPendingConfirm() {
    return _pendingConfirm;
  }

  function resolvePendingConfirm(raw, ctx) {
    const answer = raw.trim().toLowerCase();

    if (answer === "y" || answer === "yes") {
      _pendingConfirm = false;
      const content = _pendingContent;
      _pendingContent = "";

      const db = getDb();
      if (!db) {
        ctx.appendLine("Error: Firebase not configured. Message not sent.", ["error"]);
        return;
      }

      recordSend();

      db.ref("single_messages")
        .push({
          content: content,
          timestamp: Date.now(), // required by RTDB .validate rule
        })
        .then(() => {
          ctx.appendLine("✓ Message sent!", ["success"]);
          ctx.scrollBottom();
        })
        .catch((err) => {
          ctx.appendLine(`Error sending message: ${err.message}`, ["error"]);
          ctx.scrollBottom();
        });
    } else if (answer === "n" || answer === "no") {
      _pendingConfirm = false;
      _pendingContent = "";
      ctx.appendLine("Cancelled.", ["muted"]);
      ctx.scrollBottom();
    } else {
      // Not a valid answer — re-prompt
      ctx.appendLine(`Please type y (yes) or n (no).`, ["muted"]);
      ctx.scrollBottom();
      // _pendingConfirm stays true — next Enter will call back here
    }
  }

  // ── Live chat: start ──────────────────────────────────────
  async function startChat(name, ctx) {
    // Validate name
    const nameErr = validateName(name);
    if (nameErr) {
      return { error: nameErr };
    }

    const db = getDb();
    if (!db) {
      return {
        error: "Firebase not configured. See js/message-panel.js to add your project config.",
      };
    }

    // Check if session name is already active in Firebase
    let snapshot;
    try {
      snapshot = await db.ref(`sessions/${name}/status`).once("value");
    } catch (e) {
      return { error: `Firebase error: ${e.message}` };
    }

    if (snapshot.val() === "active") {
      return { error: `${name} is already in use, please choose another name.` };
    }

    // Create the session in Firebase
    try {
      await db.ref(`sessions/${name}`).set({
        status: "active",
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (e) {
      return { error: `Failed to open session: ${e.message}` };
    }

    // Build chat box
    _active = true;
    _sessionName = name;
    _seenKeys = new Set();

    _chatPanel = createChatShell(name);
    _logEl = _chatPanel.querySelector(".mp-log");

    wireInput(_chatPanel);
    wireRedDot(_chatPanel, ctx);
    attachListener(name);

    // Save name for next time (2c)
    try {
      localStorage.setItem(Config.STORAGE.LAST_NAME, name);
    } catch (e) {}

    // Stuck session cleanup: close session if tab/window closes (1e)
    window._mpUnloadHandler = () => stop();
    window.addEventListener("beforeunload", window._mpUnloadHandler);

    return {
      lines: [
        {
          html: `<span style="color:var(--color-green)">✓</span> Chat session <span style="color:var(--color-blue)">${esc(name)}</span> opened. Type <span style="color:var(--text-muted)">message --stop</span> to close.`,
          classes: ["output-line"],
        },
      ],
    };
  }

  // ── Live chat: stop ───────────────────────────────────────
  function stop(ctx) {
    if (!_active) {
      return { lines: [{ html: "No active chat session.", classes: ["output-line", "muted"] }] };
    }

    const name = _sessionName;

    // Remove beforeunload handler (1e)
    if (window._mpUnloadHandler) {
      window.removeEventListener("beforeunload", window._mpUnloadHandler);
      window._mpUnloadHandler = null;
    }

    // Firebase session status is managed server-side by the Cloud Function
    // (admin SDK bypasses rules). Client write removed — it would be rejected
    // by the write-once RTDB rule that only allows the initial 'active' value.

    // Detach listener
    detachListener();

    // Fade out and remove panel
    if (_chatPanel) {
      const panel = _chatPanel;
      panel.classList.remove("mp-visible");
      panel.classList.add("mp-closing");
      setTimeout(() => {
        if (panel.parentNode) panel.remove();
      }, 220);
    }

    // Reset state
    _active = false;
    _sessionName = null;
    _chatPanel = null;
    _logEl = null;
    _seenKeys = new Set();

    return {
      lines: [
        {
          html: `<span style="color:var(--text-muted)">Chat session <span style="color:var(--color-blue)">${esc(name)}</span> closed.</span>`,
          classes: ["output-line"],
        },
      ],
    };
  }

  // ── Query ─────────────────────────────────────────────────
  function isActive() {
    return _active;
  }
  function getLastName() {
    try {
      return localStorage.getItem(Config.STORAGE.LAST_NAME) || null;
    } catch (e) {
      return null;
    }
  }

  return {
    confirmSend,
    hasPendingConfirm,
    resolvePendingConfirm,
    hasPendingCaptcha,
    resolvePendingCaptcha,
    startChat,
    stop,
    isActive,
    getLastName,
  };
})();

App.MessagePanel = MessagePanel; // publish to App namespace

// ── EventBus registration (highest priority — captcha/confirm first) ──
App.EventBus.on("rawInput", ({ raw, ctx }) => {
  if (MessagePanel.hasPendingCaptcha()) {
    MessagePanel.resolvePendingCaptcha(raw, ctx);
    return true;
  }
  if (MessagePanel.hasPendingConfirm()) {
    MessagePanel.resolvePendingConfirm(raw, ctx);
    return true;
  }
  return false;
});
