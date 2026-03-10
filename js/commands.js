/* ============================================================
   commands.js — Command Registry
   ============================================================ */

'use strict';

const Commands = (() => {

  // ── External links for `open` ──────────────────────────────
  // SECURITY BOUNDARY: Only add https:// or mailto: URLs to this object.
  // The open command enforces this allowlist at runtime — never add passthrough
  // URL support or user-supplied URLs here.
  const LINKS = {
    github:   'https://github.com/hahahuy',
    linkedin: 'https://www.linkedin.com/in/haqhuy',
    email:    'mailto:quanghuyha098@gmail.com',
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
          let cmd;
          if (isDir) {
            const relBase = target ? `${target}/${e.name}` : e.name;
            cmd = `cd ${relBase}`;
          } else {
            const relBase = target ? `${target}/${e.name}` : e.name;
            cmd = `cat ${relBase}`;
          }
          // Generate a shareable deep-link (3a)
          const shareUrl = `${location.origin}${location.pathname}#cmd=${encodeURIComponent(cmd)}`;
          gridHtml +=
            `<span class="ls-item ${cls}" data-cmd="${esc(cmd)}" ` +
            `title="click to run: ${esc(cmd)} | link: ${esc(shareUrl)}">${esc(e.name)}${suffix}</span>`;
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
      exec(args, path, ctx) {
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

        // Async: fetch and render into the calling terminal instance via ctx
        fsReadFile(resolved.node)
          .then(content => {
            ctx.appendMarkdown(content);
            ctx.scrollBottom();
          })
          .catch(err => {
            ctx.appendLine(`cat: error reading file — ${err.message}`, ['error']);
          });

        return { lines: [text('Loading…', ['muted'])] };
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
        // SEC-7: Runtime URL guard — block non-https/mailto URLs even if LINKS is modified
        const url = LINKS[alias];
        if (!url.startsWith('https://') && !url.startsWith('mailto:')) {
          return { error: `open: blocked — only https:// and mailto: links are allowed` };
        }
        window.open(url, '_blank', 'noopener,noreferrer');
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
        // hist is stored newest-first; take up to `limit`, then reverse to show oldest→newest
        const slice = hist.slice(0, limit);
        const shown = slice.slice().reverse(); // oldest first in display
        const startNum = hist.length - slice.length + 1;
        const lines = shown.map((cmd, i) => {
          const num = String(startNum + i).padStart(4, ' ');
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

    // ── reload ────────────────────────────────────────────────
    reload: {
      desc: 'Reload the page',
      usage: 'reload',
      exec(args, path) {
        setTimeout(() => window.location.reload(), 300);
        return { lines: [text('Reloading…', ['muted'])] };
      },
    },

    // ── quit ──────────────────────────────────────────────────
    quit: {
      desc: 'Close this terminal window',
      usage: 'quit',
      exec(args, path) {
        return { quit: true };
      },
    },

    // ── grep ──────────────────────────────────────────────────
    grep: {
      desc: 'Search file contents  (grep <term>)',
      usage: 'grep <term>',
      exec(args, path, ctx) {
        if (!args[0]) {
          return { error: 'grep: missing search term. Usage: grep <term>' };
        }

        const term = args.join(' ');
        const termLower = term.toLowerCase();

        // Recursively collect all file nodes from the FS tree
        function collectFiles(node, currentPath) {
          const results = [];
          if (!node || typeof node !== 'object') return results;
          for (const [key, child] of Object.entries(node)) {
            if (key === '__type') continue;
            if (!child || typeof child !== 'object') continue;
            if (child.__type === 'file') {
              results.push({ name: [...currentPath, key].join('/'), node: child });
            } else if (child.__type === 'dir') {
              results.push(...collectFiles(child, [...currentPath, key]));
            }
          }
          return results;
        }

        const files = collectFiles(FS['~'], ['~']);

        ctx.appendLine(`Searching for "${term}"…`, ['muted']);
        ctx.scrollBottom();

        let found = 0;
        let pending = files.length;

        if (files.length === 0) {
          ctx.appendLine('No files to search.', ['muted']);
          return null;
        }

        files.forEach(({ name, node: fileNode }) => {
          fsReadFile(fileNode)
            .then(content => {
              const lines = content.split('\n');
              lines.forEach((fileLine, idx) => {
                if (fileLine.toLowerCase().includes(termLower)) {
                  found++;
                  const lineNum = idx + 1;
                  const preview = fileLine.trim().slice(0, 100);
                  ctx.appendHTML(
                    `<span style="color:var(--color-blue)">${esc(name)}</span>` +
                    `<span style="color:var(--text-muted)">:${lineNum}:</span> ` +
                    `${esc(preview)}`,
                    ['output-line']
                  );
                }
              });
            })
            .catch(() => { /* skip unreadable files */ })
            .finally(() => {
              pending--;
              if (pending === 0) {
                if (found === 0) {
                  ctx.appendLine(`No matches found for "${term}".`, ['muted']);
                } else {
                  ctx.appendLine(`— ${found} match${found === 1 ? '' : 'es'} found.`, ['muted']);
                }
                ctx.scrollBottom();
              }
            });
        });

        return null;
      },
    },

    // ── neofetch ──────────────────────────────────────────────
    neofetch: {
      desc: 'Display portfolio system info',
      usage: 'neofetch',
      exec(args, path) {
        const cmdCount = Object.keys(registry).length;
        // Count blog posts via FS if available
        let blogCount = 0;
        try {
          const blogDir = FS['~'] && FS['~'].blog;
          if (blogDir) {
            blogCount = Object.keys(blogDir).filter(k => k !== '__type').length;
          }
        } catch (e) {}

        const asciiArt = [
          '        ██████████        ',
          '       ██░░░░░░░░██       ',
          '      ██░░░░░░░░░░██      ',
          '     ██░░░░░░░░░░░░██     ',
          '    ██░░░░██░░░░░░░░██    ',
          '   ██░░░░████░░░░░░░░██   ',
          '   ██░░░░░░░░░░░░░░░░██   ',
          '   ████████████████████   ',
        ];

        const info = [
          `<span style="color:var(--color-green);font-weight:700">visitor</span><span style="color:var(--text-muted)">@</span><span style="color:var(--color-blue);font-weight:700">portfolio</span>`,
          `<span style="color:var(--text-muted)">─────────────────</span>`,
          `<span style="color:var(--color-green)">OS:</span>       hahuy.site v1.0.0`,
          `<span style="color:var(--color-green)">Shell:</span>    4FF-HH terminal`,
          `<span style="color:var(--color-green)">Commands:</span> ${cmdCount}`,
          `<span style="color:var(--color-green)">Blog:</span>     ${blogCount} post${blogCount === 1 ? '' : 's'}`,
          `<span style="color:var(--color-green)">Stack:</span>    JS · Firebase · Telegram`,
          `<span style="color:var(--color-green)">Theme:</span>    ${document.documentElement.dataset.theme || 'default'}`,
        ];

        const lines = [];
        const maxRows = Math.max(asciiArt.length, info.length);
        for (let i = 0; i < maxRows; i++) {
          const art  = asciiArt[i]  || '                          ';
          const inf  = info[i]      || '';
          lines.push(line(
            `<span style="color:var(--color-blue)">${art}</span>  ${inf}`
          ));
        }
        return { lines };
      },
    },

    // ── theme ─────────────────────────────────────────────────
    theme: {
      desc: 'Switch color theme  (theme <name> | theme list)',
      usage: 'theme <name>',
      exec(args, path) {
        const THEMES = ['default', 'dracula', 'solarized', 'light'];
        const name = (args[0] || '').toLowerCase();

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

        // Persist theme selection
        try { localStorage.setItem('term_theme', name); } catch (e) {}

        return {
          lines: [
            line(`<span style="color:var(--color-green)">✓</span> Theme set to <span style="color:var(--color-blue)">${esc(name)}</span>`),
          ],
        };
      },
    },

    // ── download ──────────────────────────────────────────────
    download: {
      desc: 'Download a file  (download resume)',
      usage: 'download <file>',
      exec(args, path) {
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
          a.href     = 'content/resume.pdf';
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

    // ── message ───────────────────────────────────────────────
    message: {
      desc: 'Send me a message  (message --name <you> for live chat)',
      usage: 'message [--name <name> | --stop | <content>]',
      exec(args, path, ctx) {
        if (typeof MessagePanel === 'undefined') {
          return { error: 'message: MessagePanel module not loaded' };
        }

        // No arguments — show usage + last used name hint
        if (!args.length) {
          const lastName = MessagePanel.getLastName ? MessagePanel.getLastName() : null;
          const lines = [
            text('Usage:'),
            text('  message <content>          Send a one-shot message'),
            text('  message --name <you>       Open a live chat session'),
            text('  message --stop             Close the live chat'),
          ];
          if (lastName) {
            lines.push(text(`  Tip: last used name was "${lastName}"`, ['muted']));
          }
          return { lines };
        }

        // --stop: close live chat
        if (args[0] === '--stop') {
          return MessagePanel.stop(ctx);
        }

        // --name <name>: open live chat
        if (args[0] === '--name') {
          const name = args[1];
          if (!name) return { error: 'message --name requires a name argument' };
          // startChat is async — use ctx for deferred output
          MessagePanel.startChat(name, ctx).then(result => {
            if (result) {
              if (result.error) {
                ctx.appendLine(result.error, ['error']);
              } else if (result.lines) {
                result.lines.forEach(l => {
                  const div = document.createElement('div');
                  div.className = (l.classes || ['output-line']).join(' ');
                  div.innerHTML = l.html || '';
                  ctx.winEl.querySelector('.output').appendChild(div);
                });
              }
              ctx.scrollBottom();
            }
          });
          return { lines: [text('Opening chat session…', ['muted'])] };
        }

        // Guard: can't send one-shot while chat is open
        if (MessagePanel.isActive()) {
          return { error: 'Close the current chat first: message --stop' };
        }

        // One-shot: validate then show captcha → confirm
        const content = args.join(' ');
        return MessagePanel.confirmSend(content, ctx);
      },
    },

    // ── init ──────────────────────────────────────────────────
    init: {
      desc: 'Launch portfolio overview panels  (init --stop to close)',
      usage: 'init [--stop]',
      exec(args, path, ctx) {
        if (typeof InitPanels === 'undefined') {
          return { error: 'init: InitPanels module not loaded' };
        }
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

    // ── EGG-2: cowsay ─────────────────────────────────────────
    cowsay: {
      desc: 'ASCII cow says something wise',
      usage: 'cowsay [message]',
      exec(args, path) {
        const quips = [
          'moo. hire me.',
          '404: grass not found.',
          'git commit -m "moo"',
          'have you tried turning it off and on again?',
          'undefined is not a function. neither am i.',
        ];
        const msg   = args.length ? args.join(' ') : quips[Math.floor(Math.random() * quips.length)];
        const msgEsc = esc(msg);
        const border = '-'.repeat(msg.length + 2);
        const cow = [
          line(` ${border}`),
          line(`&lt; ${msgEsc} &gt;`),
          line(` ${border}`),
          line('        \\   ^__^'),
          line('         \\  (oo)\\_______'),
          line('            (__)\\       )\\/\\'),
          line('                ||----w |'),
          line('                ||     ||'),
        ];
        return { lines: cow };
      },
    },

    // ── EGG-4: fortune ────────────────────────────────────────
    fortune: {
      desc: 'Random developer/philosophy quote',
      usage: 'fortune [-s]',
      exec(args, path) {
        const all = [
          { q: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', a: 'Martin Fowler', short: false },
          { q: 'First, solve the problem. Then, write the code.', a: 'John Johnson', short: true },
          { q: 'Experience is the name everyone gives to their mistakes.', a: 'Oscar Wilde', short: true },
          { q: 'In order to be irreplaceable, one must always be different.', a: 'Coco Chanel', short: false },
          { q: 'Java is to JavaScript what car is to carpet.', a: 'Chris Heilmann', short: true },
          { q: 'Knowledge is power.', a: 'Francis Bacon', short: true },
          { q: 'Sometimes it pays to stay in bed on Monday rather than spending the rest of the week debugging Sunday\'s code.', a: 'Dan Salomon', short: false },
          { q: 'Simplicity is the soul of efficiency.', a: 'Austin Freeman', short: true },
          { q: 'Before software can be reusable it first has to be usable.', a: 'Ralph Johnson', short: false },
          { q: 'Make it work, make it right, make it fast.', a: 'Kent Beck', short: true },
          { q: 'The best error message is the one that never shows up.', a: 'Thomas Fuchs', short: false },
          { q: 'Code is like humor. When you have to explain it, it\'s bad.', a: 'Cory House', short: false },
          { q: 'Fix the cause, not the symptom.', a: 'Steve Maguire', short: true },
          { q: 'Optimism is an occupational hazard of programming.', a: 'Kent Beck', short: false },
          { q: 'When in doubt, use brute force.', a: 'Ken Thompson', short: true },
          { q: 'Talk is cheap. Show me the code.', a: 'Linus Torvalds', short: true },
          { q: 'Always code as if the person who ends up maintaining your code is a violent psychopath who knows where you live.', a: 'John Woods', short: false },
          { q: 'The most disastrous thing that you can ever learn is your first programming language.', a: 'Alan Kay', short: false },
          { q: 'One man\'s crappy software is another man\'s full-time job.', a: 'Jessica Gaston', short: false },
          { q: 'It works on my machine.', a: 'Every Developer', short: true },
        ];
        const shortOnly = args[0] === '-s';
        const pool = shortOnly ? all.filter(f => f.short) : all;
        const f    = pool[Math.floor(Math.random() * pool.length)];
        const qEsc = esc(f.q);
        const aEsc = esc(f.a);
        const width = Math.min(f.q.length, 56);
        const border = '─'.repeat(width + 2);
        return {
          lines: [
            line(`<span style="color:var(--text-dim)">╭${border}╮</span>`),
            line(`<span style="color:var(--text-dim)">│</span> <em>${qEsc}</em> <span style="color:var(--text-dim)">│</span>`),
            line(`<span style="color:var(--text-dim)">╰${border}╯</span>`),
            line(`<span style="color:var(--text-muted)">    — ${aEsc}</span>`),
          ],
        };
      },
    },

    // ── EGG-6: weather ────────────────────────────────────────
    weather: {
      desc: 'Live weather via wttr.in  (weather [city])',
      usage: 'weather [city]',
      exec(args, path, ctx) {
        // Sanitise input: allow only safe city name characters
        const raw  = args.join(' ').trim() || 'Ho Chi Minh City';
        const city = raw.replace(/[^a-zA-Z0-9 +\-,.]/g, '').slice(0, 60) || 'Ho Chi Minh City';
        const url  = `https://wttr.in/${encodeURIComponent(city)}?format=3`;

        fetch(url)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .then(txt => {
            ctx.appendLine(txt.trim(), ['success']);
            ctx.scrollBottom();
          })
          .catch(() => {
            ctx.appendLine('weather: could not fetch weather data. Try again later.', ['error']);
            ctx.scrollBottom();
          });

        return { lines: [text(`Fetching weather for ${city}…`, ['muted'])] };
      },
    },

    // ── UX-7: export ──────────────────────────────────────────
    export: {
      desc: 'Download this session as a .txt file',
      usage: 'export',
      exec(args, path, ctx) {
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

    // ── VIS-3: scanlines ──────────────────────────────────────
    scanlines: {
      desc: 'Toggle CRT scanlines overlay  (scanlines on | off)',
      usage: 'scanlines [on|off]',
      exec(args, path) {
        const arg     = (args[0] || '').toLowerCase();
        const body    = document.body;
        const current = body.classList.contains('scanlines');

        let enable;
        if (arg === 'on')  { enable = true; }
        else if (arg === 'off') { enable = false; }
        else { enable = !current; }

        if (enable) {
          body.classList.add('scanlines');
          try { localStorage.setItem('term_scanlines', '1'); } catch (e) {}
          return { lines: [line('<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">enabled</span>. Run <code>scanlines off</code> to disable.')] };
        } else {
          body.classList.remove('scanlines');
          try { localStorage.removeItem('term_scanlines'); } catch (e) {}
          return { lines: [line('<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">disabled</span>.')] };
        }
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
  // ctx = { appendMarkdown, appendLine, scrollBottom } from the calling terminal instance
  function execute(cmd, args, path, ctx = {}) {
    if (!cmd) return null;
    const entry = registry[cmd.toLowerCase()];
    if (!entry) return unknown(cmd);
    return entry.exec(args, path, ctx);
  }

  // ── Public: list command names ────────────────────────────
  function names() {
    return Object.keys(registry);
  }

  return { execute, names };

})();
