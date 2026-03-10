# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- ClaudeVibeCodeKit -->
## ClaudeVibeCodeKit

### Planning
When planning complex tasks:
1. Read .claude/docs/plan-execution-guide.md for format guide
2. Use planning-agent for parallel execution optimization
3. Output plan according to .claude/schemas/plan-schema.json

### Available Commands
- /research - Deep web research
- /meeting-notes - Live meeting notes
- /changelog - Generate changelog
- /onboard - Developer onboarding
- /handoff - Create handoff document for conversation transition
- /continue - Resume work from a handoff document
- /watzup - Check current project status
- /social-media-post - Social content workflow
<!-- /ClaudeVibeCodeKit -->

---

## Project: 4FF-HH — Terminal Portfolio

A browser-based portfolio website styled as an interactive Unix terminal emulator. Live at **hahuy.site** (deployed via GitHub Pages). Zero build tools, zero npm dependencies — pure vanilla HTML/CSS/JS with one CDN import (`marked.js` for Markdown).

## Development

No build step. Open `index.html` directly in a browser (`file://` protocol works). Edit any `.js` or `.css` file and refresh.

**Run tests**: Open `tests/index.html` in a browser. The test runner is self-contained and displays pass/fail in a styled table.

**Deploy**: Push to `main` — GitHub Actions (`.github/workflows/deploy.yml`) auto-publishes the repo to `gh-pages` with the `hahuy.site` CNAME. No build step in CI either.

## Architecture

### Script Load Order (order is critical — no bundler)
```
marked.js (CDN)
→ filesystem.js   (FS global, path helpers)
→ autocomplete.js (createAutocomplete factory)
→ commands.js     (Commands singleton)
→ init-panels.js  (InitPanels singleton)
→ terminal.js     (createTerminal factory — depends on all above)
→ draggable.js    (Draggable singleton — auto-inits on DOMContentLoaded)
→ contextmenu.js  (ContextMenu singleton — auto-inits on DOMContentLoaded)
```

### Module Patterns
Two distinct patterns are used — don't mix them up:
- **Singletons (IIFE)**: `Commands`, `InitPanels`, `Draggable`, `ContextMenu`, `FS` globals — one instance for the whole page.
- **Factories**: `createTerminal(winEl)` and `createAutocomplete(inputEl, ghostEl, listEl)` — each call returns an independent instance, enabling multi-window support.

### Key Modules

**`filesystem.js`** — Exposes the `FS` object (plain JS tree) and these globals:
- `fsResolve(currentPath, arg)` → `{node, path}` or `null`
- `fsListDir(dirNode)` → `[{name, type}]`
- `fsReadFile(fileNode)` → `Promise<string>`
- `fsEntriesAt(pathArr)` → `[string]` (for autocomplete)
- `loadBlogManifest()` → `Promise<void>` (called once by `terminal.js` on boot)

FS nodes use `__type: 'dir'|'file'`. File nodes have either `src: '/content/file.md'` (fetched at read time) or `content: '...'` (inline). The `BASE` constant at the top of `filesystem.js` must be `''` for the custom domain and `'/4FF-HH'` for a GitHub Pages subpath deployment.

**`commands.js`** — `Commands.execute(cmd, args, path, ctx)` dispatches to the registry. `Commands.names()` returns all command names (used by autocomplete). Each registry entry:
```js
mycommand: {
  desc: "Shown in help output",
  exec(args, path, ctx) { ... }
}
```
The `ctx` object passed to `exec`: `{ appendMarkdown, appendLine, scrollBottom, winEl }`. Use `ctx` for async commands that need to write output after returning. Available line helpers inside `commands.js`: `line(html, classes)` (raw HTML) and `text(str, classes)` (auto-escaped).

