(() => {
  // ── Shared helper factories ───────────────────────────────
  function _line(html, classes = []) {
    return { html, classes: ["output-line", ...classes] };
  }
  function _text(str, classes = []) {
    return _line(escHtml(str), classes);
  }
  function _esc(str) {
    return escHtml(str);
  }

  const _helpers = { line: _line, text: _text, esc: _esc };

  // ── Assemble registry ─────────────────────────────────────
  // Each domain object uses exec(args, path, ctx, helpers, registry).
  // Wrap each exec so callers in the old signature still work.
  const _raw = {
    ...FsCommands,
    ...SystemCommands,
    ...UiCommands,
    ...SocialCommands,
    ...OwnerCommands,
    ...EasterEggs,
  };

  // We need a forward reference to the final registry for neofetch.
  // Build a proxy object once, filled after _registry is built.
  const _registry = {};

  for (const [name, entry] of Object.entries(_raw)) {
    _registry[name] = {
      desc: entry.desc,
      /** @param {any[]} args @param {string[]} path @param {any} ctx */
      exec(args, path, ctx) {
        // @ts-ignore — internal exec receives helpers+registry as extra args
        return entry.exec(args, path, ctx, _helpers, _registry);
      },
    };
  }

  // ── Public API ────────────────────────────────────────────
  App.Commands = {
    execute(cmd, args, path, ctx = {}) {
      if (!cmd) return null;
      const entry = _registry[cmd.toLowerCase()];
      if (!entry) {
        return {
          lines: [
            _text(`${cmd}: command not found`, ["error"]),
            _text("Type `help` for available commands.", ["muted"]),
          ],
        };
      }

      // Easter egg handled directly in terminal.js for the sudo phrase
      return entry.exec(args, path, ctx);
    },

    names() {
      return Object.keys(_registry);
    },
  };

  // Backward-compat alias — removed after Phase 5
  const Commands = App.Commands;
  // Export to globalThis for modules loaded via new Function(src)()
  globalThis.Commands = Commands;
})();
