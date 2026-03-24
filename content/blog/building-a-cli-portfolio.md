# Building a CLI Portfolio in Vanilla JS

**Date:** 2026-02-15
**Tags:** javascript, portfolio, css

---

You land on the page and there's no hero image. No grid of cards. No "Hi, I'm [Name] 👋" banner.

Just a blinking cursor.

You type `ls` out of instinct — and it works. A directory listing appears: `about.txt`, `projects/`, `contact.txt`. You `cd projects` and `cat` a file. The terminal prints a project description with a little ASCII divider. Somewhere along the way you forget you're looking at a portfolio.

That's the experience I was going for. Here's how I built it.

## Why a terminal?

Every portfolio I've ever built has felt like it belonged to someone adjacent to me — a cleaner, more presentable version I was performing for recruiters. The usual structure (hero, work grid, contact form) is fine, but it's a template. It doesn't have a personality.

A terminal does. It rewards curiosity. Visitors who actually poke around feel like they discovered something, not just scrolled past it. And honestly, building it was a lot more fun than arguing about which shade of blue to use for a CTA button.

## The filesystem is just an object

The whole thing runs on a plain JavaScript object that maps path strings to nodes. No routing library, no virtual filesystem package — just a nested object with a `__type` field on each node.

```js
const FS = {
  '~': {
    __type: 'dir',
    'about.txt': { __type: 'file', src: '/content/about.md' },
    'projects': {
      __type: 'dir',
      'cli-portfolio.txt': { __type: 'file', src: '/content/projects/cli-portfolio.md' },
      'other-project.txt': { __type: 'file', src: '/content/projects/other.md' },
    },
    'contact.txt': { __type: 'file', src: '/content/contact.md' },
  }
};
```

`ls` reads the keys of the current node. `cd` walks down (or up with `..`). `cat` fetches the `src` URL and renders the Markdown inline. The whole navigation model fits in about 80 lines.

What I liked about this approach is how readable it is. Want to add a new "directory"? Add a key. Want to rename something? Rename the key. There's no abstraction layer between intent and the data structure.

## Commands are just functions in a map

Each command is a plain function stored in a `COMMANDS` object keyed by name.

```js
const COMMANDS = {
  ls:    (args, cwd) => listDir(FS, cwd),
  cd:    (args, cwd) => changeDir(FS, cwd, args[0]),
  cat:   (args, cwd) => readFile(FS, cwd, args[0]),
  clear: ()         => clearTerminal(),
  whoami: ()        => print('hahuy — developer, writer, tinkerer'),
  help:  ()        => printHelp(COMMANDS),
  open:  (args)    => openExternal(args[0]),
};
```

When the user hits Enter, I split the input into a command name and arguments, look it up in `COMMANDS`, and call it. Unknown command? Print a `command not found` message just like a real shell. The whole dispatch loop is maybe 20 lines.

This made it really easy to add new commands incrementally. I added `open github` one afternoon when I realized I'd forgotten a way to link out.

## The part I underestimated: tab completion

Getting the "it just works" feel of tab completion turned out to be the most thoughtful UX problem in the whole project.

The naive version — append the only matching string on Tab — breaks the moment there are multiple matches. The shell convention is:

- **One match:** complete it immediately (ghost text that solidifies on Tab)
- **Two or more matches:** print all options below the current line, keep the partial input

Ghost text was easy: render the suggested completion in a muted color after the cursor, clear it on any keypress that isn't Tab. The multi-match dropdown was trickier. I needed to:

1. Render the matches below the prompt line without shifting input focus
2. Allow Tab to cycle through them
3. Clear the list on Escape or a non-Tab keypress

It took three rewrites to feel natural. The lesson: tab completion is one of those UX details that's invisible when it works and deeply annoying when it doesn't.

## Drag-and-drop: Pointer Events over mouse events

The terminal renders inside a draggable floating window (you can reposition it on the page). I originally used `mousedown` / `mousemove` / `mouseup`, which is the standard approach — but Pointer Events (`pointerdown`, `pointermove`, `pointerup`) are strictly better here.

One API covers mouse, touch, and stylus with the same event shape. You also get `setPointerCapture`, which keeps the drag going even if the pointer leaves the element during a fast drag. With mouse events you have to attach listeners to `document` and manage cleanup manually. Pointer Events handles it cleanly.

## Parsing Markdown client-side with Marked.js

`cat`-ing a file fetches a `.md` source and renders it in the terminal. I was expecting to need a build step for this — a bundler that converts Markdown to HTML at compile time — but Marked.js does it at runtime in about 7 KB minified.

```js
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/src/marked.min.js';

async function readFile(FS, cwd, filename) {
  const node = resolve(FS, cwd, filename);
  if (!node || node.__type !== 'file') return print(`cat: ${filename}: No such file`);
  const raw = await fetch(node.src).then(r => r.text());
  print(marked.parse(raw), { html: true });
}
```

No build step, no bundler, no config. Just import from a CDN and call `marked.parse()`. For a project this small, that tradeoff (runtime parse vs. compile-time) is totally worth it.

## Things I'd wire up next

- **`ResizeObserver` for window clamping** — right now if you resize the viewport, the terminal window can drift off-screen. A `ResizeObserver` on the viewport would clamp the position back into bounds automatically.
- **`man` command** — `help` prints a list of commands, but `man ls` could print a proper description with usage examples. More realistic, and useful if you're showing the portfolio to someone unfamiliar with terminals.
- **Multi-window support** — a keyboard shortcut (`Ctrl+Alt+T`, naturally) to open a second terminal instance. Each would maintain its own `cwd` state.
- **Command history persistence** — `localStorage` the history array so Up-arrow still works on page reload.

## Was it worth it?

Yeah. Not because it's impressive — plenty of people have built terminal portfolios. But because it forced me to think about UX details I normally outsource to a component library. Tab completion, drag semantics, keyboard handling, focus management — when you own the whole stack in 400 lines of vanilla JS, there's nowhere to hide.

And when someone types `whoami` and gets a response back, it feels like a conversation. That's the part that's hard to get with a card grid.

---

Source is linked inside — just type `open github`.