**Return values from `exec`:**
| Return | Effect |
|--------|--------|
| `null` | Silent, no output |
| `{ lines: [...] }` | Array of line objects from `line()`/`text()` |
| `{ error: 'msg' }` | Red error line |
| `{ markdown: '...' }` | Rendered via `marked.parse()` |
| `{ newPath: ['~', 'dir'] }` | Updates `currentPath` in terminal |
| `{ clear: true }` | Clears all output |
| `{ quit: true }` | Closes the terminal window |

**`terminal.js`** — `createTerminal(winEl)` returns an instance with `init()` (async, call once), `appendLine()`, `appendHTML()`, `appendMarkdown()`, `currentPath` (get/set array), `getCwd()` (string), `clearOutput()`, `scrollBottom()`, `escapeHtml()`. History capped at 200 entries. An idle hint ("Type `help`...") fires after 20 s of inactivity, but only in the first terminal window after the first command.

**`autocomplete.js`** — `createAutocomplete(inputEl, ghostEl, listEl)`. Completes command names (first token) or FS entries (subsequent tokens). Tab cycles through multiple matches.

**`draggable.js`** — `Draggable.init(winEl)` wires 8 resize handles + titlebar drag to a window. `Draggable.initAll()` runs on DOMContentLoaded for the initial window. New windows cloned by `contextmenu.js` must call `Draggable.init()` manually. Double-clicking the titlebar snaps the window to viewport center.

**`init-panels.js`** — `InitPanels.start(callerWin)` / `InitPanels.stop(callerWin)`. Spawned by `init` / `init --stop`. Closes all other windows, resizes the caller terminal to the bottom-left, and adds two read-only info panels fetching content from `content/shorter-about.md`, `content/contact.md`, `content/skills.md`, `content/projects.md`. Panels are hidden entirely on mobile (≤600px).

**`contextmenu.js`** — Right-click on the page background (outside any terminal window) opens the menu. New windows are cloned from a clean snapshot of the original terminal taken at `init()` time — IDs are stripped from the clone to avoid collisions.

### CSS Layers
| File | Scope |
|------|-------|
| `style.css` | Window chrome, layout, all CSS custom properties (colors, font, sizing) |
| `terminal.css` | Prompt, input, output lines, `.boot-line` fade-in, cursor blink |
| `markdown.css` | Typography scoped to `.md-render` — only affects rendered Markdown |
| `contextmenu.css` | Right-click menu |
| `init-panels.css` | Info panel layout; `display:none !important` on mobile |

All colors are CSS custom properties on `:root` in `style.css` (e.g. `--color-green`, `--text-muted`, `--bg-window`). Use those variables in any new CSS rather than hardcoding hex values.

### Content
All user-visible text lives in `content/*.md`, fetched at runtime. Blog posts live in `content/blog/` and are indexed by `content/blog/manifest.json` (array of `{file, title, date}`).

Any element with a `data-cmd` attribute is made clickable by `terminal.js` — clicking it runs that command. Used by `ls` to make directory entries interactive.

## Common Tasks

### Add a new command
1. Add an entry to the `registry` object in `js/commands.js`:
   ```js
   mycommand: {
     desc: "Short description shown in help",
     exec(args, path, ctx) {
       return { lines: [text("Hello world")] };
     }
   }
   ```
2. For async commands (e.g. fetching content), use `ctx` to write output after returning:
   ```js
   exec(args, path, ctx) {
     fetch('/content/file.md').then(r => r.text()).then(md => {
       ctx.appendMarkdown(md);
       ctx.scrollBottom();
     });
     return { lines: [text("Loading...", ["muted"])] };
   }
   ```

### Add a new content file
1. Create `content/myfile.md`.
2. Add a node to the FS tree in `js/filesystem.js`:
   ```js
   "myfile.txt": { __type: "file", src: "/content/myfile.md" }
   ```
3. Users can now `cat myfile.txt`.

### Add a blog post
1. Create `content/blog/my-post.md`.
2. Append to `content/blog/manifest.json`:
   ```json
   { "file": "my-post.md", "title": "Post Title", "date": "YYYY-MM-DD" }
   ```
