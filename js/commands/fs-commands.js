// ── Shared helpers (injected via helpers object from index.js) ─
// line(), text(), esc() are provided by the assembler scope.

// Directories that require authentication to be visible in ls ~/
const AUTH_GATED_DIRS = new Set(["note", "image"]);

// ── populateNoteDir ─────────────────────────────────────────
// Fetches notes from CF and populates FS["~"].note with stub nodes.
// Called by ls when listing ~/note while authenticated.
async function populateNoteDir(ctx) {
  const CF_BASE = Config.CF_BASE;
  if (!FS["~"].note || FS["~"].note.__type !== "dir") {
    FS["~"].note = { __type: "dir" };
  }
  const noteDir = FS["~"].note;
  if (noteDir.__populated) return;

  try {
    const data = await cfPost(`${CF_BASE}/notesList`, { token: Auth.getToken() });
    if (!data.ok || !Array.isArray(data.notes)) return;
    data.notes.forEach((n) => {
      if (!n.filename || !/^[a-zA-Z0-9_-]+\.md$/.test(n.filename)) return;
      if (!noteDir[n.filename]) {
        noteDir[n.filename] = { __type: "file", content: "", __isNote: true };
      }
    });
    noteDir.__populated = true;
  } catch (e) {
    if (ctx) ctx.appendLine(`ls: could not load notes — ${e.message}`, ["error"]);
  }
}

