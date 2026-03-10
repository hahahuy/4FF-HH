/* ============================================================
   terminal.js — Terminal instance factory
   Each call to createTerminal(winEl) creates a fully independent
   terminal scoped to that window element.
   ============================================================ */

'use strict';

// Tracks whether the very first terminal has already been created.
// Used to show a different hint line in subsequent windows.
let _isFirstTerminal = true;

/**
 * Create and wire a terminal instance inside `winEl`.
 * All DOM queries are relative to winEl so multiple instances
 * can coexist without ID collisions.
 */
function createTerminal(winEl) {

  // Claim "first terminal" slot before anything else runs
  const isFirst    = _isFirstTerminal;
  _isFirstTerminal = false;

  // ── DOM refs (scoped to this window) ─────────────────────
  const output         = winEl.querySelector('.output');
  const inputEl        = winEl.querySelector('.terminal-input');
  const promptDirEl    = winEl.querySelector('.prompt-dir');
  const ghostTextEl    = winEl.querySelector('.ghost-text');
  const autocompleteEl = winEl.querySelector('.autocomplete-list');
  const terminalBody   = winEl.querySelector('.terminal-body');

  // ── Per-instance autocomplete ─────────────────────────────
  const ac = createAutocomplete(inputEl, ghostTextEl, autocompleteEl);

  // ── State ─────────────────────────────────────────────────
  let commandHistory = [];
  let historyIndex   = -1;
  let tempBuffer     = '';
  let currentPath    = ['~'];

  // ── Helpers ──────────────────────────────────────────────
  function getCwd()       { return currentPath.join('/'); }
  function updatePrompt() { promptDirEl.textContent = getCwd(); }
  function scrollBottom() {
    output.scrollTop      = output.scrollHeight;
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // ── Output writers ────────────────────────────────────────
  function appendHTML(html, extraClasses = []) {
    const div = document.createElement('div');
    div.className = ['output-line', ...extraClasses].join(' ');
    div.innerHTML = html;
    output.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendLine(text, extraClasses = []) {
    return appendHTML(escapeHtml(text), extraClasses);
  }

  function echoCommand(cmd) {
    const div = document.createElement('div');
    div.className = 'cmd-echo output-line';
    div.innerHTML =
      `<span class="echo-prompt">visitor@portfolio:<span class="echo-dir">${escapeHtml(getCwd())}</span>$&nbsp;</span>` +
      `<span class="echo-cmd">${escapeHtml(cmd)}</span>`;
    output.appendChild(div);
  }

  function appendMarkdown(mdText) {
    const div = document.createElement('div');
    div.className = 'md-render';
    div.innerHTML = marked.parse(mdText);
    div.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    });
    output.appendChild(div);
    scrollBottom();
  }

  function appendSpacer() {
    const div = document.createElement('div');
    div.className = 'spacer';
    output.appendChild(div);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clearOutput() { output.innerHTML = ''; }

  // ── Close this window (quit command) ──────────────────────
  function closeWindow() {
    winEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    winEl.style.opacity    = '0';
    winEl.style.transform  = (winEl.style.transform || '') + ' scale(0.95)';
    setTimeout(() => winEl.remove(), 210);
  }

  // ── Idle hint ─────────────────────────────────────────────
  const IDLE_DELAY_MS = 20000;
  let idleTimer     = null;
  let hintFired     = false;
  // Idle hint only arms after the user has typed at least one command
  // in the original window. For subsequent windows it never arms.
  let commandEverRun = !isFirst; // subsequent windows: permanently disabled

  function showHint() {
    hintFired = true;
    const div = document.createElement('div');
    div.className   = 'output-line muted hint-line';
    div.textContent = 'Type `help` for available commands.';
    output.appendChild(div);
    scrollBottom();
  }

  function resetIdleTimer() {
    // Only the original window ever shows the idle hint,
    // and only after the user has run at least one command.
    if (!isFirst)          return;  // subsequent windows: never
    if (!commandEverRun)   return;  // original window: not yet armed
    if (hintFired) hintFired = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!hintFired) showHint(); }, IDLE_DELAY_MS);
  }

  function armIdleAfterFirstCommand() {
    if (commandEverRun) return;    // already armed
    commandEverRun = true;
    resetIdleTimer();              // start the clock from right now
  }

  // ── Command execution ─────────────────────────────────────
  function executeCommand(raw) {
    const parts = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd   = (parts[0] || '').toLowerCase();
    const args  = parts.slice(1).map(a => a.replace(/^['"]|['"]$/g, ''));

    // Easter egg
    if (raw.toLowerCase() === 'sudo make me a coffee') {
      appendLine('☕  Brewing... jk, I\'m a website. But I appreciate the request.', ['success']);
      appendLine('    Try `open github` to see real projects instead.', ['muted']);
      return;
    }

    // Render context: async commands (cat) call back into this instance
    const ctx = { appendMarkdown, appendLine, scrollBottom, winEl };

    // ── Intercept Y/N confirmation (e.g. for `message` one-shot) ──
    if (typeof MessagePanel !== 'undefined' && MessagePanel.hasPendingConfirm()) {
      MessagePanel.resolvePendingConfirm(raw, ctx);
      return;
    }

    const result = Commands.execute(cmd, args, currentPath, ctx);

    if (result) {
      if (result.newPath) currentPath = result.newPath;
      if (result.clear)   clearOutput();
      if (result.quit)    { closeWindow(); return; }
      if (result.lines)   result.lines.forEach(l => appendHTML(l.html || '', l.classes || []));
      if (result.markdown) appendMarkdown(result.markdown);
      if (result.error)   appendLine(result.error, ['error']);
    }

    updatePrompt();
    scrollBottom();
    // Arm idle hint the first time a command is run in the original window
    armIdleAfterFirstCommand();
  }

  // ── Keyboard handler ──────────────────────────────────────
  function handleKeydown(e) {
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const raw = inputEl.value.trim();
        ac.hide();
        ghostTextEl.textContent = '';
        if (raw) {
          echoCommand(raw);
          commandHistory.unshift(raw);
          if (commandHistory.length > 200) commandHistory.pop();
          historyIndex = -1; tempBuffer = '';
          executeCommand(raw);
        }
        inputEl.value = '';
        scrollBottom();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (historyIndex === -1) tempBuffer = inputEl.value;
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          inputEl.value = commandHistory[historyIndex];
          requestAnimationFrame(() => {
            inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
          });
        }
        ac.hide(); ghostTextEl.textContent = '';
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          inputEl.value = commandHistory[historyIndex];
        } else if (historyIndex === 0) {
          historyIndex = -1;
          inputEl.value = tempBuffer;
        }
        ac.hide(); ghostTextEl.textContent = '';
        break;
      }
      case 'Tab': {
        e.preventDefault();
        ac.trigger(inputEl.value, currentPath);
        break;
      }
      case 'c': case 'C': {
        if (e.ctrlKey) {
          e.preventDefault();
          if (inputEl.value) echoCommand(inputEl.value + '^C');
          inputEl.value = '';
          ac.hide(); ghostTextEl.textContent = '';
          historyIndex = -1;
        }
        break;
      }
      case 'l': case 'L': {
        if (e.ctrlKey) {
          e.preventDefault();
          clearOutput();
          inputEl.value = '';
          ac.hide(); ghostTextEl.textContent = '';
        }
        break;
      }
      default:
        if (!['Shift', 'Alt', 'Meta', 'Control'].includes(e.key)) ac.resetCycle();
    }
  }

  function handleInput() {
    ac.updateGhost(inputEl.value, currentPath);
  }

  // ── Boot sequence ─────────────────────────────────────────
  // Original window only: welcome + hint + divider.
  // Subsequent windows: silent boot, no lines at all.
  const BOOT_LINES = isFirst ? [
    { text: 'Welcome to hahahuy\'s portfolio  v1.0.0', cls: 'success' },
    { text: 'Type `init` to start or `help` for available commands.', cls: '' },
    { text: '────────────────────────────────────', cls: 'hr' },
  ] : [];

  function boot() {
    return new Promise(resolve => {
      if (BOOT_LINES.length === 0) { resolve(); return; }
      BOOT_LINES.forEach((line, i) => {
        setTimeout(() => {
          const div = document.createElement('div');
          div.className   = `output-line boot-line ${line.cls}`;
          div.textContent = line.text;
          output.appendChild(div);
          scrollBottom();
          if (i === BOOT_LINES.length - 1) setTimeout(resolve, 200);
        }, i * 60);
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    output.innerHTML = ''; // clear any cloned content

    inputEl.addEventListener('keydown', handleKeydown);
    inputEl.addEventListener('input',   handleInput);

    // Clickable ls items
    output.addEventListener('click', e => {
      const item = e.target.closest('.ls-item[data-cmd]');
      if (!item) return;
      const cmd = item.dataset.cmd;
      inputEl.value = '';
      echoCommand(cmd);
      commandHistory.unshift(cmd);
      if (commandHistory.length > 200) commandHistory.pop();
      historyIndex = -1; tempBuffer = '';
      executeCommand(cmd);
      resetIdleTimer();
    });

    // Click anywhere in body focuses input
    terminalBody.addEventListener('click', () => inputEl.focus());

    // Blog manifest only needs loading once (FS is shared)
    if (typeof loadBlogManifest === 'function' && !loadBlogManifest._loaded) {
      await loadBlogManifest();
      loadBlogManifest._loaded = true;
    }

    await boot();
    updatePrompt();
    inputEl.focus();
    // Idle timer arms only after the first command — not at boot.
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init,
    appendLine,
    appendHTML,
    appendMarkdown,
    appendSpacer,
    escapeHtml,
    getCwd,
    clearOutput,
    updatePrompt,
    scrollBottom,
    get currentPath()     { return currentPath; },
    set currentPath(p)    { currentPath = p; updatePrompt(); },
    get commandHistory()  { return commandHistory; },
  };
}

// ── Main terminal (original window) ───────────────────────────
const Terminal = createTerminal(document.getElementById('terminalWindow'));
document.addEventListener('DOMContentLoaded', () => Terminal.init());
