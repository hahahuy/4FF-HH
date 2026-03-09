# Building a CLI Portfolio in Vanilla JS

**Date:** 2026-02-15
**Tags:** javascript, portfolio, css

---

Most portfolios look the same. A hero section, a grid of projects, a contact form. I wanted something that felt more *me* — so I built a terminal.

## The core idea

Everything is a command. `whoami`, `ls`, `cat about.txt`. Navigation feels like navigating a real filesystem, except the filesystem is a plain JavaScript object.

```js
const FS = {
  '~': {
    __type: 'dir',
    'about.txt': { __type: 'file', src: '/content/about.md' },
    'projects':  { __type: 'dir', ... },
  }
};
```

## What surprised me

**Tab completion is tricky.** Not hard — but you need to handle the "cycle through matches" UX carefully, or it feels broken. Ghost text for the first suggestion, dropdown for multiples.

**Drag-and-drop with Pointer Events** is smoother than mouse events. One API handles mouse, touch, and stylus.

**Marked.js** is remarkably small for what it does. Parsing Markdown client-side with no build step is underrated.

## What I'd do differently

- Use a `ResizeObserver` to clamp the window position when the viewport resizes
- Add a `man` command for detailed help on each command
- Keyboard shortcut to open a new terminal window

---

Check out the source: `open github`
