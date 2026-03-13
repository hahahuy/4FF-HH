// ── Module-level constants (shared by upload + download) ─────
const _MEDIA_EXTS = new Set(["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "md"]);
const _UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
// Note: .md is intentionally excluded — md uploads go to notesWrite CF, not fileUpload CF
const _UPLOAD_RE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i;

/**
 * Trigger a browser download using a temporary <a> element.
 * If `revokeUrl` is true the href is treated as an object URL and revoked after 1 s.
 */
function _triggerDownload(href, filename, revokeUrl = false) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    if (revokeUrl) URL.revokeObjectURL(href);
  }, 1000);
}

const UiCommands = {
  // ── theme ─────────────────────────────────────────────────
  theme: {
    desc: "Switch color theme  (theme <name> | theme list)",
    usage: "theme <name>",
    exec(args, path, ctx, { line, text, esc }) {
      const THEMES = ["default", "dracula", "solarized", "light"];
      const MOUSE_THEMES = ["default", "comet", "halo", "aurora", "off"];

      // ── theme --mouse handling ────────────────────────────
      if (args[0] === "--mouse") {
        const mName = (args[1] || "").toLowerCase();

        if (!mName || mName === "list") {
          const currentMouse = localStorage.getItem(Config.STORAGE.MOUSE_THEME) || "default";
          return {
            lines: [
              text("Mouse theme variants:", []),
              ...MOUSE_THEMES.map((t) =>
                line(
                  `  <span class="${t === currentMouse ? "cmd-name" : ""}" ` +
                    `style="color:${t === currentMouse ? "var(--color-green)" : "var(--text-primary)"}">${esc(t)}</span>` +
                    (t === currentMouse
                      ? ' <span style="color:var(--text-muted)">(active)</span>'
                      : ""),
                ),
              ),
              text("Usage: theme --mouse <name>", ["muted"]),
            ],
          };
        }

        if (!MOUSE_THEMES.includes(mName)) {
          return {
            error: `theme: unknown mouse theme '${mName}'. Run 'theme --mouse list' to see options.`,
          };
        }

        // Remove existing mouse-* class and apply new one
        document.body.classList.forEach((cls) => {
          if (cls.startsWith("mouse-")) document.body.classList.remove(cls);
        });
        if (mName !== "default") {
          document.body.classList.add(`mouse-${mName}`);
        }
        try {
          localStorage.setItem(Config.STORAGE.MOUSE_THEME, mName);
        } catch (e) {}

        return {
          lines: [
            line(
              `<span style="color:var(--color-green)">✓</span> Mouse theme set to <span style="color:var(--color-blue)">${esc(mName)}</span>`,
            ),
          ],
        };
      }

      const name = (args[0] || "").toLowerCase();

      if (!name || name === "list") {
        const current = document.documentElement.dataset.theme || "default";
        return {
          lines: [
            text("Available themes:", []),
            ...THEMES.map((t) =>
              line(
                `  <span class="${t === current ? "cmd-name" : ""}" ` +
                  `style="color:${t === current ? "var(--color-green)" : "var(--text-primary)"}">${esc(t)}</span>` +
                  (t === current ? ' <span style="color:var(--text-muted)">(active)</span>' : ""),
              ),
            ),
            text("Usage: theme <name>", ["muted"]),
          ],
        };
      }

      if (!THEMES.includes(name)) {
        return { error: `theme: unknown theme '${name}'. Run 'theme list' to see options.` };
      }

      if (name === "default") {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = name;
      }

      try {
        localStorage.setItem(Config.STORAGE.THEME, name);
      } catch (e) {}

      return {
        lines: [
          line(
            `<span style="color:var(--color-green)">✓</span> Theme set to <span style="color:var(--color-blue)">${esc(name)}</span>`,
          ),
        ],
      };
    },
  },

  // ── scanlines ─────────────────────────────────────────────
  scanlines: {
    desc: "Toggle CRT scanlines overlay  (scanlines on | off)",
    usage: "scanlines [on|off]",
    exec(args, path, ctx, { line }) {
      const arg = (args[0] || "").toLowerCase();
      const body = document.body;
      const current = body.classList.contains("scanlines");

      let enable;
      if (arg === "on") enable = true;
      else if (arg === "off") enable = false;
      else enable = !current;

      if (enable) {
        body.classList.add("scanlines");
        try {
          localStorage.setItem(Config.STORAGE.SCANLINES, "1");
        } catch (e) {}
        return {
          lines: [
            line(
              '<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">enabled</span>. Run <code>scanlines off</code> to disable.',
            ),
          ],
        };
      }
      body.classList.remove("scanlines");
      try {
        localStorage.removeItem(Config.STORAGE.SCANLINES);
      } catch (e) {}
      return {
        lines: [
          line(
            '<span style="color:var(--color-green)">✓</span> Scanlines <span style="color:var(--color-blue)">disabled</span>.',
          ),
        ],
      };
    },
  },

  // ── init ──────────────────────────────────────────────────
  init: {
    desc: "Launch portfolio overview panels  (init --stop to close)",
    usage: "init [--stop]",
    exec(args, path, ctx, { text }) {
      if (args[0] === "--stop") {
        if (!InitPanels.isActive()) {
          return { lines: [text("init: no panels are currently open.", ["muted"])] };
        }
        InitPanels.stop(ctx.winEl);
        return null;
      }
      if (InitPanels.isActive()) {
        return {
          lines: [text("init: panels already open. Type `init --stop` to close.", ["muted"])],
        };
      }
      InitPanels.start(ctx.winEl);
      return null;
    },
  },

  // ── upload ────────────────────────────────────────────────
  upload: {
    desc: "Upload a file to the portfolio  (upload)",
    usage: "upload",
    exec(args, path, ctx, { line, text, esc }) {
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

      const CF_BASE = Config.CF_BASE;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.md";
      input.style.display = "none";
      document.body.appendChild(input);

      let pickerResolved = false;

      input.addEventListener("change", () => {
        pickerResolved = true;
        const file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) return;

        // Client-side validation (server mirrors these)
        const ext = file.name.split(".").pop().toLowerCase();
        if (!_MEDIA_EXTS.has(ext)) {
          ctx.appendLine(
            `upload: unsupported file type '.${esc(ext)}' — allowed: ${[..._MEDIA_EXTS].join(", ")}`,
            ["error"],
          );
          ctx.scrollBottom();
          return;
        }
        if (!_UPLOAD_RE.test(file.name)) {
          ctx.appendLine(
            `upload: invalid filename '${esc(file.name)}' — use letters, numbers, hyphens, underscores`,
            ["error"],
          );
          ctx.scrollBottom();
          return;
        }
        if (file.size > _UPLOAD_BYTES) {
          ctx.appendLine(
            `upload: file too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — max 5 MB`,
            ["error"],
          );
          ctx.scrollBottom();
          return;
        }

        ctx.appendLine(`Uploading ${esc(file.name)}…`, ["muted"]);
        ctx.scrollBottom();

        function onReadError(reader) {
          ctx.appendLine(`upload: file read failed — ${reader.error || "unknown error"}`, [
            "error",
          ]);
          ctx.scrollBottom();
        }

        function attachReaderHandlers(reader) {
          reader.onerror = () => onReadError(reader);
          reader.onabort = () => {
            ctx.appendLine("upload: file read aborted.", ["muted"]);
            ctx.scrollBottom();
          };
        }

        // .md files → notesWrite CF (private note)
        if (ext === "md") {
          const reader = new FileReader();
          attachReaderHandlers(reader);
          reader.onload = () => {
            const content = reader.result || "";
            cfPost(`${CF_BASE}/notesWrite`, {
              token: Auth.getToken(),
              action: "create",
              filename: file.name,
              content,
              location: "notes",
            })
              .then((data) => {
                ctx.appendHTML(
                  `<span style="color:var(--color-green)">✓</span> ` +
                    `<span style="color:var(--color-blue)">${esc(file.name)}</span> saved as private note. ` +
                    `Run <span style="color:var(--color-blue)">note cat ${esc(file.name)}</span> to view.`,
                  ["output-line"],
                );
                ctx.scrollBottom();
              })
              .catch((e) => {
                ctx.appendLine(`upload: ${e.message}`, ["error"]);
                ctx.scrollBottom();
              });
          };
          reader.readAsText(file);
          return;
        }

        // Binary files → fileUpload CF
        const reader = new FileReader();
        attachReaderHandlers(reader);
        reader.onload = () => {
          // Strip data URL prefix (data:<mime>;base64,<data>)
          const result = /** @type {string} */ (reader.result);
          const commaIdx = result.indexOf(",");
          const dataBase64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;

          cfPost(`${CF_BASE}/fileUpload`, {
            token: Auth.getToken(),
            filename: file.name,
            dataBase64,
            mimeType: file.type || MIME_BY_EXT[ext] || `image/${ext}`,
          })
            .then((data) => {
              const isPdf = ext === "pdf";
              const src = data.url;

              // Inject into in-memory FS immediately (no reload needed)
              if (isPdf) {
                FS["~"][file.name] = { __type: "file", src, mimeType: "application/pdf" };
              } else {
                if (!FS["~"].image || FS["~"].image.__type !== "dir") {
                  FS["~"].image = { __type: "dir" };
                }
                FS["~"].image[file.name] = {
                  __type: "file",
                  src,
                  mimeType: file.type || MIME_BY_EXT[ext] || `image/${ext}`,
                };
              }

              ctx.appendHTML(
                `<span style="color:var(--color-green)">✓</span> ` +
                  `<span style="color:var(--color-blue)">${esc(file.name)}</span> uploaded. ` +
                  `Run <span style="color:var(--color-blue)">cat ${isPdf ? esc(file.name) : `image/${esc(file.name)}`}</span> to view.`,
                ["output-line"],
              );
              ctx.scrollBottom();
            })
            .catch((e) => {
              ctx.appendLine(`upload: ${e.message}`, ["error"]);
              ctx.scrollBottom();
            });
        };
        reader.readAsDataURL(file);
      });

      // Cancel detection: focus returns without a change event
      window.addEventListener(
        "focus",
        () => {
          setTimeout(() => {
            if (!pickerResolved) {
              pickerResolved = true;
              if (input.parentNode) document.body.removeChild(input);
              ctx.appendLine("upload: cancelled.", ["muted"]);
              ctx.scrollBottom();
            }
          }, 500);
        },
        { once: true },
      );

      input.click();
      return { lines: [text("Opening file picker…", ["muted"])] };
    },
  },

  // ── download ──────────────────────────────────────────────
  download: {
    desc: "Download a file  (download <path>)",
    usage: "download <path>",
    exec(args, path, ctx, { line, text, esc }) {
      let target = args[0] || "";
      if (!target) {
        return {
          lines: [
            text("Usage: download <path>", ["muted"]),
            text("Examples: download resume.pdf   download images/photo.png   download about.md", [
              "muted",
            ]),
          ],
        };
      }

      // Legacy aliases
      const tLower = target.toLowerCase();
      if (tLower === "resume" || tLower === "cv") target = "resume.pdf";

      // Resolve via virtual FS first (gives "no such file" before "unsupported type")
      const resolved = fsResolve(path, target);
      if (!resolved) {
        return { error: `download: ${esc(target)}: No such file or directory` };
      }
      if (resolved.node.__type === "dir") {
        return { error: `download: ${esc(target)}: Is a directory` };
      }
      if (resolved.node.__isNote) {
        const fname = target.split("/").pop();
        return {
          error: `download: use 'note cat ${esc(fname)}' to open this note in the editor first`,
        };
      }

      const ext = target.split(".").pop().toLowerCase();
      if (!_MEDIA_EXTS.has(ext)) {
        return {
          error: `download: unsupported file type '.${esc(ext)}' — supported: ${[..._MEDIA_EXTS].join(", ")}`,
        };
      }

      const filename = target.split("/").pop();

      // Case A: src node → direct link
      if (resolved.node.src) {
        _triggerDownload(Config.CONTENT_BASE + resolved.node.src, filename, false);
        return {
          lines: [
            line(
              `<span style="color:var(--color-green)">↓</span> Downloading <span style="color:var(--color-blue)">${esc(filename)}</span>…`,
            ),
          ],
        };
      }

      // Case B: inline content node → blob
      if (typeof resolved.node.content === "string") {
        const url = URL.createObjectURL(new Blob([resolved.node.content], { type: "text/plain" }));
        _triggerDownload(url, filename, true);
        return {
          lines: [
            line(
              `<span style="color:var(--color-green)">↓</span> Downloading <span style="color:var(--color-blue)">${esc(filename)}</span>…`,
            ),
          ],
        };
      }

      return { error: `download: ${esc(target)}: file has no downloadable content` };
    },
  },

  // ── export ────────────────────────────────────────────────
  export: {
    desc: "Download this session as a .txt file",
    usage: "export",
    exec(args, path, ctx, { line }) {
      const outputEl = ctx.winEl.querySelector(".output");
      if (!outputEl) return { error: "export: could not find output element" };
      const content = outputEl.innerText || "";
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
      _triggerDownload(url, `session-${date}.txt`, true);
      return {
        lines: [
          line(
            '<span style="color:var(--color-green)">↓</span> Session exported as <span style="color:var(--color-blue)">session-' +
              date +
              ".txt</span>",
          ),
        ],
      };
    },
  },

  // ── open ──────────────────────────────────────────────────
  open: {
    desc: "Open external link (github | linkedin | email)",
    usage: "open <alias>",
    exec(args, path, ctx, { text, esc }) {
      // SECURITY BOUNDARY: Only add https:// or mailto: URLs to this object.
      const LINKS = {
        github: "https://github.com/hahahuy",
        linkedin: "https://www.linkedin.com/in/haqhuy",
        email: "mailto:quanghuyha098@gmail.com",
      };

      const alias = (args[0] || "").toLowerCase();
      if (!alias) {
        return {
          lines: [
            text("Usage: open <alias>", ["muted"]),
            text(`Available: ${Object.keys(LINKS).join("  |  ")}`, ["muted"]),
          ],
        };
      }
      if (!LINKS[alias]) {
        return { error: `open: unknown alias '${alias}'. Try: ${Object.keys(LINKS).join(", ")}` };
      }
      const url = LINKS[alias];
      // SEC-7: Runtime guard — block non-https/mailto even if LINKS is modified
      if (!url.startsWith("https://") && !url.startsWith("mailto:")) {
        return { error: `open: blocked — only https:// and mailto: links are allowed` };
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return { lines: [text(`Opening ${alias}…`, ["success"])] };
    },
  },
};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.UiCommands = UiCommands;
