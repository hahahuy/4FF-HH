/**
 * tests/setup.js — Vitest global test setup
 *
 * Runs before every test file. Sets up:
 *  - global stubs for CDN libraries (marked, firebase)
 *  - Config, escHtml, sanitiseHtml, cfPost, afterLayout from utils/
 *  - App namespace and EventBus
 *  - FS, fsResolve, fsListDir, fsReadFile, fsEntriesAt (filesystem.js)
 *  - Stub singletons: InitPanels, Auth, NoteEditor, MessagePanel
 *  - Command domain objects and App.Commands assembler
 *  - createAutocomplete (autocomplete.js)
 *  - createTerminal (terminal.js)
 *
 * All modules are loaded via readFileSync + Function() to preserve their
 * global-script semantics (no import/export) without a bundler.
 */

'use strict';

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { beforeAll, vi } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

function load(relPath) {
  const src = readFileSync(join(ROOT, relPath), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(src)();
}

// ── Fetch mock ────────────────────────────────────────────────────────────────
// Serves /content/* from the local filesystem; rejects CF/Firebase URLs cleanly.
global.fetch = async (url) => {
  const urlStr = typeof url === 'string' ? url : String(url);

  // Serve local content files
  const m = urlStr.match(/\/content\/(.+)$/);
  if (m) {
    const filePath = join(ROOT, 'content', m[1]);
    try {
      const text = readFileSync(filePath, 'utf8');
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { parsed = null; }
      return {
        ok:     true,
        status: 200,
        text:   async () => text,
        json:   async () => parsed ?? {},
      };
    } catch (_) {
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    }
  }

  // Cloud Function / Firebase endpoints — fail gracefully
  return { ok: false, status: 503, text: async () => '', json: async () => ({}) };
};

beforeAll(async () => {
  // ── CDN stubs ────────────────────────────────────────────────────────────
  global.marked = {
    parse: (md) => `<p>${md}</p>`,
  };
  global.firebase = {
    apps: [],
    initializeApp: vi.fn(),
    database: vi.fn(() => ({
      ref: vi.fn(() => ({
        push: vi.fn(() => Promise.resolve()),
        set: vi.fn(() => Promise.resolve()),
        once: vi.fn(() => Promise.resolve({ val: () => null })),
        on: vi.fn(),
        off: vi.fn(),
      })),
    })),
  };

  // ── Minimal DOM for terminal ─────────────────────────────────────────────
  document.body.innerHTML = `
    <div class="terminal-window" id="terminalWindow">
      <div class="titlebar"><span class="titlebar-label">test</span></div>
      <div class="terminal-body" id="terminalBody">
        <div class="output" id="output" aria-live="polite"></div>
        <div class="input-row">
          <span class="prompt"><span class="prompt-dir" id="promptDir">~</span></span>
          <div class="input-wrapper">
            <input class="terminal-input" id="terminalInput" type="text" />
            <span class="ghost-text" id="ghostText"></span>
          </div>
        </div>
        <div class="autocomplete-list" id="autocompleteList" hidden></div>
      </div>
    </div>
  `;

  // ── Utils ────────────────────────────────────────────────────────────────
  load('js/utils/config.js');
  load('js/utils/html.js');
  load('js/utils/fetch.js');
  load('js/utils/dom.js');

  // ── App namespace + EventBus ─────────────────────────────────────────────
  load('js/app.js');
  load('js/event-bus.js');

  // ── Filesystem ───────────────────────────────────────────────────────────
  load('js/filesystem.js');
  // Pre-populate blog manifest so filesystem tests can find blog/* entries.
  // (Terminal.init() never runs in jsdom because DOMContentLoaded already fired.)
  await global.loadBlogManifest();
  global.loadBlogManifest._loaded = true;  // prevent double-run if Terminal.init() ever fires
  load('js/autocomplete.js');

  // ── Stub singletons (no real network / DOM side-effects) ─────────────────
  // InitPanels stub
  global.App.InitPanels = (() => {
    let _active = false;
    return {
      start()    { _active = true; },
      stop()     { _active = false; },
      isActive() { return _active; },
    };
  })();
  global.InitPanels = global.App.InitPanels;

  // Auth stub
  global.App.Auth = (() => {
    let _pendingOTP = false;
    return {
      isAuthenticated() { return false; },
      hasPendingOTP()   { return _pendingOTP; },
      getToken()        { return null; },
      clearSession()    {},
      startAuth()       { return Promise.resolve({ error: 'auth: not available in tests' }); },
      resolveOTP(otp, ctx) {
        _pendingOTP = false;
        return Promise.resolve({ error: 'auth: not available in tests' });
      },
    };
  })();
  global.Auth = global.App.Auth;
  global.App.EventBus.on('rawInput', ({ raw, ctx }) => {
    if (!global.App.Auth.hasPendingOTP()) return false;
    global.App.Auth.resolveOTP(raw, ctx).then(result => {
      if (!result) return;
      if (result.error) ctx.appendLine(result.error, ['error']);
      else if (result.lines) result.lines.forEach(l => ctx.appendHTML(l.html, l.classes || []));
      ctx.scrollBottom();
    });
    return true;
  });

  // NoteEditor stub
  global.App.NoteEditor = (() => {
    let _pendingDelete = false;
    return {
      open()            {},
      isActive()        { return false; },
      confirmDelete(filename, ctx) {
        _pendingDelete = true;
        ctx.appendHTML(`Delete ${global.escHtml(filename)}? y/n`, ['output-line']);
        ctx.scrollBottom();
      },
      hasPendingDelete() { return _pendingDelete; },
      resolveDelete(raw, ctx) {
        const a = raw.trim().toLowerCase();
        if (a === 'y' || a === 'yes')        { _pendingDelete = false; ctx.appendLine('Deleted (stub).', ['success']); }
        else if (a === 'n' || a === 'no')    { _pendingDelete = false; ctx.appendLine('Cancelled.', ['muted']); }
        else                                  ctx.appendLine('Type y or n.', ['muted']);
        ctx.scrollBottom();
      },
    };
  })();
  global.NoteEditor = global.App.NoteEditor;
  global.App.EventBus.on('rawInput', ({ raw, ctx }) => {
    if (!global.App.NoteEditor.hasPendingDelete()) return false;
    global.App.NoteEditor.resolveDelete(raw, ctx);
    return true;
  });

  // MessagePanel stub
  global.App.MessagePanel = (() => {
    let _pendingCaptcha = false, _captchaAnswer = null, _captchaContent = '';
    let _pendingConfirm = false, _pendingContent = '';
    return {
      confirmSend(content, ctx) {
        if (!content || !content.trim()) return { error: 'Message cannot be empty.' };
        if (content.length > 500) return { error: `Message too long. Max 500 characters (got ${content.length}).` };
        // Mirror real rate-limit logic (MAX_SENDS=5 per 40 s)
        const rateKey  = global.Config ? global.Config.STORAGE.RATE : 'mp_send_times';
        const MAX_SENDS = 5, WINDOW_MS = 40_000;
        const times = JSON.parse(localStorage.getItem(rateKey) || '[]')
          .filter(t => Date.now() - t < WINDOW_MS);
        localStorage.setItem(rateKey, JSON.stringify(times));
        if (times.length >= MAX_SENDS) return { error: 'Too many messages. Please wait a minute.' };
        _captchaAnswer = 11; _captchaContent = content; _pendingCaptcha = true;
        ctx.appendHTML('<span>Solve: 7 + 4 = ?</span>', []);
        ctx.scrollBottom();
        return null;
      },
      hasPendingCaptcha()  { return _pendingCaptcha; },
      resolvePendingCaptcha(raw, ctx) {
        const ans = parseInt(raw.trim(), 10);
        if (isNaN(ans) || ans !== _captchaAnswer) {
          // Re-generate so the test can detect it via appendHTML
          _captchaAnswer = 11;
          ctx.appendLine('Incorrect.', ['error']);
          ctx.appendHTML('<span>Solve: 7 + 4 = ?</span>', ['output-line']);
          ctx.scrollBottom();
          return;
        }
        const content = _captchaContent;
        _pendingCaptcha = false; _captchaAnswer = null; _captchaContent = '';
        _pendingConfirm = true; _pendingContent = content;
        ctx.appendHTML('Send? y/n', []); ctx.scrollBottom();
      },
      hasPendingConfirm()  { return _pendingConfirm; },
      resolvePendingConfirm(raw, ctx) {
        const a = raw.trim().toLowerCase();
        if (a === 'y' || a === 'yes')     { _pendingConfirm = false; _pendingContent = ''; ctx.appendLine('Message sent!', ['success']); }
        else if (a === 'n' || a === 'no') { _pendingConfirm = false; _pendingContent = ''; ctx.appendLine('Cancelled.', ['muted']); }
        else                               ctx.appendLine('Type y or n.', ['muted']);
        ctx.scrollBottom();
      },
      isActive()    { return false; },
      stop()        { return { lines: [] }; },
      getLastName() { try { return localStorage.getItem('mp_last_name') || null; } catch(e) { return null; } },
      startChat()   { return Promise.resolve(null); },
    };
  })();
  global.MessagePanel = global.App.MessagePanel;
  global.App.EventBus.on('rawInput', ({ raw, ctx }) => {
    if (global.App.MessagePanel.hasPendingCaptcha()) { global.App.MessagePanel.resolvePendingCaptcha(raw, ctx); return true; }
    if (global.App.MessagePanel.hasPendingConfirm()) { global.App.MessagePanel.resolvePendingConfirm(raw, ctx); return true; }
    return false;
  });

  // ── Commands (split files) ───────────────────────────────────────────────
  load('js/commands/fs-commands.js');
  load('js/commands/system-commands.js');
  load('js/commands/ui-commands.js');
  load('js/commands/social-commands.js');
  load('js/commands/owner-commands.js');
  load('js/commands/easter-eggs.js');
  load('js/commands/index.js');

  // ── Terminal ─────────────────────────────────────────────────────────────
  load('js/terminal.js');
});
