/* ============================================================
   window-manager.js — WindowManager IIFE
   Manages terminal window lifecycle: create, close, z-order,
   mobile tab bar, and quad-spawn.
   ============================================================ */

'use strict';

const WindowManager = (() => {

  const desktop    = document.getElementById('desktop');
  const tabBar     = document.getElementById('mobile-tab-bar');
  const template   = document.getElementById('terminal-window-template');

  let windows    = [];   // [{ id, windowEl, terminal, destroyDraggable }]
  let nextId     = 1;
  let nextZIndex = 10;

  // ── bringToFront ──────────────────────────────────────────
  function bringToFront(windowEl) {
    nextZIndex++;
    windowEl.style.zIndex = nextZIndex;

    // Mark focused for CSS ring + mobile tab bar active state
    windows.forEach(w => w.windowEl.classList.remove('is-focused'));
    windowEl.classList.add('is-focused');
    _syncMobileTabBar();
  }

  // ── createWindow ──────────────────────────────────────────
  /**
   * @param {object} [opts]
   * @param {number} [opts.x]
   * @param {number} [opts.y]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {string} [opts.title]
   */
  function createWindow(opts = {}) {
    const id = nextId++;

    // Clone template
    const frag    = template.content.cloneNode(true);
    const windowEl = frag.querySelector('.terminal-window');

    // Default dimensions / position
    const dw = desktop.offsetWidth  || window.innerWidth;
    const dh = desktop.offsetHeight || window.innerHeight;

    const w = opts.width  || Math.min(860, Math.floor(dw * 0.9));
    const h = opts.height || Math.min(680, Math.floor(dh * 0.85));
    const x = opts.x !== undefined ? opts.x : Math.max(0, Math.floor((dw - w) / 2));
    const y = opts.y !== undefined ? opts.y : Math.max(0, Math.floor((dh - h) / 2));

    windowEl.dataset.windowId = id;
    windowEl.style.left       = x + 'px';
    windowEl.style.top        = y + 'px';
    windowEl.style.width      = w + 'px';
    windowEl.style.height     = h + 'px';
    windowEl.style.zIndex     = ++nextZIndex;

    if (opts.title) {
      const label = windowEl.querySelector('.titlebar-label');
      if (label) label.textContent = opts.title;
    }

    desktop.appendChild(windowEl);

    // Wire factory modules
    const terminal        = TerminalFactory.createTerminal(windowEl);
    const commandExecutor = CommandsFactory.createCommandExecutor(terminal);

    // Enter handler on the input
    const inputEl = terminal.inputEl;

    function onEnter(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const raw = inputEl.value.trim();
      terminal.ghostEl.textContent = '';

      if (raw) {
        terminal.echoCommand(raw);
        // Push to history
        const hist = terminal.commandHistory;
        hist.unshift(raw);
        if (hist.length > 200) hist.pop();
        terminal.commandHistory = hist;
        terminal.historyIndex   = -1;
        terminal.tempBuffer     = '';
        commandExecutor.execute(raw);
      }
      inputEl.value = '';
      terminal.scrollBottom();
    }

    inputEl.addEventListener('keydown', onEnter);

    // Autocomplete
    AutocompleteFactory.makeAutocomplete(terminal, commandExecutor.names);

    // Draggable
    const { destroy: destroyDraggable } = DraggableFactory.makeDraggable(windowEl);

    // Close dot
    const dotRed = windowEl.querySelector('.dot-red');
    dotRed.addEventListener('click', () => closeWindow(windowEl));

    // Bring to front on any mousedown inside window
    windowEl.addEventListener('mousedown', () => bringToFront(windowEl));

    // Register
    windows.push({ id, windowEl, terminal, destroyDraggable, onEnter });

    // Mark as focused
    bringToFront(windowEl);

    // Boot
    terminal.runBootSequence();

    _syncMobileTabBar();

    return { id, windowEl, terminal };
  }

  // ── closeWindow ───────────────────────────────────────────
  function closeWindow(windowEl) {
    const idx = windows.findIndex(w => w.windowEl === windowEl);
    if (idx === -1) return;

    const record = windows[idx];

    // Clean up
    record.destroyDraggable();
    record.terminal.inputEl.removeEventListener('keydown', record.onEnter);
    windowEl.remove();
    windows.splice(idx, 1);

    // Never allow 0 windows
    if (windows.length === 0) {
      createWindow();
    } else {
      // Focus the last remaining window
      bringToFront(windows[windows.length - 1].windowEl);
    }

    _syncMobileTabBar();
  }

  // ── closeAll ──────────────────────────────────────────────
  function closeAll() {
    // Destroy all without guard
    [...windows].forEach(w => {
      w.destroyDraggable();
      w.terminal.inputEl.removeEventListener('keydown', w.onEnter);
      w.windowEl.remove();
    });
    windows = [];
    createWindow();
  }

  // ── spawnQuad ─────────────────────────────────────────────
  function spawnQuad() {
    // Destroy all existing (no guard — we'll create 4 new ones)
    [...windows].forEach(w => {
      w.destroyDraggable();
      w.terminal.inputEl.removeEventListener('keydown', w.onEnter);
      w.windowEl.remove();
    });
    windows = [];

    const gutter = 12;
    const dw = desktop.offsetWidth  || window.innerWidth;
    const dh = desktop.offsetHeight || window.innerHeight;

    const winW = Math.floor((dw - gutter * 3) / 2);
    const winH = Math.floor((dh - gutter * 3) / 2);

    const positions = [
      { x: gutter,          y: gutter },
      { x: gutter * 2 + winW, y: gutter },
      { x: gutter,          y: gutter * 2 + winH },
      { x: gutter * 2 + winW, y: gutter * 2 + winH },
    ];

    positions.forEach(pos => {
      createWindow({ x: pos.x, y: pos.y, width: winW, height: winH });
    });
  }

  // ── _syncMobileTabBar ─────────────────────────────────────
  function _syncMobileTabBar() {
    tabBar.innerHTML = '';
    windows.forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (w.windowEl.classList.contains('is-focused') ? ' active' : '');
      btn.textContent = `Term ${w.id}`;
      btn.dataset.windowId = w.id;

      btn.addEventListener('click', () => {
        // Hide all, show focused
        windows.forEach(ww => ww.windowEl.classList.remove('is-focused'));
        w.windowEl.classList.add('is-focused');
        w.terminal.inputEl.focus();
        _syncMobileTabBar();
      });

      tabBar.appendChild(btn);
    });
  }

  return { createWindow, closeWindow, closeAll, bringToFront, spawnQuad };

})();
