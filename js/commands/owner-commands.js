// ── Site content file map (for `note cat` in site mode) ─────
// BASE is defined in filesystem.js (loads before commands/).
// Client sends only fileKey to the CF — never a path.
const _SITE_FILES = {
  "about.md": { staticUrl: BASE + "/content/about.md", fileKey: "about" },
  "contact.md": { staticUrl: BASE + "/content/contact.md", fileKey: "contact" },
  "projects/README.md": { staticUrl: BASE + "/content/projects/README.md", fileKey: "projects" },
  "skills.md": { staticUrl: BASE + "/content/skills.md", fileKey: "skills" },
  "shorter-about.md": { staticUrl: BASE + "/content/shorter-about.md", fileKey: "shorter-about" },
};

function _resolveSiteFile(filename) {
  if (_SITE_FILES[filename]) return _SITE_FILES[filename];
  const m = filename.match(/^blog\/([a-zA-Z0-9_-]+\.md)$/);
  if (m) return { staticUrl: BASE + `/content/blog/${m[1]}`, fileKey: `blog/${m[1]}` };
  return null;
}

// ── _ensureNotesDir() ──────────────────────────────────────
// Ensures FS['~']['notes'] exists and is populated with stub nodes
// for each note in RTDB (used by ls notes/ for the authenticated owner).
// Guards against duplicate CF calls with __populated flag.
// Flag is only set on success — failed fetches allow retry on next call.
async function _ensureNotesDir() {
  const CF_BASE = Config.CF_BASE;

  // Create the dir node if it doesn't exist
  if (!FS["~"].notes || FS["~"].notes.__type !== "dir") {
    FS["~"].notes = { __type: "dir" };
  }
  const notesDir = FS["~"].notes;
  if (notesDir.__populated) return; // already done

  try {
    const data = await cfPost(`${CF_BASE}/notesList`, { token: Auth.getToken() });
    if (!data.ok || !Array.isArray(data.notes)) return;

    data.notes.forEach((n) => {
      if (!n.filename || !/^[a-zA-Z0-9_-]+\.md$/.test(n.filename)) return;
      // Only inject stub if not already present
      if (!notesDir[n.filename]) {
        notesDir[n.filename] = { __type: "file", content: "", __isNote: true };
      }
    });
    notesDir.__populated = true; // only set on success — allows retry on failure
  } catch (_) {
    /* fail silently */
  }
}