The manifest is fetched once on boot; `loadBlogManifest()` auto-generates a `blog/index.txt` listing and creates `.txt` aliases for each post.

## Keyboard Shortcuts (terminal)
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate command history |
| `Tab` | Autocomplete (cycle on repeated press) |
| `Ctrl+C` | Cancel current input |
| `Ctrl+L` | Clear output |
| `Enter` | Execute command |
| `Double-click titlebar` | Snap window to center |

## Responsive Breakpoints
- **≤600px** (mobile): Fullscreen terminal, drag/resize disabled, info panels hidden.
- **601–900px** (tablet): Drag works, resize handles hidden.
- **≥901px** (desktop): Full drag + 8-point resize.

## Known Issues
- `LINKS.email` in `js/commands.js` is a placeholder (`hahahuy@example.com`) — update before launch.
- `BASE` in `js/filesystem.js` is `''` (correct for `hahuy.site`); change to `'/4FF-HH'` only if deploying to a GitHub Pages subpath.
- The "Normal Portfolio" link in `contextmenu.js` has a typo in the URL path (`porfoliosite`).

---

## Secrets & Environment

### Files
- `functions/.env` — holds all secrets. **Never commit this file.**
- Gitignored in both `functions/.gitignore` and root `.gitignore`.
- Edit only in VS Code or terminal — some Windows editors (Notepad) corrupt it with spaced-out characters like `W E B H O O K _ S E C R E T`.

### The 3 secrets
| Key | What it is | Sensitivity |
|-----|-----------|-------------|
| `TELEGRAM_TOKEN` | Telegram bot token | High — rotate if leaked |
| `TELEGRAM_CHAT_ID` | Owner's Telegram user ID | Medium |
| `WEBHOOK_SECRET` | Webhook signature token | High — prevents fake owner replies |

`WEBHOOK_SECRET` is optional at runtime (the check is skipped when blank) but **must be set before the site URL is shared publicly**.

### Generate & register WEBHOOK_SECRET (one-time setup)
```bash
# 1. Generate
openssl rand -hex 32

# 2. Paste into functions/.env:
#    WEBHOOK_SECRET=<output>

# 3. Deploy
firebase deploy --only functions

# 4. Register with Telegram (replace TOKEN and SECRET)
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook\
?url=https://asia-southeast1-hahuy-portfolio.cloudfunctions.net/telegramWebhook\
&secret_token=<WEBHOOK_SECRET>"
```
If the secret is ever rotated, **step 4 must be re-run** — Telegram caches the old token.

---

## Deploy Checklist

### Frontend (GitHub Pages)
Push to `main` → GitHub Actions auto-deploys. No manual step needed.

### Cloud Functions
Run this checklist every time `functions/index.js` changes:

```
[ ] functions/.env exists with all 3 keys filled (no blank WEBHOOK_SECRET)
[ ] firebase deploy --only functions
[ ] Firebase Console → Functions → check logs for startup errors
[ ] If WEBHOOK_SECRET changed → re-run the setWebhook curl command above
```

### First-time / one-off setup
```
[ ] Add content/resume.pdf  (required for `download resume` command)
[ ] Fix contextmenu.js line 23 typo: porfoliosite → correct URL
[ ] Enable Cloud Scheduler API (required for cleanupStaleSessions cron):
    gcloud services enable cloudscheduler.googleapis.com --project hahuy-portfolio
[ ] Set Firebase Realtime Database rules (reject messages to sessions > 2h old)
[ ] Generate + register WEBHOOK_SECRET (see above)
```

### Tests
```
[ ] Browser tests:  open tests/index.html   (covers FS, Commands, Terminal, MessagePanel stub)
[ ] Backend tests:  python functions/test_logic.py   (41 tests — logic only, no Firebase needed)
```
