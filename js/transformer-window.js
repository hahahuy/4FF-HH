const TransformerWindow = (() => {
  // ── State ──────────────────────────────────────────────
  let _active = false;
  let _win = null;
  let _outputEl = null;
  let _inputEl = null;
  let _onClose = null;

  // ── Spinner frames ─────────────────────────────────────
  const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  // ── Build window DOM ───────────────────────────────────
  function buildWindow() {
    const win = document.createElement("div");
    win.className = "terminal-window transformer-window";
    win.innerHTML =
      `<div class="titlebar tw-titlebar">` +
      `<span class="dot dot-red" id="twDotRed"></span>` +
      `<span class="dot dot-yellow"></span>` +
      `<span class="dot dot-green"></span>` +
      `<span class="titlebar-label">transformers.py</span>` +
      `<span class="tw-model-label">oracle v0.2 · Llama-3.2-3B</span>` +
      `</div>` +
      `<div class="tw-body">` +
      `<div class="tw-output"></div>` +
      `<div class="tw-input-row">` +
      `<span class="tw-prompt">›&nbsp;</span>` +
      `<input class="tw-input terminal-input" type="text" ` +
      `autocomplete="off" placeholder="Ask me anything about Ha Huy…" />` +
      `</div>` +
      `</div>`;
    return win;
  }

  // ── Position relative to caller window ────────────────
  function position(win, callerWin) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw <= Config.BREAKPOINT_MOBILE) {
      // Mobile: fullscreen (CSS handles this via media query)
      win.style.cssText = "";
      return;
    }

    const W = 420;
    const H = 520;
    let left, top;

    if (callerWin) {
      const r = callerWin.getBoundingClientRect();
      // Try right of caller
      const rightLeft = r.right + 16;
      const leftLeft = r.left - 16 - W;

      if (rightLeft + W <= vw - 16) {
        left = rightLeft;
      } else if (leftLeft >= 16) {
        left = leftLeft;
      } else {
        // Fallback: center + 60px right offset
        left = Math.round((vw - W) / 2) + 60;
      }

      // Vertical: align top with caller, clamped
      top = Math.max(16, Math.min(Math.round(r.top), vh - H - 16));
    } else {
      left = Math.round((vw - W) / 2) + 60;
      top = Math.round((vh - H) / 2);
    }

    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.width = `${W}px`;
    win.style.height = `${H}px`;
  }

  // ── Append a line to output ────────────────────────────
  function appendLine(text, classes = []) {
    if (!_outputEl) return;
    const div = document.createElement("div");
    div.className = ["output-line", ...classes].join(" ");
    div.textContent = text;
    _outputEl.appendChild(div);
    _outputEl.scrollTop = _outputEl.scrollHeight;
  }

  function appendHTML(html, classes = []) {
    if (!_outputEl) return;
    const div = document.createElement("div");
    div.className = ["output-line", ...classes].join(" ");
    div.innerHTML = html;
    _outputEl.appendChild(div);
    _outputEl.scrollTop = _outputEl.scrollHeight;
  }

  // ── Render markdown answer (simplified — mirrors terminal appendMarkdown) ─
  function appendMarkdown(md) {
    if (!_outputEl) return;
    const wrapper = document.createElement("div");
    wrapper.className = "output-line md-render";
    wrapper.innerHTML =
      typeof marked !== "undefined" ? marked.parse(md) : `<pre>${escHtml(md)}</pre>`;
    if (typeof sanitiseHtml === "function") sanitiseHtml(wrapper);
    wrapper.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    _outputEl.appendChild(wrapper);
    _outputEl.scrollTop = _outputEl.scrollHeight;
  }

  // ── Handle Enter in input ──────────────────────────────
  function handleSubmit() {
    if (!_inputEl || !_active) return;
    const question = _inputEl.value.trim();
    if (!question) return;
    _inputEl.value = "";
    _inputEl.disabled = true;

    // Echo question
    appendHTML(
      `<span style="color:var(--color-green)">›</span> ` +
        `<span style="color:var(--text-primary)">${escHtml(question)}</span>`,
    );

    // Spinner
    const thinkEl = document.createElement("div");
    thinkEl.className = "output-line muted oracle-thinking";
    const spinnerSpan = document.createElement("span");
    spinnerSpan.className = "oracle-spinner";
    spinnerSpan.textContent = "⠋";
    thinkEl.appendChild(spinnerSpan);
    thinkEl.appendChild(document.createTextNode(" Thinking…"));
    _outputEl.appendChild(thinkEl);
    _outputEl.scrollTop = _outputEl.scrollHeight;

    let _fi = 0;
    const _spin = setInterval(() => {
      spinnerSpan.textContent = FRAMES[_fi++ % FRAMES.length];
    }, 80);

    const isAuth = typeof Auth !== "undefined" && Auth.isAuthenticated();
    const body = isAuth ? { question, token: Auth.getToken() } : { question };

    cfPost(Config.CF_BASE + "/aiAsk", body)
      .then((data) => {
        clearInterval(_spin);
        thinkEl.remove();
        const answer = (data.answer || "").trim();
        if (!answer) {
          appendLine("oracle: empty response.", ["error"]);
        } else {
          appendHTML(
            `<span style="color:var(--color-green);font-weight:700">oracle</span>` +
              `<span style="color:var(--text-muted)"> › </span>`,
          );
          appendMarkdown(answer);
        }
      })
      .catch((e) => {
        clearInterval(_spin);
        thinkEl.remove();
        const msg = e.message.toLowerCase().includes("rate limit")
          ? "Rate limit reached — try again in an hour."
          : e.message.toLowerCase().includes("tokens")
            ? "Sorry, we ran out of tokens :( Come back later!"
            : "Oracle is offline. Try again later.";
        appendLine(`oracle: ${msg}`, ["error"]);
      })
      .finally(() => {
        if (_active && _inputEl) {
          _inputEl.disabled = false;
          _inputEl.focus();
        }
        if (_outputEl) _outputEl.scrollTop = _outputEl.scrollHeight;
      });
  }

  // ── Public: open(ctx, onClose) ─────────────────────────
  function open(ctx, onClose) {
    if (_active) return;
    _active = true;
    _onClose = onClose || null;

    _win = buildWindow();
    document.body.appendChild(_win);

    _outputEl = _win.querySelector(".tw-output");
    _inputEl = _win.querySelector(".tw-input");

    // Position relative to caller window
    const callerWin = ctx ? ctx.winEl : null;
    position(_win, callerWin);

    // Z-index: max-scan across all terminal windows
    const allWins = [...document.querySelectorAll(".terminal-window")];
    const maxZ = allWins.reduce(
      (m, w) => Math.max(m, Number.parseInt(w.style.zIndex, 10) || 10),
      10,
    );
    _win.style.zIndex = maxZ + 1;

    // Make draggable
    if (App.Draggable?.init) {
      App.Draggable.init(_win);
    }

    // Animate in
    afterLayout(() => {
      _win.classList.add("tw-visible");
    });

    // Wire red dot close
    const dotRed = _win.querySelector("#twDotRed");
    if (dotRed) dotRed.addEventListener("click", () => close());

    // Wire input Enter
    _inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });

    // Focus after animation
    setTimeout(() => {
      if (_inputEl) _inputEl.focus();
    }, 220);
  }

  // ── Public: close() ────────────────────────────────────
  function close() {
    if (!_active) return;
    _active = false; // set first to prevent re-entry

    const win = _win;
    const cb = _onClose;
    _win = null;
    _outputEl = null;
    _inputEl = null;
    _onClose = null;

    if (win) {
      win.classList.remove("tw-visible");
      win.classList.add("tw-closing");
      setTimeout(() => {
        if (win.parentNode) win.remove();
      }, 220);
    }

    if (cb) cb();
  }

  // ── Public: isOpen() ───────────────────────────────────
  function isOpen() {
    return _active;
  }

  return { open, close, isOpen };
})();

App.TransformerWindow = TransformerWindow;