const OwnerCommands = {
  // ── auth ──────────────────────────────────────────────────
  auth: {
    desc: "Authenticate as owner  (hidden from help)",
    exec(args, path, ctx, { line, text, esc }) {
      // --logout shorthand
      if (args[0] === "--logout" || args[0] === "logout") {
        Auth.clearSession();
        // If currently inside a private directory, auto-navigate to home
        // so the user isn't stranded in a dir they can no longer access.
        const PRIVATE_DIRS = ["notes", "images"];
        const isInPrivate = path.length >= 2 && PRIVATE_DIRS.includes(path[1]);
        const result = { lines: [text("Logged out.", ["muted"])] };
        if (isInPrivate) {
          result.newPath = ["~"];
          result.lines.push(
            text("Returned to ~ (private directory no longer accessible).", ["muted"]),
          );
        }
        return result;
      }

      if (Auth.isAuthenticated()) {
        return {
          lines: [
            line(
              '<span style="color:var(--color-green)">✓</span> Already authenticated. ' +
                '<span style="color:var(--text-muted)">Run <strong>auth --logout</strong> to end session.</span>',
            ),
          ],
        };
      }

      if (!args[0]) {
        return {
          lines: [
            line(
              `Usage: <span style="color:var(--color-blue)">auth</span> <span style="color:var(--text-muted)">&lt;passphrase&gt;</span>`,
            ),
            text("Authenticate to access private note commands.", ["muted"]),
          ],
        };
      }

      const passphrase = args.join(" ");

      Auth.startAuth(passphrase, ctx).then((result) => {
        if (!result) return;
        if (result.error) {
          ctx.appendLine(result.error, ["error"]);
        } else if (result.lines) {
          result.lines.forEach((l) => ctx.appendHTML(l.html, l.classes || []));
        }
        ctx.scrollBottom();
      });

      return { lines: [line('<span style="color:var(--text-muted)">Contacting server…</span>')] };
    },
  },

  // ── note ──────────────────────────────────────────────────
  note: {
    desc: "Private Markdown notes  (hidden from help)",
    exec(args, path, ctx, { line, text, esc }) {
      const CF_BASE = Config.CF_BASE;
      const sub = (args[0] || "").toLowerCase();

      // ── note / note --help ────────────────────────────────
      if (!sub || sub === "--help" || sub === "help") {
        return {
          lines: [
            line('<span class="hr">────────────────────────────────────</span>'),
            line(
              '<strong style="color:var(--text-primary)">note</strong> — Private Markdown notes (owner only)',
            ),
            line('<span class="hr">────────────────────────────────────</span>'),
            line(
              `  <span style="color:var(--color-blue)">note ls</span><span style="color:var(--text-muted)">                        — list all notes (with location)</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">note add &lt;file.md&gt;</span><span style="color:var(--text-muted)">        — create new note</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">note cat &lt;file.md&gt;</span><span style="color:var(--text-muted)">        — open note in split-pane editor</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">note cat &lt;about.md&gt;</span><span style="color:var(--text-muted)">       — edit site content file (blue badge)</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">note cat blog/&lt;slug&gt;.md</span><span style="color:var(--text-muted)">  — edit a blog post in place</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">note rm  &lt;file.md&gt;</span><span style="color:var(--text-muted)">        — delete a note</span>`,
            ),
            line('<span class="hr">────────────────────────────────────</span>'),
            line(
              '<strong style="color:var(--text-primary)">mv</strong> — Move note between locations (visibility)',
            ),
            line(
              `  <span style="color:var(--color-blue)">mv notes/file.md blog/file.md</span><span style="color:var(--text-muted)">     — publish to blog</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">mv notes/file.md projects/file.md</span><span style="color:var(--text-muted)"> — publish to projects</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">mv notes/file.md file.md</span><span style="color:var(--text-muted)">          — publish to root (~)</span>`,
            ),
            line(
              `  <span style="color:var(--color-blue)">mv blog/file.md notes/file.md</span><span style="color:var(--text-muted)">     — make private again</span>`,
            ),
            line('<span class="hr">────────────────────────────────────</span>'),
            line(
              '<span style="color:var(--text-muted)">Requires authentication. Run: <strong>auth &lt;passphrase&gt;</strong></span>',
            ),
          ],
        };
      }

      // ── All other subcommands require auth ────────────────
      if (!Auth.isAuthenticated()) {
        return {
          lines: [
            line(
              '<span style="color:var(--color-red)">✗</span> Not authenticated. ' +
                'Run: <span style="color:var(--color-blue)">auth &lt;passphrase&gt;</span>',
            ),
          ],
        };
      }

      // ── note ls ───────────────────────────────────────────
      if (sub === "ls") {
        ctx.appendLine("Loading notes…", ["muted"]);
        ctx.scrollBottom();

        fetch(`${CF_BASE}/notesList`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: Auth.getToken() }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok) throw new Error(data.error || "unknown error");

            if (!data.notes || !data.notes.length) {
              ctx.appendLine("No notes yet. Create one: note add <filename>.md", ["muted"]);
            } else {
              ctx.appendHTML(
                '<span style="color:var(--text-muted)">─── notes ───────────────────────────────</span>',
                ["output-line"],
              );
              data.notes.forEach((n) => {
                const date = new Date(n.updatedAt || 0).toLocaleDateString();
                const loc = n.location || "notes";
                const locTag =
                  loc !== "notes"
                    ? `  <span style="color:var(--color-green);font-size:0.85em">[${esc(loc)}]</span>`
                    : "";
                ctx.appendHTML(
                  `<span style="color:var(--color-blue)">${esc(n.filename)}</span>` +
                    `  <span style="color:var(--text-muted)">${date}</span>${locTag}` +
                    (n.preview
                      ? `<br><span style="color:var(--text-dim)">${esc(n.preview)}…</span>`
                      : ""),
                  ["output-line"],
                );
              });
            }
            ctx.scrollBottom();
          })
          .catch((e) => {
            ctx.appendLine(`note ls: ${e.message}`, ["error"]);
            ctx.scrollBottom();
          });
        return null;
      }

      // ── note add <filename> ───────────────────────────────
      if (sub === "add") {
        const filename = args[1];
        if (!filename) {
          return { error: "note add: filename required  (e.g. note add ideas.md)" };
        }
        if (!/^[a-zA-Z0-9_-]+\.md$/.test(filename) || filename.length > 64) {
          return {
            error: `note add: invalid filename '${filename}' — use letters, numbers, hyphens, underscores, .md extension (max 64 chars)`,
          };
        }
        NoteEditor.open(filename, "", ctx);
        return null;
      }

      // ── note cat <filename> ───────────────────────────────
      if (sub === "cat") {
        const filename = args[1];
        if (!filename) return { error: "note cat: filename required" };

        // ── Site file detection: check SITE_FILES map first ──
        const siteFile = _resolveSiteFile(filename);
        if (siteFile) {
          ctx.appendLine(`Loading ${filename}…`, ["muted"]);
          ctx.scrollBottom();

          fetch(siteFile.staticUrl)
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.text();
            })
            .then((content) => {
              NoteEditor.open(filename, content, ctx, "site", siteFile.fileKey);
            })
            .catch((e) => {
              ctx.appendLine(`note cat: ${e.message}`, ["error"]);
              ctx.scrollBottom();
            });
          return null;
        }

        // ── Firebase note ────────────────────────────────────
        ctx.appendLine(`Loading ${filename}…`, ["muted"]);
        ctx.scrollBottom();

        fetch(`${CF_BASE}/notesRead`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: Auth.getToken(), filename }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok) throw new Error(data.error || "unknown error");
            NoteEditor.open(filename, data.note.content || "", ctx);
          })
          .catch((e) => {
            ctx.appendLine(`note cat: ${e.message}`, ["error"]);
            ctx.scrollBottom();
          });
        return null;
      }

      // ── note rm <filename> ────────────────────────────────
      if (sub === "rm") {
        const filename = args[1];
        if (!filename) return { error: "note rm: filename required" };
        NoteEditor.confirmDelete(filename, ctx);
        return null;
      }

      return { error: `note: unknown subcommand '${sub}'. Run 'note --help'.` };
    },
  },

  // ── mv ─────────────────────────────────────────────────────
  mv: {
    desc: "Move a note to a different location  (hidden from help)",
    exec(args, path, ctx, { line, text, esc }) {
      const CF_BASE = Config.CF_BASE;

      if (!Auth.isAuthenticated()) {
        return {
          lines: [
            line(
              '<span style="color:var(--color-red)">✗</span> Not authenticated. ' +
                'Run: <span style="color:var(--color-blue)">auth &lt;passphrase&gt;</span>',
            ),
          ],
        };
      }

      const src = args[0],
        dst = args[1];
      if (!src || !dst) {
        return {
          lines: [
            line(
              `Usage: <span style="color:var(--color-blue)">mv</span> <span style="color:var(--text-muted)">&lt;src&gt; &lt;dst&gt;</span>`,
            ),
            text("Examples:", ["muted"]),
            text("  mv notes/test.md blog/test.md       (publish to blog)", ["muted"]),
            text("  mv notes/test.md projects/test.md   (publish to projects)", ["muted"]),
            text("  mv notes/test.md test.md            (publish to root ~/)", ["muted"]),
            text("  mv blog/test.md notes/test.md       (make private)", ["muted"]),
          ],
        };
      }

      const srcClean = src.replace(/^~\//, "");
      const srcParts = srcClean.split("/").filter(Boolean);
      const filename = srcParts[srcParts.length - 1];

      const isTxt = /^[a-zA-Z0-9_-]+\.txt$/.test(filename);
      const isMd = /^[a-zA-Z0-9_-]+\.md$/.test(filename);

      if (!isMd && !isTxt) {
        return { error: `mv: source must be a *.md note or *.md static file` };
      }

      // ── Detect if source is a static FS file ──────────────
      const srcFsNode = fsResolve(path, src);
      if (srcFsNode && srcFsNode.node && srcFsNode.node.src) {
        // Flow B: static FS file (e.g. blog/*.md) → notes only
        const dstClean = dst.replace(/^~\//, "");
        const dstParts = dstClean.split("/").filter(Boolean);
        const dstDir = dstParts.length > 1 ? dstParts[0] : "";
        const dstFile = dstParts[dstParts.length - 1];
        const mdFilename =
          dstFile && /\.md$/.test(dstFile) ? dstFile : filename.replace(/\.txt$/, ".md");

        if (dstDir !== "notes") {
          return { error: `mv: static files can only be moved to notes/ (to privatise them)` };
        }
        if (!/^[a-zA-Z0-9_-]+\.md$/.test(mdFilename) || mdFilename.length > 64) {
          return { error: `mv: invalid destination filename '${mdFilename}'` };
        }

        ctx.appendLine(`Reading ${src}…`, ["muted"]);
        ctx.scrollBottom();

        const srcDir = srcParts.length > 1 ? srcParts[0] : "";

        fsReadFile(srcFsNode.node)
          .then(async (content) => {
            const createRes = await fetch(`${CF_BASE}/notesWrite`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: Auth.getToken(),
                action: "create",
                filename: mdFilename,
                content,
                location: "notes",
              }),
            });
            const createData = await createRes.json().catch(() => ({}));
            if (!createRes.ok) throw new Error(createData.error || `HTTP ${createRes.status}`);

            if (srcDir === "blog") {
              await fetch(`${CF_BASE}/blogManifestRemove`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: Auth.getToken(), file: filename }),
              }).catch(() => {});
            }

            const fsParent = srcParts.length > 1 ? FS["~"][srcDir] || null : FS["~"];
            if (fsParent && fsParent[filename]) {
              delete fsParent[filename];
            }

            ctx.appendHTML(
              `<span style="color:var(--color-green)">✓</span> ` +
                `<span style="color:var(--color-blue)">${esc(src)}</span> → ` +
                `<strong>~/notes/${esc(mdFilename)} (private)</strong>` +
                `<br><span style="color:var(--text-muted)">Reload page for visitors to see the change.</span>`,
              ["output-line"],
            );
            ctx.scrollBottom();
          })
          .catch((e) => {
            ctx.appendLine(`mv: ${e.message}`, ["error"]);
            ctx.scrollBottom();
          });

        return null;
      }

      // ── Flow A: Firebase note → new location ──────────────
      if (!isMd) {
        return { error: `mv: Firebase notes must end in .md` };
      }

      const dstClean = dst.replace(/^~\//, "");
      const dstParts = dstClean.split("/").filter(Boolean);
      const dstDir =
        dstParts.length > 1 ? dstParts[0] : dstParts[0] === filename ? "" : dstParts[0];
      const dstFile = dstParts[dstParts.length - 1];

      if (dstFile !== filename && /\./.test(dstFile)) {
        return { error: `mv: destination filename must match source (${filename})` };
      }

      const LOCATION_MAP = {
        notes: "notes",
        blog: "blog",
        projects: "projects",
        "": "root",
      };

      let rawDir;
      if (dstFile === filename) {
        rawDir = dstParts.slice(0, -1).join("/") || "";
      } else {
        rawDir = dstClean;
      }

      const newLocation = LOCATION_MAP[rawDir];
      if (newLocation === undefined) {
        return {
          error: `mv: unknown destination dir '${rawDir}'. Valid: notes, blog, projects, ~`,
        };
      }

      ctx.appendLine(`Moving ${filename}…`, ["muted"]);
      ctx.scrollBottom();

      fetch(`${CF_BASE}/notesMove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: Auth.getToken(), filename, newLocation }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.ok) throw new Error(data.error || "unknown error");
          const isPrivate = newLocation === "notes";
          const pubPath = newLocation === "root" ? `~/${filename}` : `~/${newLocation}/${filename}`;

          if (isPrivate) {
            // Remove from in-memory FS if it was previously published
            const prevSrcParts = src.replace(/^~\//, "").split("/").filter(Boolean);
            const prevDir = prevSrcParts.length > 1 ? prevSrcParts[0] : "";
            if (prevDir === "blog" && FS["~"].blog && FS["~"].blog[filename]) {
              delete FS["~"].blog[filename];
            } else if (prevDir === "projects" && FS["~"].projects && FS["~"].projects[filename]) {
              delete FS["~"].projects[filename];
            } else if (!prevDir && FS["~"][filename]) {
              delete FS["~"][filename];
            }
          }

          ctx.appendHTML(
            `<span style="color:var(--color-green)">✓</span> ` +
              `<span style="color:var(--color-blue)">${esc(filename)}</span> → ` +
              `<strong>${isPrivate ? "~/notes/ (private)" : `${esc(pubPath)} (public)`}</strong>` +
              (isPrivate
                ? ""
                : `<br><span style="color:var(--text-muted)">Visitors will see it after a page reload.</span>`),
            ["output-line"],
          );
          ctx.scrollBottom();
        })
        .catch((e) => {
          ctx.appendLine(`mv: ${e.message}`, ["error"]);
          ctx.scrollBottom();
        });

      return null;
    },
  },
};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.OwnerCommands = OwnerCommands;
