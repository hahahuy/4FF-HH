/* ============================================================
   commands.js — Factory: CommandsFactory.createCommandExecutor(terminal)
   ============================================================ */

'use strict';

const CommandsFactory = (() => {

  // ── External links ─────────────────────────────────────────
  const LINKS = {
    github:   'https://github.com/hahahuy',
    linkedin: 'https://linkedin.com/in/hahahuy',
    email:    'mailto:hahahuy@example.com',
  };

  // ── Shared helpers ─────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function line(html, classes = []) {
    return { html, classes: ['output-line', ...classes] };
  }

  function text(str, classes = []) {
    return line(esc(str), classes);
  }

  // ── Command definitions (shared, stateless) ────────────────
  // Each exec receives (term, args) — term is per-window instance
  const commandDefs = {

    help: {
      desc: 'List all available commands',
      exec(term, args) {
        const cmds = [
          ['help',    'Show this help message'],
          ['ls',      'List files in current or specified directory'],
          ['cd',      'Change directory  (cd .., cd ~, cd projects)'],
          ['cat',     'Read and display a file  (supports Markdown)'],
          ['pwd',     'Print current working directory'],
          ['whoami',  'Display name and intro'],
          ['clear',   'Clear the terminal'],
          ['open',    'Open external link  (github | linkedin | email)'],
          ['history', 'Show recent command history'],
          ['echo',    'Echo text back to the terminal'],
          ['init',    'Spawn 4 terminal windows in 2×2 grid'],
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

    ls: {
      desc: 'List directory contents',
      exec(term, args) {
        const target   = args[0] || null;
        const resolved = fsResolve(term.currentPath, target);

        if (!resolved) {
          return { error: `ls: ${target}: No such file or directory` };
        }

        const { node } = resolved;

        if (node.__type === 'file') {
          return { lines: [text(args[0], ['ls-file'])] };
        }

        const entries = fsListDir(node);
        if (entries.length === 0) {
          return { lines: [text('(empty directory)', ['muted'])] };
        }

        let gridHtml = '<div class="ls-grid">';
        entries.forEach(e => {
          const cls    = e.type === 'dir' ? 'ls-dir' : 'ls-file';
          const suffix = e.type === 'dir' ? '/' : '';
          gridHtml += `<span class="ls-item ${cls}">${esc(e.name)}${suffix}</span>`;
        });
        gridHtml += '</div>';
        return { lines: [{ html: gridHtml, classes: [] }] };
      },
    },

    cd: {
      desc: 'Change directory',
      exec(term, args) {
        const target   = args[0] || '~';
        const resolved = fsResolve(term.currentPath, target);

        if (!resolved) {
          return { error: `cd: ${target}: No such file or directory` };
        }
        if (resolved.node.__type === 'file') {
          return { error: `cd: ${target}: Not a directory` };
        }

        return { newPath: resolved.path };
      },
    },

    cat: {
      desc: 'Display file contents (Markdown rendered)',
      exec(term, args) {
        if (!args[0]) {
          return { error: 'cat: missing file argument' };
        }

        const resolved = fsResolve(term.currentPath, args[0]);
        if (!resolved) {
          return { error: `cat: ${args[0]}: No such file or directory` };
        }
        if (resolved.node.__type === 'dir') {
          return { error: `cat: ${args[0]}: Is a directory` };
        }

        fsReadFile(resolved.node)
          .then(content => {
            term.appendMarkdown(content);
            term.scrollBottom();
          })
          .catch(err => {
            term.appendLine(`cat: error reading file — ${err.message}`, ['error']);
          });

        return { lines: [text('Loading…', ['muted'])] };
      },
    },

    whoami: {
      desc: 'Display name and intro',
      exec(term, args) {
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

    pwd: {
      desc: 'Print working directory',
      exec(term, args) {
        return { lines: [text(term.currentPath.join('/'), ['success'])] };
      },
    },

    clear: {
      desc: 'Clear the terminal output',
      exec(term, args) {
        return { clear: true };
      },
    },

    open: {
      desc: 'Open external link (github | linkedin | email)',
      exec(term, args) {
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
        window.open(LINKS[alias], '_blank', 'noopener,noreferrer');
        return { lines: [text(`Opening ${alias}…`, ['success'])] };
      },
    },

    history: {
      desc: 'Show recent command history',
      exec(term, args) {
        const hist = term.commandHistory;
        if (hist.length === 0) {
          return { lines: [text('No commands in history yet.', ['muted'])] };
        }
        const limit = 20;
        const shown = hist.slice(0, limit).reverse();
        const lines = shown.map((cmd, i) => {
          const num = String(hist.length - shown.length + i + 1).padStart(4, ' ');
          return line(`<span style="color:var(--text-muted)">${esc(num)}</span>  ${esc(cmd)}`);
        });
        return { lines };
      },
    },

    echo: {
      desc: 'Echo text to the terminal',
      exec(term, args) {
        return { lines: [text(args.join(' ') || '')] };
      },
    },

    init: {
      desc: 'Spawn 4 terminal windows in 2×2 grid',
      exec(term, args) {
        // Defer so the current command output renders first
        setTimeout(() => WindowManager.spawnQuad(), 50);
        return { lines: [text('Spawning quad layout…', ['muted'])] };
      },
    },

  };

  // ── Unknown command handler ───────────────────────────────
  function unknown(cmd) {
    return {
      lines: [
        text(`${cmd}: command not found`, ['error']),
        text('Type `help` for available commands.', ['muted']),
      ],
    };
  }

  /**
   * Create a command executor bound to a specific terminal instance.
   * @param {object} terminal — TerminalFactory instance
   * @returns {{ execute(rawInput): void, names: string[] }}
   */
  function createCommandExecutor(terminal) {

    function execute(rawInput) {
      const raw   = (rawInput || '').trim();
      if (!raw) return;

      // Easter egg
      if (raw.toLowerCase() === 'sudo make me a coffee') {
        terminal.appendLine("☕  Brewing... jk, I'm a website. But I appreciate the request.", ['success']);
        terminal.appendLine('    Try `open github` to see real projects instead.', ['muted']);
        return;
      }

      const parts = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const cmd   = (parts[0] || '').toLowerCase();
      const args  = parts.slice(1).map(a => a.replace(/^['"]|['"]$/g, ''));

      const def = commandDefs[cmd];
      const result = def ? def.exec(terminal, args) : unknown(cmd);

      if (result) {
        if (result.newPath)  terminal.currentPath = result.newPath;
        if (result.clear)    terminal.clearOutput();
        if (result.lines)    result.lines.forEach(l => terminal.appendHTML(l.html || '', l.classes || []));
        if (result.markdown) terminal.appendMarkdown(result.markdown);
        if (result.error)    terminal.appendLine(result.error, ['error']);
      }

      terminal.updatePrompt();
      terminal.scrollBottom();
    }

    const names = Object.keys(commandDefs);

    return { execute, names };
  }

  return { createCommandExecutor };

})();
