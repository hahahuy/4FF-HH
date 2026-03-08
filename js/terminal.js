/* ============================================================
   terminal.js — Factory: TerminalFactory.createTerminal(containerEl)
   ============================================================ */

'use strict';

const TerminalFactory = (() => {

  /**
   * Create a terminal instance scoped to a given container element.
   * @param {HTMLElement} containerEl  — the .terminal-window root
   * @returns {object} terminal API
   */
  function createTerminal(containerEl) {

    // ── DOM refs (scoped to this window) ──────────────────────
    const outputEl       = containerEl.querySelector('.output');
    const inputEl        = containerEl.querySelector('.terminal-input');
    const promptDirEl    = containerEl.querySelector('.prompt-dir');
    const ghostEl        = containerEl.querySelector('.ghost-text');
    const autocompleteEl = containerEl.querySelector('.autocomplete-list');
    const terminalBody   = containerEl.querySelector('.terminal-body');

    // ── Per-instance state ────────────────────────────────────
    let commandHistory = [];
    let historyIndex   = -1;
    let tempBuffer     = '';
    let currentPath    = ['~'];

    // ── Helpers ───────────────────────────────────────────────
    function getCwd() {
      return currentPath.join('/');
    }

    function updatePrompt() {
      promptDirEl.textContent = getCwd();
      // Also update titlebar label
      const label = containerEl.querySelector('.titlebar-label');
      if (label) label.textContent = `visitor@portfolio:${getCwd()}`;
    }

    function scrollBottom() {
      outputEl.scrollTop = outputEl.scrollHeight;
      terminalBody.scrollTop = terminalBody.scrollHeight;
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

    // ── Output Writers ────────────────────────────────────────

    function appendHTML(html, extraClasses = []) {
      const div = document.createElement('div');
      div.className = ['output-line', ...extraClasses].join(' ');
      div.innerHTML = html;
      outputEl.appendChild(div);
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
      outputEl.appendChild(div);
    }

    function appendMarkdown(mdText) {
      const div = document.createElement('div');
      div.className = 'md-render';
      div.innerHTML = marked.parse(mdText);
      div.querySelectorAll('a').forEach(a => {
        a.target = '_blank';
        a.rel    = 'noopener noreferrer';
      });
      outputEl.appendChild(div);
      scrollBottom();
    }

    function appendSpacer() {
      const div = document.createElement('div');
      div.className = 'spacer';
      outputEl.appendChild(div);
    }

    function clearOutput() {
      outputEl.innerHTML = '';
    }

    // ── Boot sequence ─────────────────────────────────────────
    const BOOT_LINES = [
      { text: "Welcome to hahahuy's portfolio  v2.0.0", cls: 'success' },
      { text: 'Type `help` for available commands.', cls: '' },
      { text: '────────────────────────────────────', cls: 'hr' },
    ];

    function runBootSequence() {
      return new Promise(resolve => {
        BOOT_LINES.forEach((bootLine, i) => {
          setTimeout(() => {
            const div = document.createElement('div');
            div.className = `output-line boot-line ${bootLine.cls}`;
            div.textContent = bootLine.text;
            outputEl.appendChild(div);
            scrollBottom();
            if (i === BOOT_LINES.length - 1) {
              setTimeout(() => {
                updatePrompt();
                inputEl.focus();
                resolve();
              }, 200);
            }
          }, i * 60);
        });
      });
    }

    // ── Keydown handler (attached here, not in WindowManager) ─
    function handleKeydown(e) {
      // Commands executor is wired by WindowManager; we handle
      // history / meta keys here.
      switch (e.key) {
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
          // Signal autocomplete hide via custom event
          inputEl.dispatchEvent(new CustomEvent('terminal:hideAutocomplete'));
          ghostEl.textContent = '';
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
          inputEl.dispatchEvent(new CustomEvent('terminal:hideAutocomplete'));
          ghostEl.textContent = '';
          break;
        }

        case 'c':
        case 'C': {
          if (e.ctrlKey) {
            e.preventDefault();
            if (inputEl.value) echoCommand(inputEl.value + '^C');
            inputEl.value = '';
            inputEl.dispatchEvent(new CustomEvent('terminal:hideAutocomplete'));
            ghostEl.textContent = '';
            historyIndex = -1;
          }
          break;
        }

        case 'l':
        case 'L': {
          if (e.ctrlKey) {
            e.preventDefault();
            clearOutput();
            inputEl.value = '';
            inputEl.dispatchEvent(new CustomEvent('terminal:hideAutocomplete'));
            ghostEl.textContent = '';
          }
          break;
        }

        default:
          if (!['Shift', 'Alt', 'Meta', 'Control', 'Tab', 'Enter'].includes(e.key)) {
            inputEl.dispatchEvent(new CustomEvent('terminal:resetCycle'));
          }
      }
    }

    inputEl.addEventListener('keydown', handleKeydown);

    // Focus terminal body click → focus input
    terminalBody.addEventListener('click', () => inputEl.focus());

    // ── Public API ────────────────────────────────────────────
    return {
      containerEl,
      inputEl,
      outputEl,
      ghostEl,
      autocompleteEl,
      appendLine,
      appendHTML,
      appendMarkdown,
      appendSpacer,
      clearOutput,
      echoCommand,
      escapeHtml,
      getCwd,
      updatePrompt,
      scrollBottom,
      runBootSequence,
      get currentPath()    { return currentPath; },
      set currentPath(p)   { currentPath = p; updatePrompt(); },
      get commandHistory()          { return commandHistory; },
      set commandHistory(h)         { commandHistory = h; },
      get historyIndex()            { return historyIndex; },
      set historyIndex(i)           { historyIndex = i; },
      get tempBuffer()              { return tempBuffer; },
      set tempBuffer(b)             { tempBuffer = b; },
    };
  }

  return { createTerminal };

})();
