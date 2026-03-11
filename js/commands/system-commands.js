/* ============================================================
   js/commands/system-commands.js — System commands
   Commands: help, clear, echo, reload, quit, whoami, history
   ============================================================ */

'use strict';

const SystemCommands = {

  // ── help ──────────────────────────────────────────────────
  help: {
    desc: 'List all available commands',
    usage: 'help',
    exec(args, path, ctx, { line, text, esc }) {
      const cmds = [
        ['help',      'Show this help message'],
        ['ls',        'List files in current or specified directory'],
        ['cd',        'Change directory  (cd .., cd ~, cd projects)'],
        ['cat',       'Read and display a file  (supports Markdown)'],
        ['pwd',       'Print current working directory'],
        ['whoami',    'Display name and intro'],
        ['clear',     'Clear the terminal'],
        ['open',      'Open external link  (github | linkedin | email)'],
        ['history',   'Show recent command history'],
        ['echo',      'Echo text back to the terminal'],
        ['grep',      'Search file contents  (grep <term>)'],
        ['theme',     'Switch color theme  (theme <name> | theme list)'],
        ['scanlines', 'Toggle CRT scanlines  (scanlines on | off)'],
        ['download',  'Download resume  (download resume)'],
        ['cowsay',    'ASCII cow says something wise'],
        ['quit',      'Close this terminal window'],
        ['init',      'Open portfolio overview panels  (init --stop to close)'],
        ['message',   'Send a message  (--name <you> for live chat, --stop to close)'],
      ];
      const lines = [
        line('<span class="hr">────────────────────────────────────</span>'),
        text('Available commands:', []),
        line('<span class="hr">────────────────────────────────────</span>'),
      ];
      cmds.forEach(([name, desc]) => {
        lines.push(line(
          `  <span class="cmd-name">${esc(name)}</span>` +
          `<span class="muted" style="color:var(--text-muted)"> — ${esc(desc)}</span>`
        ));
      });
      lines.push(line('<span class="hr">────────────────────────────────────</span>'));
      lines.push(text('Tip: Press Tab to autocomplete, ↑/↓ for history.', ['muted']));
      return { lines };
    },
  },

  // ── whoami ────────────────────────────────────────────────
  whoami: {
    desc: 'Display name and intro',
    usage: 'whoami',
    exec(args, path, ctx, { line, text }) {
      return {
        lines: [
          line('<span style="color:var(--color-blue);font-weight:700">hahahuy</span>'),
          text('Developer · Builder · Tinkerer', ['muted']),
          text('I build things for the web and beyond.', []),
          text('Type `cat about.txt` to learn more.', ['muted']),
        ],
      };
    },
  },

  // ── clear ─────────────────────────────────────────────────
  clear: {
    desc: 'Clear the terminal output',
    usage: 'clear',
    exec() {
      return { clear: true };
    },
  },

  // ── echo ──────────────────────────────────────────────────
  echo: {
    desc: 'Echo text to the terminal',
    usage: 'echo <text>',
    exec(args, path, ctx, { text }) {
      return { lines: [text(args.join(' ') || '')] };
    },
  },

  // ── reload ────────────────────────────────────────────────
  reload: {
    desc: 'Reload the page',
    usage: 'reload',
    exec(args, path, ctx, { text }) {
      setTimeout(() => window.location.reload(), 300);
      return { lines: [text('Reloading…', ['muted'])] };
    },
  },

  // ── quit ──────────────────────────────────────────────────
  quit: {
    desc: 'Close this terminal window',
    usage: 'quit',
    exec() {
      return { quit: true };
    },
  },

  // ── history ───────────────────────────────────────────────
  history: {
    desc: 'Show recent command history',
    usage: 'history',
    exec(args, path, ctx, { line, text, esc }) {
      const hist = App._firstTerminal?.commandHistory ?? [];
      if (hist.length === 0) {
        return { lines: [text('No commands in history yet.', ['muted'])] };
      }
      const limit    = 20;
      const slice    = hist.slice(0, limit);
      const shown    = slice.slice().reverse();
      const startNum = hist.length - slice.length + 1;
      const lines    = shown.map((cmd, i) => {
        const num = String(startNum + i).padStart(4, ' ');
        return line(`<span style="color:var(--text-muted)">${esc(num)}</span>  ${esc(cmd)}`);
      });
      return { lines };
    },
  },

};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.SystemCommands = SystemCommands;