const FsCommands = {
  // ── ls ────────────────────────────────────────────────────
  ls: {
    desc: "List directory contents",
    usage: "ls [dir]",
    exec(args, path, ctx, { line, text, esc }) {
      const target = args[0] || null;
      const resolved = fsResolve(path, target);

      if (!resolved) {
        return { error: `ls: ${target}: No such file or directory` };
      }

      const { node } = resolved;

      if (node.__type === "file") {
        const cmd = args[0] === "transformers.py" ? "transformers.py" : `cat ${args[0]}`;
        return {
          lines: [
            line(
              `<span class="ls-item ls-file" data-cmd="${esc(cmd)}" title="click to run: ${esc(cmd)}">${esc(args[0])}</span>`,
            ),
          ],
        };
      }

      const authed = typeof Auth !== "undefined" && Auth.isAuthenticated();
      const isRoot = resolved.path.length === 1 && resolved.path[0] === "~";

      // Inject notes dir for authenticated owner when listing root
      if (isRoot && authed) {
        if (!FS["~"].note || FS["~"].note.__type !== "dir") {
          FS["~"].note = { __type: "dir" };
        }
      }

      // If listing ~/note while authenticated, trigger async populate as side-effect
      const isNoteDir =
        authed &&
        resolved.path.length === 2 &&
        resolved.path[0] === "~" &&
        resolved.path[1] === "note";
      if (isNoteDir && !node.__populated) {
        // Populate asynchronously and re-render after
        populateNoteDir(ctx).then(() => {
          // After population, re-run ls to show updated entries
          const entries = fsListDir(node);
          if (entries.length === 0) {
            ctx.appendLine("(empty directory)", ["muted"]);
          } else {
            let g = '<div class="ls-grid">';
            entries.forEach((e) => {
              const isDir = e.type === "dir";
              const cls = isDir ? "ls-dir" : "ls-file";
              const isGated = isDir && AUTH_GATED_DIRS.has(e.name);
              const label = isGated ? `${e.name}🔒` : e.name;
              const suffix = isDir ? "/" : "";
              const relBase = target ? `${target}/${e.name}` : e.name;
              const cmd = isDir
                ? `cd ${relBase}`
                : e.name === "transformers.py"
                  ? "transformers.py"
                  : `cat ${relBase}`;
              const shareUrl = `${location.origin}${location.pathname}#cmd=${encodeURIComponent(cmd)}`;
              g +=
                `<span class="ls-item ${cls}" data-cmd="${esc(cmd)}" ` +
                `title="click to run: ${esc(cmd)} | link: ${esc(shareUrl)}">${esc(label)}${suffix}</span>`;
            });
            g += "</div>";
            ctx.appendHTML(g);
          }
          ctx.scrollBottom();
        });
        return { lines: [text("Loading notes…", ["muted"])] };
      }

      let entries = fsListDir(node);

      // Hide auth-gated dirs for unauthenticated users at root
      if (isRoot && !authed) {
        entries = entries.filter((e) => !AUTH_GATED_DIRS.has(e.name));
      }

      if (entries.length === 0) {
        return { lines: [text("(empty directory)", ["muted"])] };
      }

      let gridHtml = '<div class="ls-grid">';
      entries.forEach((e) => {
        const isDir = e.type === "dir";
        const cls = isDir ? "ls-dir" : "ls-file";
        const isGated = isDir && AUTH_GATED_DIRS.has(e.name);
        // Auth-gated dirs get a 🔒 label but the data-cmd still uses the real name
        const label = isGated ? `${e.name}🔒` : e.name;
        const suffix = isDir ? "/" : "";
        let cmd;
        if (isDir) {
          const relBase = target ? `${target}/${e.name}` : e.name;
          cmd = `cd ${relBase}`;
        } else {
          const relBase = target ? `${target}/${e.name}` : e.name;
          cmd = e.name === "transformers.py" ? "transformers.py" : `cat ${relBase}`;
        }
        const shareUrl = `${location.origin}${location.pathname}#cmd=${encodeURIComponent(cmd)}`;
        gridHtml +=
          `<span class="ls-item ${cls}" data-cmd="${esc(cmd)}" ` +
          `title="click to run: ${esc(cmd)} | link: ${esc(shareUrl)}">${esc(label)}${suffix}</span>`;
      });
      gridHtml += "</div>";
      return { lines: [{ html: gridHtml, classes: [] }] };
    },
  },

  // ── cd ────────────────────────────────────────────────────
  cd: {
    desc: "Change directory",
    usage: "cd <dir>",
    exec(args, path, ctx, { text }) {
      const target = args[0] || "~";
      const resolved = fsResolve(path, target);

      if (!resolved) {
        return { error: `cd: ${target}: No such file or directory` };
      }
      if (resolved.node.__type === "file") {
        return { error: `cd: ${target}: Not a directory` };
      }

      return { newPath: resolved.path };
    },
  },

  // ── cat ───────────────────────────────────────────────────
  cat: {
    desc: "Display file contents (Markdown rendered)",
    usage: "cat <file>",
    exec(args, path, ctx, { text }) {
      if (!args[0]) {
        return { error: "cat: missing file argument" };
      }

      const resolved = fsResolve(path, args[0]);
      if (!resolved) {
        return { error: `cat: ${args[0]}: No such file or directory` };
      }
      if (resolved.node.__type === "dir") {
        return { error: `cat: ${args[0]}: Is a directory` };
      }

      // __isNote stubs: hint owner to use note cat instead
      if (resolved.node.__isNote) {
        const nf = args[0].split("/").pop();
        ctx.appendLine(`Hint: use 'note cat ${nf}' to open this note in the editor.`, ["muted"]);
        ctx.scrollBottom();
        return null;
      }

      // Media files: render inline if they have a src and a media MIME type
      const filename = args[0].split("/").pop();
      const mime = fsMimeType(filename, resolved.node);
      const isImage = mime && mime.startsWith("image/");
      const isPdf = mime === "application/pdf";

      if ((isImage || isPdf) && resolved.node.src) {
        const url = BASE + resolved.node.src;
        if (isImage) {
          ctx.appendHTML(
            `<div class="cat-media-wrap">` +
              `<img class="cat-image" src="${escHtml(url)}" alt="${escHtml(filename)}" loading="lazy" />` +
              `<div class="cat-media-meta">${escHtml(filename)}</div>` +
              `</div>`,
          );
        } else {
          ctx.appendHTML(
            `<div class="cat-media-wrap cat-pdf-wrap">` +
              `<iframe class="cat-pdf" src="${escHtml(url)}" title="${escHtml(filename)}"></iframe>` +
              `<div class="cat-media-meta">` +
              `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">↗ open ${escHtml(filename)} in new tab</a>` +
              `</div>` +
              `</div>`,
          );
        }
        ctx.scrollBottom();
        return null;
      }

      fsReadFile(resolved.node)
        .then((content) => {
          ctx.appendMarkdown(content);
          ctx.scrollBottom();
        })
        .catch((err) => {
          ctx.appendLine(`cat: error reading file — ${err.message}`, ["error"]);
        });

      return { lines: [text("Loading…", ["muted"])] };
    },
  },

  // ── pwd ───────────────────────────────────────────────────
  pwd: {
    desc: "Print working directory",
    usage: "pwd",
    exec(args, path, ctx, { text }) {
      return { lines: [text(path.join("/"), ["success"])] };
    },
  },

  // ── grep ──────────────────────────────────────────────────
  grep: {
    desc: "Search file contents  (grep <term>)",
    usage: "grep <term>",
    exec(args, path, ctx, { esc }) {
      if (!args[0]) {
        return { error: "grep: missing search term. Usage: grep <term>" };
      }

      const term = args.join(" ");
      const termLower = term.toLowerCase();

      function collectFiles(node, currentPath) {
        const results = [];
        if (!node || typeof node !== "object") return results;
        for (const [key, child] of Object.entries(node)) {
          if (key === "__type") continue;
          if (!child || typeof child !== "object") continue;
          if (child.__type === "file") {
            results.push({ name: [...currentPath, key].join("/"), node: child });
          } else if (child.__type === "dir") {
            results.push(...collectFiles(child, [...currentPath, key]));
          }
        }
        return results;
      }

      const files = collectFiles(FS["~"], ["~"]);

      ctx.appendLine(`Searching for "${term}"…`, ["muted"]);
      ctx.scrollBottom();

      let found = 0;
      let pending = files.length;

      if (files.length === 0) {
        ctx.appendLine("No files to search.", ["muted"]);
        return null;
      }

      files.forEach(({ name, node: fileNode }) => {
        fsReadFile(fileNode)
          .then((content) => {
            const lines = content.split("\n");
            lines.forEach((fileLine, idx) => {
              if (fileLine.toLowerCase().includes(termLower)) {
                found++;
                const lineNum = idx + 1;
                const preview = fileLine.trim().slice(0, 100);
                ctx.appendHTML(
                  `<span style="color:var(--color-blue)">${esc(name)}</span>` +
                    `<span style="color:var(--text-muted)">:${lineNum}:</span> ` +
                    `${esc(preview)}`,
                  ["output-line"],
                );
              }
            });
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (pending === 0) {
              if (found === 0) {
                ctx.appendLine(`No matches found for "${term}".`, ["muted"]);
              } else {
                ctx.appendLine(`— ${found} match${found === 1 ? "" : "es"} found.`, ["muted"]);
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
