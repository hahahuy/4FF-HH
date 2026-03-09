/* ============================================================
   commands.js — Command Registry
   ============================================================ */

'use strict';

const Commands = (() => {

  // ── External links for `open` ──────────────────────────────
  const LINKS = {
    github:   'https://github.com/hahahuy',
    linkedin: 'https://linkedin.com/in/hahahuy',
    email:    'mailto:hahahuy@example.com',  // update to real email
  };

  // ── Helper: build an HTML line object ─────────────────────
  function line(html, classes = []) {
    return { html, classes: ['output-line', ...classes] };
  }

  function text(str, classes = []) {
    return line(esc(str), classes);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Command implementations ────────────────────────────────

  const registry = {

    // ── help ──────────────────────────────────────────────────
    help: {
      desc: 'List all available commands',
      usage: 'help',
      exec(args, path) {
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

    // ── ls ────────────────────────────────────────────────────
    ls: {
      desc: 'List directory contents',
      usage: 'ls [dir]',
      exec(args, path) {
        const target   = args[0] || null;
        const resolved = fsResolve(path, target);

        if (!resolved) {
          return { error: `ls: ${target}: No such file or directory` };
        }

        const { node, path: resolvedPath } = resolved;

        if (node.__type === 'file') {
          // ls on a file just shows the filename — clicking cats it
          const cmd = `cat ${args[0]}`;
          return { lines: [line(
            `<span class="ls-item ls-file" data-cmd="${esc(cmd)}" title="click to run: ${esc(cmd)}">${esc(args[0])}</span>`
          )] };
        }

        const entries = fsListDir(node);
        if (entries.length === 0) {
          return { lines: [text('(empty directory)', ['muted'])] };
        }

        // Build grid HTML — each item carries a data-cmd for click-to-run
        let gridHtml = '<div class="ls-grid">';
        entries.forEach(e => {
          const isDir   = e.type === 'dir';
          const cls     = isDir ? 'ls-dir' : 'ls-file';
          const suffix  = isDir ? '/' : '';
          // Determine what command clicking should run
          const dirStr  = resolvedPath.join('/'); // e.g. "~/blog"
          let cmd;
          if (isDir) {
            // cd into the dir using path relative to resolvedPath
            const relBase = target ? `${target}/${e.name}` : e.name;
            cmd = `cd ${relBase}`;
          } else {
            const relBase = target ? `${target}/${e.name}` : e.name;
            cmd = `cat ${relBase}`;
          }
          gridHtml +=
            `<span class="ls-item ${cls}" data-cmd="${esc(cmd)}" title="click to run: ${esc(cmd)}">${esc(e.name)}${suffix}</span>`;
        });
        gridHtml += '</div>';
        return { lines: [{ html: gridHtml, classes: [] }] };
      },
    },

    // ── cd ────────────────────────────────────────────────────
    cd: {
      desc: 'Change directory',
      usage: 'cd <dir>',
      exec(args, path) {
        const target = args[0] || '~';
        const resolved = fsResolve(path, target);

        if (!resolved) {
          return { error: `cd: ${target}: No such file or directory` };
        }
        if (resolved.node.__type === 'file') {
          return { error: `cd: ${target}: Not a directory` };
        }

        return { newPath: resolved.path };
      },
    },

    // ── cat ───────────────────────────────────────────────────
    cat: {
      desc: 'Display file contents (Markdown rendered)',
      usage: 'cat <file>',
      exec(args, path) {
        if (!args[0]) {
          return { error: 'cat: missing file argument' };
        }

        const resolved = fsResolve(path, args[0]);
        if (!resolved) {
          return { error: `cat: ${args[0]}: No such file or directory` };
        }
        if (resolved.node.__type === 'dir') {
          return { error: `cat: ${args[0]}: Is a directory` };
        }

        // Async: fetch and render
        fsReadFile(resolved.node)
          .then(content => {
            Terminal.appendMarkdown(content);
            Terminal.scrollBottom();
          })
          .catch(err => {
            Terminal.appendLine(`cat: error reading file — ${err.message}`, ['error']);
          });

        // Return loading indicator immediately
        return {
          lines: [text('Loading…', ['muted'])],
        };
      },
    },

    // ── whoami ────────────────────────────────────────────────
    whoami: {
      desc: 'Display name and intro',
      usage: 'whoami',
      exec(args, path) {
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

    // ── pwd ───────────────────────────────────────────────────
    pwd: {
      desc: 'Print working directory',
      usage: 'pwd',
      exec(args, path) {
        const fullPath = path.join('/');
        return { lines: [text(fullPath, ['success'])] };
      },
    },

    // ── clear ─────────────────────────────────────────────────
    clear: {
      desc: 'Clear the terminal output',
      usage: 'clear',
      exec(args, path) {
        return { clear: true };
      },
    },

    // ── open ──────────────────────────────────────────────────
    open: {
      desc: 'Open external link (github | linkedin | email)',
      usage: 'open <alias>',
      exec(args, path) {
        const alias = (args[0] || '').toLowerCase();
        if (!alias) {
          const available = Object.keys(LINKS).join('  |  ');
          return {
            lines: [
              text('Usage: open <alias>', ['muted']),
              text(`Available: ${available}`, ['muted']),
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

    // ── history ───────────────────────────────────────────────
    history: {
      desc: 'Show recent command history',
      usage: 'history',
      exec(args, path) {
        const hist = Terminal.commandHistory;
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

    // ── echo ──────────────────────────────────────────────────
    echo: {
      desc: 'Echo text to the terminal',
      usage: 'echo <text>',
      exec(args, path) {
        const msg = args.join(' ');
        return { lines: [text(msg || '')] };
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

  // ── Public: execute ───────────────────────────────────────
  function execute(cmd, args, path) {
    if (!cmd) return null;
    const entry = registry[cmd.toLowerCase()];
    if (!entry) return unknown(cmd);
    return entry.exec(args, path);
  }

  // ── Public: list command names ────────────────────────────
  function names() {
    return Object.keys(registry);
  }

  return { execute, names };

})();
