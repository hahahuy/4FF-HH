/* ============================================================
   js/commands/ui-commands.js — UI / presentation commands
   Commands: theme, scanlines, init, download, export, open
   ============================================================ */

'use strict';

const UiCommands = {

  // ── theme ─────────────────────────────────────────────────
  theme: {
    desc: 'Switch color theme  (theme <name> | theme list)',
    usage: 'theme <name>',
    exec(args, path, ctx, { line, text, esc }) {
      const THEMES = ['default', 'dracula', 'solarized', 'light'];
      const name   = (args[0] || '').toLowerCase();

      if (!name || name === 'list') {
        const current = document.documentElement.dataset.theme || 'default';
        return {
          lines: [
            text('Available themes:', []),
            ...THEMES.map(t =>
              line(
                `  <span class="${t === current ? 'cmd-name' : ''}" ` +
                `style="color:${t === current ? 'var(--color-green)' : 'var(--text-primary)'}">${esc(t)}</span>` +
                (t === current ? ' <span style="color:var(--text-muted)">(active)</span>' : '')
              )
            ),
            text('Usage: theme <name>', ['muted']),
          ],
        };
      }

      if (!THEMES.includes(name)) {
        return { error: `theme: unknown theme '${name}'. Run 'theme list' to see options.` };
      }

      if (name === 'default') {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = name;
      }

      try { localStorage.setItem(Config.STORAGE.THEME, name); } catch (e) {}

      return {
        lines: [
          line(`<span style="color:var(--color-green)">✓</span> Theme set to <span style="color:var(--color-blue)">${esc(name)}</span>`),
        ],
      };
    },
  },

  // ── scanlines ─────────────────────────────────────────────
  scanlines: {
    desc: 'Toggle CRT scanlines overlay  (scanlines on | off)',
    usage: 'scanlines [on|off]',
    exec(args, path, ctx, { line }) {
      const arg     = (args[0] || '').toLowerCase();
      const body    = document.body;
      const current = body.classList.contains('scanlines');

      let enable;
      if (arg === 'on')       enable = true;
      else if (arg === 'off') enable = false;
      else                    enable = !current;

      if (enable) {
        body.classList.add('scanlines');
        try { localStorage.setItem(Config.STORAGE.SCANLINES, '1'); } catch (e) {}
        return { lines: [line('<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">enabled</span>. Run <code>scanlines off</code> to disable.')] };
      } else {
        body.classList.remove('scanlines');
        try { localStorage.removeItem(Config.STORAGE.SCANLINES); } catch (e) {}
        return { lines: [line('<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">disabled</span>.')] };
      }
    },
  },

  // ── init ──────────────────────────────────────────────────
  init: {
    desc: 'Launch portfolio overview panels  (init --stop to close)',
    usage: 'init [--stop]',
    exec(args, path, ctx, { text }) {
      if (args[0] === '--stop') {
        if (!InitPanels.isActive()) {
          return { lines: [text('init: no panels are currently open.', ['muted'])] };
        }
        InitPanels.stop(ctx.winEl);
        return null;
      }
      if (InitPanels.isActive()) {
        return { lines: [text('init: panels already open. Type `init --stop` to close.', ['muted'])] };
      }
      InitPanels.start(ctx.winEl);
      return null;
    },
  },

  // ── download ──────────────────────────────────────────────
  download: {
    desc: 'Download a file  (download resume)',
    usage: 'download <file>',
    exec(args, path, ctx, { line, text }) {
      const target = (args[0] || '').toLowerCase();

      if (!target) {
        return {
          lines: [
            text('Usage: download <file>', ['muted']),
            text('Available: resume', ['muted']),
          ],
        };
      }

      if (target === 'resume' || target === 'resume.pdf' || target === 'cv') {
        const a = document.createElement('a');
        a.href     = Config.CONTENT_BASE + '/content/resume.pdf';
        a.download = 'resume.pdf';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1000);
        return {
          lines: [
            line('<span style="color:var(--color-green)">↓</span> Downloading <span style="color:var(--color-blue)">resume.pdf</span>…'),
          ],
        };
      }

      return { error: `download: '${target}' not available. Try: resume` };
    },
  },

  // ── export ────────────────────────────────────────────────
  export: {
    desc: 'Download this session as a .txt file',
    usage: 'export',
    exec(args, path, ctx, { line }) {
      const outputEl = ctx.winEl.querySelector('.output');
      if (!outputEl) return { error: 'export: could not find output element' };
      const content = outputEl.innerText || '';
      const date    = new Date().toISOString().slice(0, 10);
      const blob    = new Blob([content], { type: 'text/plain' });
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = url;
      a.download    = `session-${date}.txt`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      return {
        lines: [line('<span style="color:var(--color-green)">↓</span> Session exported as <span style="color:var(--color-blue)">session-' + date + '.txt</span>')],
      };
    },
  },

  // ── open ──────────────────────────────────────────────────
  open: {
    desc: 'Open external link (github | linkedin | email)',
    usage: 'open <alias>',
    exec(args, path, ctx, { text, esc }) {
      // SECURITY BOUNDARY: Only add https:// or mailto: URLs to this object.
      const LINKS = {
        github:   'https://github.com/hahahuy',
        linkedin: 'https://www.linkedin.com/in/haqhuy',
        email:    'mailto:quanghuyha098@gmail.com',
      };

      const alias = (args[0] || '').toLowerCase();
      if (!alias) {
        return {
          lines: [
            text('Usage: open <alias>', ['muted']),
            text(`Available: ${Object.keys(LINKS).join('  |  ')}`, ['muted']),
          ],
        };
      }
      if (!LINKS[alias]) {
        return { error: `open: unknown alias '${alias}'. Try: ${Object.keys(LINKS).join(', ')}` };
      }
      const url = LINKS[alias];
      // SEC-7: Runtime guard — block non-https/mailto even if LINKS is modified
      if (!url.startsWith('https://') && !url.startsWith('mailto:')) {
        return { error: `open: blocked — only https:// and mailto: links are allowed` };
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return { lines: [text(`Opening ${alias}…`, ['success'])] };
    },
  },

};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.UiCommands = UiCommands;
