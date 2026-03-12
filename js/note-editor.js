const NoteEditor = (() => {
  // ── Cloud Functions base URL ───────────────────────────
  const CF_BASE = Config.CF_BASE;

  // ── Editor state ──────────────────────────────────────
  let _active = false;
  let _filename = null;
  let _savedContent = ""; // Last content saved to Firebase / GitHub
  let _dirty = false; // Unsaved changes?
  let _editorWin = null; // The .terminal-window DOM element
  let _textareaEl = null; // The <textarea>
  let _previewEl = null; // The preview <div>
  let _statusEl = null; // Status badge in titlebar
  let _debounceTimer = null;
  let _callerCtx = null; // Terminal ctx for messages
  let _callerWin = null; // Terminal winEl for layout
  let _mode = "note"; // 'note' | 'site'
  let _siteFileKey = null; // fileKey sent to siteFileWrite CF (site mode only)

  // ── Delete confirm state ───────────────────────────────
  let _pendingDelete = false;
  let _deleteFilename = null;
  let _deleteCtx = null;

  // ── HTML escaper — uses shared escHtml from js/utils/html.js ─
  // ── HTML sanitiser — uses shared sanitiseHtml from js/utils/html.js ─
  function esc(str) {
    return escHtml(str);
  }

  // ── Build the editor window DOM ───────────────────────
  function buildWindow(filename, mode) {
    const win = document.createElement("div");
    win.className = "terminal-window note-editor-window";

    // Titlebar path: site files show content/<path>, notes show notes/<name>
    const titlePath = mode === "site" ? `content/${filename}` : `notes/${filename}`;

    // Badge: site files get a blue "site file" badge
    const badgeClass =
      mode === "site" ? "ne-status-badge ne-status-site" : "ne-status-badge ne-status-muted";
    const badgeText = mode === "site" ? "site file" : "new file";

    win.innerHTML =
      `<div class="titlebar ne-titlebar">` +
      `<span class="dot dot-red" id="neDotRed"></span>` +
      `<span class="dot dot-yellow"></span>` +
      `<span class="dot dot-green"></span>` +
      `<span class="ne-titlebar-filename">${esc(titlePath)}</span>` +
      `<span class="${esc(badgeClass)}" id="neStatus">${badgeText}</span>` +
      `</div>` +
      `<div class="ne-body">` +
      `<div class="ne-pane ne-editor-pane">` +
      `<textarea class="ne-textarea" id="neTextarea" ` +
      `autocomplete="off" autocorrect="off" ` +
      `autocapitalize="off" spellcheck="false" ` +
      `placeholder="Start writing Markdown…"></textarea>` +
      `<div class="ne-editor-hint">` +
      `<span style="color:var(--text-muted)">Ctrl+S save &nbsp; Esc quit</span>` +
      `</div>` +
      `</div>` +
      `<div class="ne-divider"></div>` +
      `<div class="ne-pane ne-preview-pane">` +
      `<div class="ne-preview md-render" id="nePreview">` +
      `<p style="color:var(--text-dim);font-style:italic">Preview will appear here…</p>` +
      `</div>` +
      `</div>` +
      `</div>`;

    document.body.appendChild(win);

    // Animate in
    afterLayout(() => {
      win.classList.add("ne-visible");
    });

    return win;
  }

  // ── Position the editor window ─────────────────────────
  function layoutEditor() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 8;

    if (vw <= Config.BREAKPOINT_MOBILE) {
      // Mobile: fullscreen
      _editorWin.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;`;
      return;
    }

    // Desktop / tablet: 85% viewport, centered
    const w = Math.min(Math.round(vw * 0.88), 1400);
    const h = Math.min(Math.round(vh * 0.88), 900);
    const l = Math.round((vw - w) / 2);
    const t = Math.round((vh - h) / 2);

    _editorWin.style.cssText = `position:fixed;left:${l}px;top:${t}px;width:${w}px;height:${h}px;`;

    // Shrink caller terminal to a small bottom strip
    if (_callerWin) {
      const STRIP_H = 160;
      _callerWin.style.cssText =
        `position:fixed;left:${GAP}px;bottom:${GAP}px;top:auto;` +
        `width:${w * 0.45}px;height:${STRIP_H}px;`;
    }
  }

  // ── Flash status badge ─────────────────────────────────
  function flashStatus(text, type) {
    if (!_statusEl) return;
    _statusEl.textContent = text;
    _statusEl.className = `ne-status-badge ne-status-${type}`;
  }

  // ── Update live preview ────────────────────────────────
  function updatePreview() {
    if (!_previewEl || !_textareaEl) return;
    const raw = _textareaEl.value;
    const wrapper = document.createElement("div");
    wrapper.className = "md-render";
    wrapper.innerHTML =
      typeof marked !== "undefined" ? marked.parse(raw) : `<pre>${esc(raw)}</pre>`;
    sanitiseHtml(wrapper);
    wrapper.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    _previewEl.innerHTML = "";
    _previewEl.appendChild(wrapper);
  }

  function schedulePreviewUpdate() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(updatePreview, 300);
  }

  // ── Save to Firebase (note mode) or GitHub (site mode) ─
  async function saveNote() {
    if (!_textareaEl) return;
    if (typeof Auth === "undefined" || !Auth.isAuthenticated()) {
      flashStatus("not authenticated!", "error");
      return;
    }

    flashStatus("saving…", "muted");

    const content = _textareaEl.value;

    // ── Site file mode: push plain Markdown directly to GitHub ──
    if (_mode === "site") {
      let res, data;
      try {
        res = await fetch(`${CF_BASE}/siteFileWrite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: Auth.getToken(),
            fileKey: _siteFileKey,
            content,
          }),
        });
        data = await res.json().catch(() => ({}));
      } catch (e) {
        flashStatus(`save failed: ${e.message}`, "error");
        return;
      }

      if (!res.ok) {
        flashStatus(`save failed: ${data.error || res.status}`, "error");
        return;
      }

      _savedContent = content;
      _dirty = false;
      flashStatus("saved ✓", "saved");
      return;
    }

    // ── Note mode: save to Firebase RTDB ────────────────────────
    // If both old and new are empty treat it as create (first save of empty note)
    const effectiveAction = _savedContent === "" ? "create" : "update";

    let res, data;
    try {
      res = await fetch(`${CF_BASE}/notesWrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: Auth.getToken(),
          action: effectiveAction,
          filename: _filename,
          content,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      flashStatus(`save failed: ${e.message}`, "error");
      return;
    }

    if (!res.ok) {
      flashStatus(`save failed: ${data.error || res.status}`, "error");
      return;
    }

    _savedContent = content;
    _dirty = false;
    flashStatus("saved ✓", "saved");
  }

  // ── Attempt quit ───────────────────────────────────────
  function attemptQuit() {
    if (_dirty) {
      // Show warning inside the editor via the status badge
      flashStatus("unsaved! type :q! to force quit", "dirty");
    } else {
      closeEditor();
    }
  }

  // ── Force quit ─────────────────────────────────────────
  function forceQuit() {
    _dirty = false;
    closeEditor();
  }

  // ── Close editor and restore layout ────────────────────
  function closeEditor() {
    if (!_editorWin) return;

    clearTimeout(_debounceTimer);

    // Remove beforeunload guard
    window.removeEventListener("beforeunload", _beforeUnloadHandler);

    // Fade out
    const win = _editorWin;
    win.classList.remove("ne-visible");
    win.classList.add("ne-closing");
    setTimeout(() => {
      if (win.parentNode) win.remove();
    }, 220);

    // Restore caller terminal position
    if (_callerWin) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw > Config.BREAKPOINT_MOBILE) {
        const w = Math.min(860, vw - 40);
        const h = Math.min(680, vh - 40);
        _callerWin.style.cssText =
          `position:fixed;left:${Math.round((vw - w) / 2)}px;top:${Math.round((vh - h) / 2)}px;` +
          `width:${w}px;height:${h}px;`;
      } else {
        _callerWin.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;`;
      }
    }

    // Reset state
    _active = false;
    _filename = null;
    _savedContent = "";
    _dirty = false;
    _editorWin = null;
    _textareaEl = null;
    _previewEl = null;
    _statusEl = null;
    _callerCtx = null;
    _callerWin = null;
    _mode = "note";
    _siteFileKey = null;
  }

  // ── beforeunload guard ─────────────────────────────────
  function _beforeUnloadHandler(e) {
    if (_dirty) e.preventDefault();
  }

  // ── Wire keyboard events on the textarea ───────────────
  function wireTextarea(textarea) {
    // Ctrl+S → save
    textarea.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveNote();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        attemptQuit();
        return;
      }
    });

    // Detect content changes → mark dirty / clean
    textarea.addEventListener("input", () => {
      if (!_dirty && textarea.value !== _savedContent) {
        _dirty = true;
        flashStatus("unsaved", "dirty");
      } else if (_dirty && textarea.value === _savedContent) {
        _dirty = false;
        flashStatus("saved ✓", "saved");
      }
      schedulePreviewUpdate();
    });

    // Red dot click → close (like macOS)
    const dotRed = _editorWin.querySelector("#neDotRed");
    if (dotRed) dotRed.addEventListener("click", () => attemptQuit());
  }

  // ══════════════════════════════════════════════════════
  // Public: open(filename, content, ctx, mode='note', siteFileKey=null)
  //   mode='note'  → Firebase RTDB note (default)
  //   mode='site'  → site content file (saved via siteFileWrite CF)
  //   siteFileKey  → fileKey sent to siteFileWrite (e.g. 'about', 'blog/post.md')
  // ══════════════════════════════════════════════════════
  function open(filename, content, ctx, mode = "note", siteFileKey = null) {
    if (_active) {
      if (ctx) ctx.appendLine("note: editor already open. Close it first (:q).", ["error"]);
      return;
    }

    _active = true;
    _filename = filename;
    _savedContent = content;
    _dirty = false;
    _callerCtx = ctx;
    _callerWin = ctx ? ctx.winEl : null;
    _mode = mode === "site" ? "site" : "note";
    _siteFileKey = siteFileKey || null;

    _editorWin = buildWindow(filename, _mode);
    _textareaEl = _editorWin.querySelector("#neTextarea");
    _previewEl = _editorWin.querySelector("#nePreview");
    _statusEl = _editorWin.querySelector("#neStatus");

    // Populate content
    _textareaEl.value = content;
    if (content) {
      flashStatus(_mode === "site" ? "site file" : "saved ✓", _mode === "site" ? "site" : "saved");
      updatePreview();
    } else {
      flashStatus(_mode === "site" ? "site file" : "new file", _mode === "site" ? "site" : "muted");
    }

    layoutEditor();
    wireTextarea(_textareaEl);

    // Guard unsaved changes on tab close
    window.addEventListener("beforeunload", _beforeUnloadHandler);

    // Focus textarea after animation
    setTimeout(() => _textareaEl.focus(), 300);
  }

  // ══════════════════════════════════════════════════════
  // Public: confirmDelete(filename, ctx)
  // ══════════════════════════════════════════════════════
  function confirmDelete(filename, ctx) {
    _pendingDelete = true;
    _deleteFilename = filename;
    _deleteCtx = ctx;

    ctx.appendHTML(
      `Delete <span style="color:var(--color-blue)">${esc(filename)}</span>? ` +
        `<span style="color:var(--color-green)">y</span>` +
        `<span style="color:var(--text-muted)"> / </span>` +
        `<span style="color:var(--color-red)">n</span>`,
      ["output-line"],
    );
    ctx.scrollBottom();
  }

  function hasPendingDelete() {
    return _pendingDelete;
  }

  async function resolveDelete(raw, ctx) {
    const answer = raw.trim().toLowerCase();

    if (answer !== "y" && answer !== "yes" && answer !== "n" && answer !== "no") {
      ctx.appendLine("Please type y (yes) or n (no).", ["muted"]);
      ctx.scrollBottom();
      return; // Stay pending
    }

    _pendingDelete = false;
    const filename = _deleteFilename;
    _deleteFilename = null;
    _deleteCtx = null;

    if (answer === "n" || answer === "no") {
      ctx.appendLine("Cancelled.", ["muted"]);
      ctx.scrollBottom();
      return;
    }

    // Perform delete
    let res, data;
    try {
      res = await fetch(`${CF_BASE}/notesWrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: Auth.getToken(),
          action: "delete",
          filename,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ctx.appendLine(`note rm: network error — ${e.message}`, ["error"]);
      ctx.scrollBottom();
      return;
    }

    if (!res.ok) {
      ctx.appendLine(`note rm: ${data.error || res.status}`, ["error"]);
    } else {
      ctx.appendHTML(
        `<span style="color:var(--color-green)">✓</span> Deleted ` +
          `<span style="color:var(--color-blue)">${esc(filename)}</span>`,
        ["output-line"],
      );
    }
    ctx.scrollBottom();
  }

  // ── Resize handler ─────────────────────────────────────
  window.addEventListener("resize", () => {
    if (_active && _editorWin) layoutEditor();
  });

  return {
    open,
    isActive: () => _active,
    confirmDelete,
    hasPendingDelete,
    resolveDelete,
  };
})();

App.NoteEditor = NoteEditor; // publish to App namespace

// ── EventBus registration ─────────────────────────────────────
App.EventBus.on("rawInput", ({ raw, ctx }) => {
  if (!NoteEditor.hasPendingDelete()) return false;
  NoteEditor.resolveDelete(raw, ctx);
  return true;
});
