/* ============================================================
   js/commands/fs-commands.js — Filesystem commands
   Commands: ls, cd, cat, pwd, grep
   ============================================================ */

'use strict';

// ── Shared helpers (injected via helpers object from index.js) ─
// line(), text(), esc() are provided by the assembler scope.

const FsCommands = {

  // ── ls ────────────────────────────────────────────────────
  ls: {
    desc: 'List directory contents',
    usage: 'ls [dir]',
    exec(args, path, ctx, { line, text, esc }) {
      const target   = args[0] || null;
      const resolved = fsResolve(path, target);

      if (!resolved) {
        return { error: `ls: ${target}: No such file or directory` };
      }

      const { node } = resolved;

      if (node.__type === 'file') {
        const cmd = `cat ${args[0]}`;
        return { lines: [line(
          `<span class="ls-item ls-file" data-cmd="${esc(cmd)}" title="click to run: ${esc(cmd)}">${esc(args[0])}</span>`
        )] };
      }

      const entries = fsListDir(node);
      if (entries.length === 0) {
        return { lines: [text('(empty directory)', ['muted'])] };
      }

      let gridHtml = '<div class="ls-grid">';
      entries.forEach(e => {
        const isDir  = e.type === 'dir';
        const cls    = isDir ? 'ls-dir' : 'ls-file';
        const suffix = isDir ? '/' : '';
        let cmd;
        if (isDir) {
          const relBase = target ? `${target}/${e.name}` : e.name;
          cmd = `cd ${relBase}`;
        } else {
          const relBase = target ? `${target}/${e.name}` : e.name;
          cmd = `cat ${relBase}`;
        }
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
    exec(args, path, ctx, { text }) {
      const target   = args[0] || '~';
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
    exec(args, path, ctx, { text }) {
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

  // ── pwd ───────────────────────────────────────────────────
  pwd: {
    desc: 'Print working directory',
    usage: 'pwd',
    exec(args, path, ctx, { text }) {
      return { lines: [text(path.join('/'), ['success'])] };
    },
  },

  // ── grep ──────────────────────────────────────────────────
  grep: {
    desc: 'Search file contents  (grep <term>)',
    usage: 'grep <term>',
    exec(args, path, ctx, { esc }) {
      if (!args[0]) {
        return { error: 'grep: missing search term. Usage: grep <term>' };
      }

      const term      = args.join(' ');
      const termLower = term.toLowerCase();

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
          .catch(() => {})
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

};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.FsCommands = FsCommands;
