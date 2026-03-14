// Tracks whether the very first terminal has already been created.
// Uses App._firstTerminalCreated so multi-window clones stay independent.
let _isFirstTerminal = true;

/**
 * Create and wire a terminal instance inside `winEl`.
 * All DOM queries are relative to winEl so multiple instances
 * can coexist without ID collisions.
 */
function createTerminal(winEl) {
  // Claim "first terminal" slot before anything else runs
  const isFirst = _isFirstTerminal;
  _isFirstTerminal = false;
  if (isFirst) {
    App._firstTerminalCreated = true;
  }

  // ── DOM refs (scoped to this window) ─────────────────────
  const output = winEl.querySelector(".output");
  const inputEl = winEl.querySelector(".terminal-input");
  const promptDirEl = winEl.querySelector(".prompt-dir");
  const ghostTextEl = winEl.querySelector(".ghost-text");
  const autocompleteEl = winEl.querySelector(".autocomplete-list");
  const terminalBody = winEl.querySelector(".terminal-body");

  // ── Per-instance autocomplete ─────────────────────────────
  const ac = createAutocomplete(inputEl, ghostTextEl, autocompleteEl);

  // ── localStorage keys (only used by the first/main terminal) ─
  const HIST_KEY = Config.STORAGE.HISTORY;
  const CWD_KEY = Config.STORAGE.CWD;

  // ── State ─────────────────────────────────────────────────
  // Restore command history and cwd from localStorage (first terminal only)
  let commandHistory = [];
  let historyIndex = -1;
  let tempBuffer = "";
  let currentPath = ["~"];
  // Auth masking state
  let _authSuffix = "";
  let _suppressInput = false;
  // Paste-placeholder state
  let _pastedRaw = null; // real clipboard text when multiline paste is pending
  let _pastedPrefix = ""; // input text that preceded the pasted region

  if (isFirst) {
    try {
      const savedHist = localStorage.getItem(HIST_KEY);
      if (savedHist) commandHistory = JSON.parse(savedHist);
    } catch (e) {
      commandHistory = [];
    }

    try {
      const savedCwd = localStorage.getItem(CWD_KEY);
      if (savedCwd) currentPath = JSON.parse(savedCwd);
    } catch (e) {
      currentPath = ["~"];
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  function getCwd() {
    return currentPath.join("/");
  }
  function updatePrompt() {
    promptDirEl.textContent = getCwd();
    const userEl = winEl.querySelector(".prompt-user");
    if (userEl) userEl.textContent = App.visitorName ?? "visitor";
  }
  function scrollBottom() {
    output.scrollTop = output.scrollHeight;
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // ── Output writers ────────────────────────────────────────
  function appendHTML(html, extraClasses = []) {
    const div = document.createElement("div");
    div.className = ["output-line", ...extraClasses].join(" ");
    div.innerHTML = html;
    output.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendLine(text, extraClasses = []) {
    return appendHTML(escHtml(text), extraClasses);
  }

  function echoCommand(cmd) {
    // SEC: mask the passphrase when echoing `auth <passphrase>` so it never
    // appears in plain text in the terminal output.
    const displayCmd = /^auth\s+\S/.test(cmd) ? cmd.replace(/^(auth\s+)\S.*/, "$1****") : cmd;
    const div = document.createElement("div");
    div.className = "cmd-echo output-line";
    div.innerHTML =
      `<span class="echo-prompt"><span class="echo-user">${escHtml(App.visitorName ?? "visitor")}</span>@site:<span class="echo-dir">${escHtml(getCwd())}</span>$&nbsp;</span>` +
      `<span class="echo-cmd">${escHtml(displayCmd)}</span>`;
    output.appendChild(div);
  }

  // SEC-6: Strip dangerous elements/attributes from parsed Markdown before insertion.
  // Shared implementation lives in js/utils/html.js (sanitiseHtml).

  function appendMarkdown(mdText) {
    const div = document.createElement("div");
    div.className = "md-render";
    div.innerHTML = marked.parse(mdText);
    sanitiseHtml(div); // SEC-6: sanitise before any links are processed
    div.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    output.appendChild(div);
    renderMermaid(div).then(() => scrollBottom());
    scrollBottom();
  }

  function appendSpacer() {
    const div = document.createElement("div");
    div.className = "spacer";
    output.appendChild(div);
  }

  // Shared implementation lives in js/utils/html.js; expose locally for public API.
  function escapeHtml(str) {
    return escHtml(str);
  }

  function clearOutput() {
    output.innerHTML = "";
  }

  // ── Output memory guard (2d) ──────────────────────────────
  function trimOutput() {
    while (output.children.length > Config.MAX_OUTPUT_LINES) {
      output.removeChild(output.firstChild);
    }
  }

  // ── Close this window (quit command) ──────────────────────
  function closeWindow() {
    winEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    winEl.style.opacity = "0";
    winEl.style.transform = (winEl.style.transform || "") + " scale(0.95)";
    setTimeout(() => winEl.remove(), 210);
  }

  // ── Idle hint ─────────────────────────────────────────────
  const IDLE_DELAY_MS = Config.IDLE_HINT_DELAY_MS;
  let idleTimer = null;
  let hintFired = false;
  // Idle hint only arms after the user has typed at least one command
  // in the original window. For subsequent windows it never arms.
  let commandEverRun = !isFirst; // subsequent windows: permanently disabled

  function showHint() {
    hintFired = true;
    const div = document.createElement("div");
    div.className = "output-line muted hint-line";
    div.textContent = "Type `help` for available commands.";
    output.appendChild(div);
    scrollBottom();
  }

  function resetIdleTimer() {
    // Only the original window ever shows the idle hint,
    // and only after the user has run at least one command.
    if (!isFirst) return; // subsequent windows: never
    if (!commandEverRun) return; // original window: not yet armed
    if (hintFired) hintFired = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!hintFired) showHint();
    }, IDLE_DELAY_MS);
  }

  function armIdleAfterFirstCommand() {
    if (commandEverRun) return; // already armed
    commandEverRun = true;
    resetIdleTimer(); // start the clock from right now
  }

  // ── Command execution ─────────────────────────────────────
  function executeCommand(raw) {
    const parts = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = (parts[0] || "").toLowerCase();
    const args = parts.slice(1).map((a) => a.replace(/^['"]|['"]$/g, ""));

    // Easter egg
    if (raw.toLowerCase() === "sudo make me a coffee") {
      appendLine("☕  Brewing... jk, I'm a website. But I appreciate the request.", ["success"]);
      appendLine("    Try `open github` to see real projects instead.", ["muted"]);
      return;
    }

    // Render context: async commands (cat) call back into this instance
    const ctx = { appendMarkdown, appendLine, appendHTML, scrollBottom, winEl };

    // ── Dispatch raw input to EventBus first ──────────────────
    // Registered handlers (message-panel, auth, note-editor) consume
    // the input and return true if they handle it.
    const consumed = App.EventBus.emit("rawInput", { raw, ctx });
    if (consumed) {
      trimOutput();
      return;
    }

    const result = App.Commands.execute(cmd, args, currentPath, ctx);

    if (result) {
      if (result.newPath) {
        currentPath = result.newPath;
        // Persist cwd (2b)
        if (isFirst) {
          try {
            localStorage.setItem(CWD_KEY, JSON.stringify(currentPath));
          } catch (e) {}
        }
      }
      if (result.clear) clearOutput();
      if (result.quit) {
        closeWindow();
        return;
      }
      if (result.lines) result.lines.forEach((l) => appendHTML(l.html || "", l.classes || []));
      if (result.markdown) appendMarkdown(result.markdown);
      if (result.error) appendLine(result.error, ["error"]);
    }

    trimOutput(); // memory guard (2d)
    updatePrompt();
    scrollBottom();
    // Arm idle hint the first time a command is run in the original window
    armIdleAfterFirstCommand();
  }

  // ── Keyboard handler ──────────────────────────────────────
  function handleKeydown(e) {
    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        let displayRaw = inputEl.value.trim();
        if (_pastedRaw !== null) {
          displayRaw = (_pastedPrefix + _pastedRaw).trim();
          _pastedRaw = null;
          _pastedPrefix = "";
        }
        const raw = _authSuffix
          ? (displayRaw.match(/^auth\s+/)?.[0] ?? "auth ") + _authSuffix
          : displayRaw;
        _authSuffix = "";
        inputEl.type = "text";
        ac.hide();
        ghostTextEl.textContent = "";
        if (raw) {
          echoCommand(raw);
          commandHistory.unshift(raw);
          if (commandHistory.length > Config.MAX_HISTORY) commandHistory.pop();
          // Persist history (2a) — first terminal only
          if (isFirst) {
            try {
              localStorage.setItem(
                HIST_KEY,
                JSON.stringify(commandHistory.slice(0, Config.MAX_HISTORY)),
              );
            } catch (e) {}
          }
          historyIndex = -1;
          tempBuffer = "";
          executeCommand(raw);
        }
        inputEl.value = "";
        scrollBottom();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (historyIndex === -1) tempBuffer = inputEl.value;
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          inputEl.value = commandHistory[historyIndex];
          requestAnimationFrame(() => {
            inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
          });
        }
        ac.hide();
        ghostTextEl.textContent = "";
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          inputEl.value = commandHistory[historyIndex];
        } else if (historyIndex === 0) {
          historyIndex = -1;
          inputEl.value = tempBuffer;
        }
        ac.hide();
        ghostTextEl.textContent = "";
        break;
      }
      case "Tab": {
        e.preventDefault();
        ac.trigger(inputEl.value, currentPath);
        break;
      }
      case "ArrowRight": {
        // Accept ghost-text suggestion when cursor is at end of input
        if (inputEl.selectionStart === inputEl.value.length) {
          const accepted = ac.acceptGhost(inputEl.value, currentPath);
          if (accepted) {
            e.preventDefault();
            inputEl.value = accepted;
            ghostTextEl.textContent = "";
            ac.hide();
          }
        }
        break;
      }
      case "c":
      case "C": {
        if (e.ctrlKey) {
          e.preventDefault();
          if (inputEl.value) echoCommand(inputEl.value + "^C");
          inputEl.type = "text";
          _authSuffix = "";
          inputEl.value = "";
          ac.hide();
          ghostTextEl.textContent = "";
          historyIndex = -1;
        }
        break;
      }
      case "l":
      case "L": {
        if (e.ctrlKey) {
          e.preventDefault();
          clearOutput();
          inputEl.value = "";
          ac.hide();
          ghostTextEl.textContent = "";
        }
        break;
      }
      default:
        if (!["Shift", "Alt", "Meta", "Control"].includes(e.key)) ac.resetCycle();
    }
  }

  function handleInput(e) {
    if (_suppressInput) return;
    if (_pastedRaw !== null) {
      _pastedRaw = null;
      _pastedPrefix = "";
    }
    const val = inputEl.value;
    const authMatch = val.match(/^auth\s+/);

    if (!authMatch) {
      _authSuffix = "";
      ac.updateGhost(val, currentPath);
      return;
    }

    // Track real suffix via InputEvent.inputType
    if (e?.inputType === "insertText" && e.data) {
      _authSuffix += e.data;
    } else if (e?.inputType === "deleteContentBackward") {
      _authSuffix = _authSuffix.slice(0, -1);
    } else if (e?.inputType === "deleteWordBackward") {
      _authSuffix = "";
    } else {
      // Paste/drag/other: derive length delta from raw displayed suffix
      const displayedSuffix = val.slice(authMatch[0].length);
      const delta = displayedSuffix.length - _authSuffix.length;
      if (delta > 0) _authSuffix += displayedSuffix.slice(-delta);
      else if (delta < 0) _authSuffix = _authSuffix.slice(0, delta);
    }

    // Overwrite display with masked version
    _suppressInput = true;
    inputEl.value = authMatch[0] + "●".repeat(_authSuffix.length);
    requestAnimationFrame(() => {
      inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
    });
    _suppressInput = false;
    ghostTextEl.textContent = "";
  }

  // ── Boot sequence ─────────────────────────────────────────
  // Original window only: ASCII logo (instant) + 3 hint lines typewritten.
  // Subsequent windows: silent boot, no lines at all.

  const ASCII_LOGO_HTML =
    `<span style="color:var(--color-green)">` +
    `██╗  ██╗██╗  ██╗\n` +
    `██║  ██║██║  ██║\n` +
    `███████║███████║\n` +
    `██╔══██║██╔══██║\n` +
    `██║  ██║██║  ██║\n` +
    `╚═╝  ╚═╝╚═╝  ╚═╝` +
    `</span>` +
    `<span style="color:var(--text-muted)">   hahuy.site</span>`;

  function getBootLines(name) {
    if (!isFirst) return [];
    const greeting = name ? `hey ${name} — welcome.` : `quantum engineer · builder · tinkerer.`;
    return [
      { text: greeting, cls: "success" },
      {
        text: "try `init` for an overview · `help` for all commands · `transformers.py` to talk to my oracle.",
        cls: "muted",
      },
      { text: "────────────────────────────────────", cls: "hr" },
    ];
  }

  // VIS-1: Typewriter effect — types text char-by-char at ~28ms/char
  function typewriterLine(text, cls) {
    return new Promise((resolve) => {
      const div = document.createElement("div");
      div.className = `output-line boot-line ${cls} typing`;
      output.appendChild(div);
      scrollBottom();

      let i = 0;
      function tick() {
        if (i < text.length) {
          div.textContent = text.slice(0, ++i);
          scrollBottom();
          setTimeout(tick, 28);
        } else {
          div.classList.remove("typing");
          resolve();
        }
      }
      tick();
    });
  }

  async function boot(name) {
    if (!isFirst) return;
    // 1. Instant ASCII art block
    const artDiv = document.createElement("div");
    artDiv.className = "output-line boot-art";
    artDiv.style.whiteSpace = "pre";
    artDiv.innerHTML = ASCII_LOGO_HTML;
    output.appendChild(artDiv);
    scrollBottom();
    // 2. Typewriter hint lines
    const lines = getBootLines(name);
    await lines.reduce(
      (chain, l) => chain.then(() => typewriterLine(l.text, l.cls)),
      Promise.resolve(),
    );
    await new Promise((r) => setTimeout(r, 120));
  }

  // ── Name wall ─────────────────────────────────────────────
  function showNameWall() {
    return new Promise((resolve) => {
      const wall = winEl.querySelector("#nameWall");
      const nameInput = winEl.querySelector("#nameInput");
      if (!wall) return resolve(null);

      // Check sessionStorage for returning visitors (page refresh)
      const saved = sessionStorage.getItem(Config.STORAGE.VISITOR_NAME);
      if (saved) {
        wall.remove();
        return resolve(saved);
      }

      document.body.classList.add("name-wall-active");

      // Hard-block all keyboard events that leak outside the wall
      function wallKeyCapture(e) {
        if (!wall.contains(e.target)) e.stopImmediatePropagation();
      }
      document.addEventListener("keydown", wallKeyCapture, true);
      document.addEventListener("keyup", wallKeyCapture, true);
      document.addEventListener("keypress", wallKeyCapture, true);

      // Trap focus inside the wall so Tab can't escape
      function wallFocusTrap(e) {
        if (!wall.contains(e.target)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          nameInput.focus();
        }
      }
      document.addEventListener("focusin", wallFocusTrap, true);

      // Set terminal input inert so it can't receive focus at all
      inputEl.setAttribute("tabindex", "-1");
      inputEl.setAttribute("inert", "");

      nameInput.focus();

      function submit(name) {
        document.removeEventListener("keydown", wallKeyCapture, true);
        document.removeEventListener("keyup", wallKeyCapture, true);
        document.removeEventListener("keypress", wallKeyCapture, true);
        document.removeEventListener("focusin", wallFocusTrap, true);
        inputEl.removeAttribute("inert");
        inputEl.removeAttribute("tabindex");
        document.body.classList.remove("name-wall-active");
        wall.remove();
        const trimmed = name && name.trim() ? name.trim().replace(/\s+/g, "-") : null;
        if (trimmed) sessionStorage.setItem(Config.STORAGE.VISITOR_NAME, trimmed);
        resolve(trimmed);
      }

      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit(nameInput.value);
        }
        if (e.key === "c" && e.ctrlKey) {
          e.preventDefault();
          submit(null);
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    output.innerHTML = ""; // clear any cloned content

    // For non-first windows, remove leftover nameWall immediately
    if (!isFirst) {
      const wall = winEl.querySelector(".name-wall");
      if (wall) wall.remove();
    }

    inputEl.addEventListener("keydown", handleKeydown);
    inputEl.addEventListener("input", handleInput);
    inputEl.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") || "";
      const parts = text.split("\n");
      if (parts.length <= 1) return; // single-line: let browser handle normally
      e.preventDefault();
      _pastedPrefix = inputEl.value.slice(0, inputEl.selectionStart);
      _pastedRaw = text;
      const n = parts.length - 1;
      inputEl.value = _pastedPrefix + `[pasted text +${n} line${n !== 1 ? "s" : ""}]`;
    });

    // UX-5: Shift+Click on any output line copies its text to clipboard
    output.addEventListener("click", (e) => {
      if (!e.shiftKey) return;
      const line = e.target.closest(".output-line");
      if (!line) return;
      const txt = line.textContent || "";
      navigator.clipboard
        .writeText(txt)
        .then(() => {
          line.classList.add("copy-flash");
          line.addEventListener("animationend", () => line.classList.remove("copy-flash"), {
            once: true,
          });
        })
        .catch(() => {});
    });

    // Clickable ls items
    output.addEventListener("click", (e) => {
      const item = e.target.closest(".ls-item[data-cmd]");
      if (!item) return;
      const cmd = item.dataset.cmd;
      inputEl.value = "";
      echoCommand(cmd);
      commandHistory.unshift(cmd);
      if (commandHistory.length > Config.MAX_HISTORY) commandHistory.pop();
      // Persist history (2a)
      if (isFirst) {
        try {
          localStorage.setItem(
            HIST_KEY,
            JSON.stringify(commandHistory.slice(0, Config.MAX_HISTORY)),
          );
        } catch (e) {}
      }
      historyIndex = -1;
      tempBuffer = "";
      executeCommand(cmd);
      resetIdleTimer();
    });

    // Clickable help items — fill input with command name
    output.addEventListener("click", (e) => {
      const item = e.target.closest(".help-item[data-cmd]");
      if (!item) return;
      inputEl.value = item.dataset.cmd;
      inputEl.focus();
      requestAnimationFrame(() => {
        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
      });
    });

    // Click anywhere in body focuses input
    terminalBody.addEventListener("click", () => inputEl.focus());

    // Red traffic-light dot closes the window (same as `quit`)
    const dotRed = winEl.querySelector(".dot-red");
    if (dotRed) dotRed.addEventListener("click", closeWindow);

    // Blog manifest + published notes load in parallel (FS is shared across all terminal instances)
    const bootPromises = [];
    if (typeof loadBlogManifest === "function" && !loadBlogManifest._loaded) {
      bootPromises.push(
        loadBlogManifest().then(() => {
          loadBlogManifest._loaded = true;
        }),
      );
    }
    if (typeof loadPublishedNotes === "function" && !loadPublishedNotes._loaded) {
      bootPromises.push(
        loadPublishedNotes().then(() => {
          loadPublishedNotes._loaded = true;
        }),
      );
    }
    if (typeof loadUploadedImages === "function" && !loadUploadedImages._loaded) {
      bootPromises.push(
        loadUploadedImages().then(() => {
          loadUploadedImages._loaded = true;
        }),
      );
    }
    await Promise.all(bootPromises);

    let visitorName = null;
    if (isFirst) {
      visitorName = await showNameWall();
      App.visitorName = visitorName || null;
    }

    await boot(visitorName);
    updatePrompt();
    inputEl.focus();

    // PERF: Signal other modules that terminal boot is done.
    // Only dispatch on the first terminal window — contextmenu-cloned windows must not re-fire.
    if (isFirst) {
      document.dispatchEvent(new CustomEvent("terminal:ready"));
    }

    // URL deep-linking (3a) — auto-execute #cmd=<encoded> after boot
    // SEC-1: Only whitelisted read-only commands may be deep-linked.
    const DEEPLINK_WHITELIST =
      /^(cat|ls|cd|whoami|neofetch|theme|help|pwd|echo|fortune|cowsay|banner|weather)\b/i;
    if (isFirst) {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#cmd=")) {
        try {
          const autoCmd = decodeURIComponent(hash.slice(5));
          if (autoCmd && !autoCmd.includes("\n") && !autoCmd.includes("\r")) {
            if (!DEEPLINK_WHITELIST.test(autoCmd.trim())) {
              // Blocked — show a red warning after boot
              setTimeout(() => {
                appendHTML(
                  `<span style="color:var(--color-red)">⚠ Deep-link blocked: command not permitted via URL.</span>`,
                  ["output-line"],
                );
                scrollBottom();
              }, 400);
            } else {
              // Safe — execute after a small delay so boot output renders first
              setTimeout(() => {
                echoCommand(autoCmd);
                commandHistory.unshift(autoCmd);
                if (commandHistory.length > Config.MAX_HISTORY) commandHistory.pop();
                try {
                  localStorage.setItem(
                    HIST_KEY,
                    JSON.stringify(commandHistory.slice(0, Config.MAX_HISTORY)),
                  );
                } catch (e) {}
                executeCommand(autoCmd);
              }, 350);
            }
          }
        } catch (e) {
          /* ignore malformed hash */
        }
      }
    }

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
    get currentPath() {
      return currentPath;
    },
    set currentPath(p) {
      currentPath = p;
      updatePrompt();
      if (isFirst) {
        try {
          localStorage.setItem(CWD_KEY, JSON.stringify(p));
        } catch (e) {}
      }
    },
    get commandHistory() {
      return commandHistory;
    },
  };
}

// ── Main terminal (original window) ───────────────────────────
const Terminal = createTerminal(document.getElementById("terminalWindow"));
App._firstTerminal = Terminal; // expose to App namespace for `history` command
document.addEventListener("DOMContentLoaded", () => Terminal.init());

// Mouse-tracking backdrop highlight
(() => {
  let _pending = false;
  document.addEventListener("mousemove", (e) => {
    if (_pending) return;
    _pending = true;
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty(
        "--mouse-x",
        ((e.clientX / window.innerWidth) * 100).toFixed(1) + "%",
      );
      document.documentElement.style.setProperty(
        "--mouse-y",
        ((e.clientY / window.innerHeight) * 100).toFixed(1) + "%",
      );
      _pending = false;
    });
  });
})();

// Export to globalThis for modules loaded via new Function(src)()
globalThis.createTerminal = createTerminal;
globalThis.Terminal = Terminal;
