/* ============================================================
   terminal.js — Core Engine: I/O, History, Cursor, Boot
   ============================================================ */

'use strict';

const Terminal = (() => {

  // ── DOM refs ───────────────────────────────────────────────
  const output          = document.getElementById('output');
  const inputEl         = document.getElementById('terminalInput');
  const promptDirEl     = document.getElementById('promptDir');
  const ghostTextEl     = document.getElementById('ghostText');
  const autocompleteEl  = document.getElementById('autocompleteList');
  const terminalBody    = document.getElementById('terminalBody');

  // ── State ──────────────────────────────────────────────────
  let commandHistory    = [];
  let historyIndex      = -1;
  let tempBuffer        = '';     // save partial input while browsing history
  let currentPath       = ['~']; // virtual cwd stack

  // ── Helpers ───────────────────────────────────────────────
  function getCwd() {
    return currentPath.join('/');
  }

  function updatePrompt() {
    promptDirEl.textContent = getCwd();
  }

  // Scroll to bottom
  function scrollBottom() {
    output.scrollTop = output.scrollHeight;
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // ── Output Writers ────────────────────────────────────────

  /**
   * Append a raw HTML string as a new output block.
   * @param {string} html
   * @param {string[]} [extraClasses] — added to the wrapper div
   */
  function appendHTML(html, extraClasses = []) {
    const div = document.createElement('div');
    div.className = ['output-line', ...extraClasses].join(' ');
    div.innerHTML = html;
    output.appendChild(div);
    scrollBottom();
    return div;
  }

  /**
   * Append a plain-text line. HTML-escapes the text.
   * @param {string} text
   * @param {string[]} [extraClasses]
   */
  function appendLine(text, extraClasses = []) {
    return appendHTML(escapeHtml(text), extraClasses);
  }

  /**
   * Echo the command the user typed (with styled prompt).
   */
  function echoCommand(cmd) {
    const div = document.createElement('div');
    div.className = 'cmd-echo output-line';
    div.innerHTML =
      `<span class="echo-prompt">visitor@portfolio:<span class="echo-dir">${escapeHtml(getCwd())}</span>$&nbsp;</span>` +
      `<span class="echo-cmd">${escapeHtml(cmd)}</span>`;
    output.appendChild(div);
  }

  /**
   * Append a markdown-rendered block (no hover highlight).
   */
  function appendMarkdown(mdText) {
    const div = document.createElement('div');
    div.className = 'md-render';
    div.innerHTML = marked.parse(mdText);
    // Make all links open in new tab
    div.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    });
    output.appendChild(div);
    scrollBottom();
  }

  /** Append a blank spacer line */
  function appendSpacer() {
    const div = document.createElement('div');
    div.className = 'spacer';
    output.appendChild(div);
  }

  // ── HTML escaping ─────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Input handling ────────────────────────────────────────
  function handleKeydown(e) {
    resetIdleTimer(); // any keypress resets the idle hint timer
    switch (e.key) {

      case 'Enter': {
        e.preventDefault();
        const raw = inputEl.value.trim();
        Autocomplete.hide();
        ghostTextEl.textContent = '';

        if (raw) {
          echoCommand(raw);
          commandHistory.unshift(raw);
          if (commandHistory.length > 200) commandHistory.pop();
          historyIndex = -1;
          tempBuffer = '';
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
          // Move cursor to end
          requestAnimationFrame(() => {
            inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
          });
        }
        Autocomplete.hide();
        ghostTextEl.textContent = '';
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
        Autocomplete.hide();
        ghostTextEl.textContent = '';
        break;
      }

      case 'Tab': {
        e.preventDefault();
        Autocomplete.trigger(inputEl.value, currentPath);
        break;
      }

      case 'c':
      case 'C': {
        if (e.ctrlKey) {
          e.preventDefault();
          if (inputEl.value) {
            echoCommand(inputEl.value + '^C');
          }
          inputEl.value = '';
          Autocomplete.hide();
          ghostTextEl.textContent = '';
          historyIndex = -1;
        }
        break;
      }

      case 'l':
      case 'L': {
        if (e.ctrlKey) {
          e.preventDefault();
          Commands.execute('clear', [], currentPath);
          inputEl.value = '';
          Autocomplete.hide();
          ghostTextEl.textContent = '';
        }
        break;
      }

      default:
        // Hide autocomplete list on any other key (except shift/alt/meta)
        if (!['Shift', 'Alt', 'Meta', 'Control'].includes(e.key)) {
          Autocomplete.resetCycle();
        }
    }
  }

  function handleInput() {
    const val = inputEl.value;
    Autocomplete.updateGhost(val, currentPath);
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

    const result = Commands.execute(cmd, args, currentPath);

    if (result) {
      if (result.newPath)   currentPath = result.newPath;
      if (result.clear)     clearOutput();
      if (result.lines)     result.lines.forEach(l => appendHTML(l.html || '', l.classes || []));
      if (result.markdown)  appendMarkdown(result.markdown);
      if (result.error)     appendLine(result.error, ['error']);
    }

    updatePrompt();
    scrollBottom();
  }

  // ── Idle hint ─────────────────────────────────────────────
  const IDLE_DELAY_MS = 8000; // show hint after 8 s of no interaction
  let idleTimer = null;

  function showHint() {
    const div = document.createElement('div');
    div.className = 'output-line muted hint-line';
    div.textContent = 'Type `help` for available commands.';
    output.appendChild(div);
    scrollBottom();
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showHint, IDLE_DELAY_MS);
  }

  function clearOutput() {
    output.innerHTML = '';
    // Always show hint immediately after clear
    showHint();
    resetIdleTimer();
  }

  // ── Boot sequence ─────────────────────────────────────────
  const BOOT_LINES = [
    { text: 'Welcome to hahahuy\'s portfolio  v1.0.0', cls: 'success' },
    { text: 'Type `help` for available commands.', cls: '' },
    { text: '────────────────────────────────────', cls: 'hr' },
  ];

  const BOOT_DELAY_MS = 60; // ms between each boot line

  function boot() {
    return new Promise(resolve => {
      BOOT_LINES.forEach((line, i) => {
        setTimeout(() => {
          const div = document.createElement('div');
          div.className = `output-line boot-line ${line.cls}`;
          div.style.animationDelay = '0ms'; // already delayed by setTimeout
          div.textContent = line.text;
          output.appendChild(div);
          scrollBottom();

          if (i === BOOT_LINES.length - 1) {
            setTimeout(resolve, 200);
          }
        }, i * BOOT_DELAY_MS);
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    inputEl.addEventListener('keydown', handleKeydown);
    inputEl.addEventListener('input',   handleInput);

    // Focus on click anywhere in terminal body
    document.getElementById('terminalBody').addEventListener('click', () => {
      inputEl.focus();
    });

    // Run boot sequence then focus
    await boot();
    updatePrompt();
    inputEl.focus();
    resetIdleTimer(); // start idle timer after boot
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
    get currentPath()  { return currentPath; },
    set currentPath(p) { currentPath = p; updatePrompt(); },
    get commandHistory()  { return commandHistory; },
  };

})();

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', () => Terminal.init());
