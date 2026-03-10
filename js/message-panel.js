/* ============================================================
   message-panel.js — MessagePanel singleton
   Handles one-shot messages and live chat via Firebase
   ============================================================ */

'use strict';

const MessagePanel = (() => {

  // ── Firebase configuration ────────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyDi7nehCuOIwfOiL6I5FqPb9i5P4w9f1Xw',
    authDomain:        'hahuy-portfolio.firebaseapp.com',
    databaseURL:       'https://hahuy-portfolio-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'hahuy-portfolio',
    storageBucket:     'hahuy-portfolio.firebasestorage.app',
    messagingSenderId: '2541955312',
    appId:             '1:2541955312:web:56d5da9b4c6e912aed3a35',
  };

  // ── State ─────────────────────────────────────────────────
  let _db            = null;    // Firebase database reference
  let _active        = false;   // Is live chat open?
  let _sessionName   = null;    // Current session name
  let _chatPanel     = null;    // The chat box DOM element
  let _logEl         = null;    // .mp-log div inside the panel
  let _listener      = null;    // Firebase onValue unsubscribe fn
  let _seenKeys      = new Set(); // Deduplicate rendered messages

  let _pendingConfirm  = false; // Waiting for Y/N input?
  let _pendingContent  = '';    // Content of the one-shot message

  // ── Firebase init (lazy, called once) ────────────────────
  function getDb() {
    if (_db) return _db;

    // Firebase SDK must be loaded by index.html before this module
    if (typeof firebase === 'undefined') {
      console.error('MessagePanel: Firebase SDK not loaded.');
      return null;
    }

    // Initialise the app only once (guard against hot-reload)
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    _db = firebase.database();
    return _db;
  }

  // ── Helper: escape HTML ───────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Helper: format time ───────────────────────────────────
  function fmtTime(ms) {
    const d = new Date(ms || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Build the chat-box DOM and append to body ─────────────
  function createChatShell(sessionName) {
    const panel = document.createElement('div');
    panel.className = 'message-panel';

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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.classList.add('mp-visible');
    }));

    return panel;
  }

  // ── Render a single message bubble ────────────────────────
  function renderMessage(key, data) {
    if (_seenKeys.has(key)) return;
    _seenKeys.add(key);

    if (!_logEl) return;

    // Remove placeholder status line if still present
    const placeholder = _logEl.querySelector('.mp-status');
    if (placeholder) placeholder.remove();

    const isVisitor = data.sender === 'visitor';
    const bubbleCls = isVisitor ? 'msg-visitor' : 'msg-owner';

    const bubble = document.createElement('div');
    bubble.className = `msg ${bubbleCls}`;
    bubble.textContent = data.content;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = `${isVisitor ? 'you' : 'owner'} · ${fmtTime(data.timestamp)}`;

    _logEl.appendChild(bubble);
    _logEl.appendChild(meta);
    _logEl.scrollTop = _logEl.scrollHeight;
  }

  // ── Push a visitor message to Firebase ────────────────────
  function pushMessage(content) {
    const db = getDb();
    if (!db || !_sessionName) return;

    db.ref(`sessions/${_sessionName}/messages`).push({
      content:   content,
      sender:    'visitor',
      timestamp: Date.now(),
    });
  }

  // ── Wire up the chat-box input ─────────────────────────────
  function wireInput(panel) {
    const inputEl = panel.querySelector('.mp-input');
    const sendBtn = panel.querySelector('.mp-send');

    function send() {
      const val = inputEl.value.trim();
      if (!val) return;
      inputEl.value = '';
      pushMessage(val);
      inputEl.focus();
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
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
    const handler = snapshot => {
      snapshot.forEach(child => {
        renderMessage(child.key, child.val());
      });
    };

    ref.on('value', handler);

    // Return unsubscribe function
    _listener = () => ref.off('value', handler);
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

  // ── One-shot: show confirmation prompt ───────────────────
  function confirmSend(content, ctx) {
    _pendingConfirm = true;
    _pendingContent = content;

    return {
      lines: [
        {
          html: `Send this message? <span style="color:var(--text-muted)">${
            // truncate long content for display
            esc(content.length > 60 ? content.slice(0, 60) + '…' : content)
          }</span>`,
          classes: ['output-line'],
        },
        {
          html: `<span style="color:var(--color-green)">y</span>` +
                `<span style="color:var(--text-muted)"> / </span>` +
                `<span style="color:var(--color-red)">n</span>` +
                `<span style="color:var(--text-muted)">  (press Enter to confirm)</span>`,
          classes: ['output-line'],
        },
      ],
    };
  }

  function hasPendingConfirm() {
    return _pendingConfirm;
  }

  function resolvePendingConfirm(raw, ctx) {
    const answer = raw.trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      _pendingConfirm = false;
      const content   = _pendingContent;
      _pendingContent = '';

      const db = getDb();
      if (!db) {
        ctx.appendLine('Error: Firebase not configured. Message not sent.', ['error']);
        return;
      }

      db.ref('single_messages').push({
        content:   content,
        timestamp: Date.now(),
      }).then(() => {
        ctx.appendLine('✓ Message sent!', ['success']);
        ctx.scrollBottom();
      }).catch(err => {
        ctx.appendLine(`Error sending message: ${err.message}`, ['error']);
        ctx.scrollBottom();
      });

    } else if (answer === 'n' || answer === 'no') {
      _pendingConfirm = false;
      _pendingContent = '';
      ctx.appendLine('Cancelled.', ['muted']);
      ctx.scrollBottom();

    } else {
      // Not a valid answer — re-prompt
      ctx.appendLine(
        `Please type y (yes) or n (no).`,
        ['muted']
      );
      ctx.scrollBottom();
      // _pendingConfirm stays true — next Enter will call back here
    }
  }

  // ── Live chat: start ──────────────────────────────────────
  async function startChat(name, ctx) {
    const db = getDb();
    if (!db) {
      return { error: 'Firebase not configured. See js/message-panel.js to add your project config.' };
    }

    // Check if session name is already active in Firebase
    let snapshot;
    try {
      snapshot = await db.ref(`sessions/${name}/status`).once('value');
    } catch (e) {
      return { error: `Firebase error: ${e.message}` };
    }

    if (snapshot.val() === 'active') {
      return { error: `${name} is already in use, please choose another name.` };
    }

    // Create the session in Firebase
    try {
      await db.ref(`sessions/${name}`).set({
        status:    'active',
        createdAt: Date.now(),
      });
    } catch (e) {
      return { error: `Failed to open session: ${e.message}` };
    }

    // Build chat box
    _active      = true;
    _sessionName = name;
    _seenKeys    = new Set();

    _chatPanel = createChatShell(name);
    _logEl     = _chatPanel.querySelector('.mp-log');

    wireInput(_chatPanel);
    attachListener(name);

    return {
      lines: [{
        html: `<span style="color:var(--color-green)">✓</span> Chat session <span style="color:var(--color-blue)">${esc(name)}</span> opened. Type <span style="color:var(--text-muted)">message --stop</span> to close.`,
        classes: ['output-line'],
      }],
    };
  }

  // ── Live chat: stop ───────────────────────────────────────
  function stop(ctx) {
    if (!_active) {
      return { lines: [{ html: 'No active chat session.', classes: ['output-line', 'muted'] }] };
    }

    const name = _sessionName;

    // Update Firebase status
    const db = getDb();
    if (db && name) {
      db.ref(`sessions/${name}/status`).set('closed').catch(() => {});
    }

    // Detach listener
    detachListener();

    // Fade out and remove panel
    if (_chatPanel) {
      const panel = _chatPanel;
      panel.classList.remove('mp-visible');
      panel.classList.add('mp-closing');
      setTimeout(() => { if (panel.parentNode) panel.remove(); }, 220);
    }

    // Reset state
    _active      = false;
    _sessionName = null;
    _chatPanel   = null;
    _logEl       = null;
    _seenKeys    = new Set();

    return {
      lines: [{
        html: `<span style="color:var(--text-muted)">Chat session <span style="color:var(--color-blue)">${esc(name)}</span> closed.</span>`,
        classes: ['output-line'],
      }],
    };
  }

  // ── Query ─────────────────────────────────────────────────
  function isActive() { return _active; }

  return {
    confirmSend,
    hasPendingConfirm,
    resolvePendingConfirm,
    startChat,
    stop,
    isActive,
  };

})();
