/* ============================================================
   note-editor.js — NoteEditor singleton
   Split-pane Markdown editor for private notes stored in
   Firebase RTDB via Cloud Functions.

   Commands wired via commands.js:
     note add <file>.md  — create & open empty note
     note cat <file>.md  — fetch & open existing note
     note rm  <file>.md  — delete (with confirm)
     deploy   <filepath> — push note to GitHub repo

   Vim keybindings inside textarea:
     :w    — save
     :q    — quit (prompts if unsaved)
     :q!   — force quit
     :wq   — save then quit
     Ctrl+S — save
     Esc    — attempt quit
   ============================================================ */

'use strict';

const NoteEditor = (() => {

  // ── Cloud Functions base URL ───────────────────────────
  const CF_BASE       = 'https://asia-southeast1-hahuy-portfolio-f7f16.cloudfunctions.net';
  const GITHUB_OWNER  = 'hahahuy';
  const GITHUB_REPO   = '4FF-HH';

  // ── Editor state ──────────────────────────────────────
  let _active        = false;
  let _filename      = null;
  let _savedContent  = '';     // Last content saved to Firebase
  let _dirty         = false;  // Unsaved changes?
  let _editorWin     = null;   // The .terminal-window DOM element
  let _textareaEl    = null;   // The <textarea>
  let _previewEl     = null;   // The preview <div>
  let _statusEl      = null;   // Status badge in titlebar
  let _debounceTimer = null;
  let _callerCtx     = null;   // Terminal ctx for messages
  let _callerWin     = null;   // Terminal winEl for layout

  // ── Delete confirm state ───────────────────────────────
  let _pendingDelete   = false;
  let _deleteFilename  = null;
  let _deleteCtx       = null;

  // ── Deploy state ───────────────────────────────────────
  let _pendingDeploy   = false;
  let _deployFilepath  = null;
  let _deployStep      = null;   // 'pat' | 'confirm'
  let _githubPAT       = null;   // In memory only — cleared after use
  let _deployCtx       = null;

  // ── HTML escaper (duplicated from terminal.js — not exported globally) ──
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── HTML sanitiser (duplicated from terminal.js — not exported globally) ─
  function sanitiseHtml(el) {
    el.querySelectorAll('script,iframe,object,embed,form').forEach(n => n.remove());
    el.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) n.removeAttribute(attr.name);
        if (attr.name === 'href'   && /^javascript:/i.test(attr.value)) n.removeAttribute(attr.name);
        if (attr.name === 'action' && /^javascript:/i.test(attr.value)) n.removeAttribute(attr.name);
      });
    });
  }

  // ── Build the editor window DOM ───────────────────────
  function buildWindow(filename) {
    const win = document.createElement('div');
    win.className = 'terminal-window note-editor-window';

    win.innerHTML =
      `<div class="titlebar ne-titlebar">` +
        `<span class="dot dot-red" id="neDotRed"></span>` +
        `<span class="dot dot-yellow"></span>` +
        `<span class="dot dot-green"></span>` +
        `<span class="ne-titlebar-filename">notes/${esc(filename)}</span>` +
        `<span class="ne-status-badge ne-status-muted" id="neStatus">new file</span>` +
      `</div>` +
      `<div class="ne-body">` +
        `<div class="ne-pane ne-editor-pane">` +
          `<textarea class="ne-textarea" id="neTextarea" ` +
            `autocomplete="off" autocorrect="off" ` +
            `autocapitalize="off" spellcheck="false" ` +
            `placeholder="Start writing Markdown…"></textarea>` +
          `<div class="ne-editor-hint">` +
            `<span style="color:var(--color-green)">:w</span> save &nbsp;` +
            `<span style="color:var(--color-red)">:q</span> quit &nbsp;` +
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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      win.classList.add('ne-visible');
    }));

    return win;
  }

  // ── Position the editor window ─────────────────────────
  function layoutEditor() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 8;

    if (vw <= 600) {
      // Mobile: fullscreen
      _editorWin.style.cssText =
        `left:0;top:0;width:${vw}px;height:${vh}px;`;
      return;
    }

    // Desktop / tablet: 85% viewport, centered
    const w = Math.min(Math.round(vw * 0.88), 1400);
    const h = Math.min(Math.round(vh * 0.88), 900);
    const l = Math.round((vw - w) / 2);
    const t = Math.round((vh - h) / 2);

    _editorWin.style.cssText =
      `left:${l}px;top:${t}px;width:${w}px;height:${h}px;`;

    // Shrink caller terminal to a small bottom strip
    if (_callerWin) {
      const STRIP_H = 160;
      _callerWin.style.cssText =
        `left:${GAP}px;bottom:${GAP}px;top:auto;` +
        `width:${w * 0.45}px;height:${STRIP_H}px;`;
    }
  }

  // ── Flash status badge ─────────────────────────────────
  function flashStatus(text, type) {
    if (!_statusEl) return;
    _statusEl.textContent = text;
    _statusEl.className   = `ne-status-badge ne-status-${type}`;
  }

  // ── Update live preview ────────────────────────────────
  function updatePreview() {
    if (!_previewEl || !_textareaEl) return;
    const raw     = _textareaEl.value;
    const wrapper = document.createElement('div');
    wrapper.className = 'md-render';
    wrapper.innerHTML = (typeof marked !== 'undefined')
      ? marked.parse(raw)
      : `<pre>${esc(raw)}</pre>`;
    sanitiseHtml(wrapper);
    wrapper.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    });
    _previewEl.innerHTML = '';
    _previewEl.appendChild(wrapper);
  }

  function schedulePreviewUpdate() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(updatePreview, 300);
  }

  // ── Save to Firebase ───────────────────────────────────
  async function saveNote() {
    if (!_textareaEl) return;
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
      flashStatus('not authenticated!', 'error');
      return;
    }

    flashStatus('saving…', 'muted');

    const content = _textareaEl.value;
    const action  = _savedContent === '' && content !== '' ? 'create' : 'update';
    // If both old and new are empty treat it as create (first save of empty note)
    const effectiveAction = _savedContent === '' ? 'create' : 'update';

    let res, data;
    try {
      res  = await fetch(`${CF_BASE}/notesWrite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          token:    Auth.getToken(),
          action:   effectiveAction,
          filename: _filename,
          content,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      flashStatus(`save failed: ${e.message}`, 'error');
      return;
    }

    if (!res.ok) {
      flashStatus(`save failed: ${data.error || res.status}`, 'error');
      return;
    }

    _savedContent = content;
    _dirty        = false;
    flashStatus('saved ✓', 'saved');
  }

  // ── Remove last line (for vim command detection) ────────
  function removeLastLine(str) {
    const idx = str.lastIndexOf('\n');
    return idx === -1 ? '' : str.slice(0, idx + 1);
  }

  // ── Attempt quit ───────────────────────────────────────
  function attemptQuit() {
    if (_dirty) {
      // Show warning inside the editor via the status badge
      flashStatus('unsaved! type :q! to force quit', 'dirty');
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
    window.removeEventListener('beforeunload', _beforeUnloadHandler);

    // Fade out
    const win = _editorWin;
    win.classList.remove('ne-visible');
    win.classList.add('ne-closing');
    setTimeout(() => { if (win.parentNode) win.remove(); }, 220);

    // Restore caller terminal position
    if (_callerWin) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw > 600) {
        const w = Math.min(860, vw - 40);
        const h = Math.min(680, vh - 40);
        _callerWin.style.cssText =
          `left:${Math.round((vw - w) / 2)}px;top:${Math.round((vh - h) / 2)}px;` +
          `width:${w}px;height:${h}px;`;
      } else {
        _callerWin.style.cssText = `left:0;top:0;width:${vw}px;height:${vh}px;`;
      }
    }

    // Reset state
    _active       = false;
    _filename     = null;
    _savedContent = '';
    _dirty        = false;
    _editorWin    = null;
    _textareaEl   = null;
    _previewEl    = null;
    _statusEl     = null;
    _callerCtx    = null;
    _callerWin    = null;
  }

  // ── beforeunload guard ─────────────────────────────────
  function _beforeUnloadHandler(e) {
    if (_dirty) e.preventDefault();
  }

  // ── Wire keyboard events on the textarea ───────────────
  function wireTextarea(textarea) {
    // Ctrl+S → save
    textarea.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveNote(); return; }
      if (e.key === 'Escape')         { e.preventDefault(); attemptQuit(); return; }
    });

    // Detect vim-style :w :q :q! :wq at end of textarea
    textarea.addEventListener('input', () => {
      const val      = textarea.value;
      const lastLine = val.split('\n').pop();

      if (lastLine === ':w') {
        textarea.value = removeLastLine(val);
        saveNote();
      } else if (lastLine === ':q!') {
        textarea.value = removeLastLine(val);
        forceQuit();
      } else if (lastLine === ':q') {
        textarea.value = removeLastLine(val);
        attemptQuit();
      } else if (lastLine === ':wq') {
        textarea.value = removeLastLine(val);
        saveNote().then(() => closeEditor());
      } else {
        // Regular edit — mark dirty
        if (!_dirty && textarea.value !== _savedContent) {
          _dirty = true;
          flashStatus('unsaved', 'dirty');
        } else if (_dirty && textarea.value === _savedContent) {
          _dirty = false;
          flashStatus('saved ✓', 'saved');
        }
        schedulePreviewUpdate();
      }
    });

    // Red dot click → close (like macOS)
    const dotRed = _editorWin.querySelector('#neDotRed');
    if (dotRed) dotRed.addEventListener('click', () => attemptQuit());
  }

  // ══════════════════════════════════════════════════════
  // Public: open(filename, content, ctx)
  // ══════════════════════════════════════════════════════
  function open(filename, content, ctx) {
    if (_active) {
      if (ctx) ctx.appendLine('note: editor already open. Close it first (:q).', ['error']);
      return;
    }

    _active       = true;
    _filename     = filename;
    _savedContent = content;
    _dirty        = false;
    _callerCtx    = ctx;
    _callerWin    = ctx ? ctx.winEl : null;

    _editorWin = buildWindow(filename);
    _textareaEl = _editorWin.querySelector('#neTextarea');
    _previewEl  = _editorWin.querySelector('#nePreview');
    _statusEl   = _editorWin.querySelector('#neStatus');

    // Populate content
    _textareaEl.value = content;
    if (content) {
      flashStatus('saved ✓', 'saved');
      updatePreview();
    } else {
      flashStatus('new file', 'muted');
    }

    layoutEditor();
    wireTextarea(_textareaEl);

    // Guard unsaved changes on tab close
    window.addEventListener('beforeunload', _beforeUnloadHandler);

    // Focus textarea after animation
    setTimeout(() => _textareaEl.focus(), 300);
  }

  // ══════════════════════════════════════════════════════
  // Public: confirmDelete(filename, ctx)
  // ══════════════════════════════════════════════════════
  function confirmDelete(filename, ctx) {
    _pendingDelete  = true;
    _deleteFilename = filename;
    _deleteCtx      = ctx;

    ctx.appendHTML(
      `Delete <span style="color:var(--color-blue)">${esc(filename)}</span>? ` +
      `<span style="color:var(--color-green)">y</span>` +
      `<span style="color:var(--text-muted)"> / </span>` +
      `<span style="color:var(--color-red)">n</span>`,
      ['output-line']
    );
    ctx.scrollBottom();
  }

  function hasPendingDelete() {
    return _pendingDelete;
  }

  async function resolveDelete(raw, ctx) {
    const answer = raw.trim().toLowerCase();

    if (answer !== 'y' && answer !== 'yes' && answer !== 'n' && answer !== 'no') {
      ctx.appendLine('Please type y (yes) or n (no).', ['muted']);
      ctx.scrollBottom();
      return;  // Stay pending
    }

    _pendingDelete = false;
    const filename = _deleteFilename;
    _deleteFilename = null;
    _deleteCtx      = null;

    if (answer === 'n' || answer === 'no') {
      ctx.appendLine('Cancelled.', ['muted']);
      ctx.scrollBottom();
      return;
    }

    // Perform delete
    let res, data;
    try {
      res  = await fetch(`${CF_BASE}/notesWrite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          token:    Auth.getToken(),
          action:   'delete',
          filename,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      ctx.appendLine(`note rm: network error — ${e.message}`, ['error']);
      ctx.scrollBottom();
      return;
    }

    if (!res.ok) {
      ctx.appendLine(`note rm: ${data.error || res.status}`, ['error']);
    } else {
      ctx.appendHTML(
        `<span style="color:var(--color-green)">✓</span> Deleted ` +
        `<span style="color:var(--color-blue)">${esc(filename)}</span>`,
        ['output-line']
      );
    }
    ctx.scrollBottom();
  }

  // ══════════════════════════════════════════════════════
  // Public: startDeploy(filepath, ctx)
  // ══════════════════════════════════════════════════════
  function startDeploy(filepath, ctx) {
    _pendingDeploy  = true;
    _deployFilepath = filepath;
    _deployStep     = 'pat';
    _githubPAT      = null;
    _deployCtx      = ctx;

    ctx.appendHTML(
      `<span style="color:var(--color-orange)">Enter GitHub PAT</span> ` +
      `<span style="color:var(--text-muted)">(classic token, ` +
      `<code>repo</code> scope — not stored):</span>`,
      ['output-line']
    );
    ctx.scrollBottom();
  }

  function hasPendingDeploy() {
    return _pendingDeploy;
  }

  async function resolveDeploy(raw, ctx) {
    const input = raw.trim();

    // ── Step 1: receive PAT ────────────────────────────────
    if (_deployStep === 'pat') {
      if (!input) {
        ctx.appendLine('deploy: PAT cannot be empty. Cancelled.', ['muted']);
        _pendingDeploy = false; _deployFilepath = null; _deployStep = null;
        ctx.scrollBottom();
        return;
      }
      _githubPAT  = input;
      _deployStep = 'confirm';

      ctx.appendHTML(
        `Deploy <span style="color:var(--color-blue)">${esc(_deployFilepath)}</span> to GitHub repo? ` +
        `<span style="color:var(--color-green)">y</span>` +
        `<span style="color:var(--text-muted)"> / </span>` +
        `<span style="color:var(--color-red)">n</span>`,
        ['output-line']
      );
      ctx.appendHTML(
        `<span style="color:var(--text-muted)">Tip: run </span>` +
        `<span style="color:var(--color-blue)">Ctrl+L</span>` +
        `<span style="color:var(--text-muted)"> after deploy to clear the PAT from terminal output.</span>`,
        ['output-line']
      );
      ctx.scrollBottom();
      return;
    }

    // ── Step 2: confirm ────────────────────────────────────
    if (_deployStep === 'confirm') {
      if (input.toLowerCase() !== 'y' && input.toLowerCase() !== 'yes') {
        ctx.appendLine('Cancelled.', ['muted']);
        _pendingDeploy = false; _deployFilepath = null; _deployStep = null; _githubPAT = null;
        ctx.scrollBottom();
        return;
      }

      ctx.appendLine('Fetching note content…', ['muted']);
      ctx.scrollBottom();

      const filepath = _deployFilepath;
      const pat      = _githubPAT;

      // Clear immediately — don't keep PAT in memory longer than needed
      _pendingDeploy = false; _deployFilepath = null; _deployStep = null; _githubPAT = null;

      // Derive note filename from the filepath (last path segment)
      const noteFilename = filepath.split('/').pop();

      let noteContent;
      try {
        const noteRes  = await fetch(`${CF_BASE}/notesRead`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: Auth.getToken(), filename: noteFilename }),
        });
        const noteData = await noteRes.json();
        if (!noteRes.ok) throw new Error(noteData.error || noteRes.status);
        noteContent = noteData.note.content;
      } catch (e) {
        ctx.appendLine(`deploy: failed to read note — ${e.message}`, ['error']);
        ctx.scrollBottom();
        return;
      }

      ctx.appendLine('Checking GitHub for existing file…', ['muted']);
      ctx.scrollBottom();

      let sha = null;
      try {
        const getRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`,
          { headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github+json' } }
        );
        if (getRes.ok) {
          const existing = await getRes.json();
          sha = existing.sha || null;
        } else if (getRes.status !== 404) {
          throw new Error(`GitHub API returned ${getRes.status}`);
        }
      } catch (e) {
        ctx.appendLine(`deploy: GitHub API error — ${e.message}`, ['error']);
        ctx.scrollBottom();
        return;
      }

      // Double-encode: first pass obfuscates the content stored on GitHub
      // (people browsing the repo see base64 gibberish, not plain Markdown)
      // Second pass is the GitHub API's required base64 transport encoding.
      const obfuscated = btoa(unescape(encodeURIComponent(noteContent))); // stored on GitHub
      const encoded    = btoa(obfuscated);                                 // GitHub API transport

      const putBody = {
        message: `notes: update ${filepath}`,
        content: encoded,
        ...(sha ? { sha } : {}),
      };

      ctx.appendLine('Pushing to GitHub…', ['muted']);
      ctx.scrollBottom();

      try {
        const putRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`,
          {
            method:  'PUT',
            headers: {
              'Authorization': `Bearer ${pat}`,
              'Accept':        'application/vnd.github+json',
              'Content-Type':  'application/json',
            },
            body: JSON.stringify(putBody),
          }
        );
        const putData = await putRes.json().catch(() => ({}));
        if (!putRes.ok) throw new Error(putData.message || `HTTP ${putRes.status}`);

        const commitUrl = putData.commit && putData.commit.html_url ? putData.commit.html_url : '';
        ctx.appendHTML(
          `<span style="color:var(--color-green)">✓</span> Pushed to GitHub.<br>` +
          (commitUrl
            ? `<span style="color:var(--text-muted)">Commit: </span>` +
              `<a href="${esc(commitUrl)}" target="_blank" rel="noopener noreferrer" ` +
              `style="color:var(--color-blue)">${esc(commitUrl)}</a><br>`
            : '') +
          `<span style="color:var(--text-muted)">GitHub Actions will deploy automatically. ` +
          `Run <strong>Ctrl+L</strong> to clear terminal output.</span>`,
          ['output-line']
        );
      } catch (e) {
        ctx.appendLine(`deploy: push failed — ${e.message}`, ['error']);
      }
      ctx.scrollBottom();
    }
  }

  // ── Resize handler ─────────────────────────────────────
  window.addEventListener('resize', () => {
    if (_active && _editorWin) layoutEditor();
  });

  return {
    open,
    isActive:         () => _active,
    confirmDelete,
    hasPendingDelete,
    resolveDelete,
    startDeploy,
    hasPendingDeploy,
    resolveDeploy,
  };

})();
