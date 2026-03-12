/**
 * tests/interactions.test.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Drag, resize, and context-menu tests.
 *
 * Key design constraints
 * ─────────────────────
 * • draggable.js / contextmenu.js assign to App.Draggable / App.ContextMenu,
 *   NOT to globalThis.  Access them via global.App.*.
 * • DOMContentLoaded has already fired by the time setup.js runs, so the
 *   document.addEventListener("DOMContentLoaded", …) listeners in these files
 *   never fire.  We call App.ContextMenu.init() manually once.
 * • requestAnimationFrame is made synchronous so pinToScreen() and show()
 *   resolve instantly.  This means after Draggable.init(win) the window has
 *   position "0px/0px" (jsdom getBoundingClientRect() → all-zeros by default).
 * • Resize tests mock getBoundingClientRect before init() so startW/startH
 *   are non-zero (otherwise MIN_W=340/MIN_H=220 clamp fires immediately).
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function loadModule(relPath) {
  const src = readFileSync(join(ROOT, relPath), "utf8");
  // eslint-disable-next-line no-new-func
  new Function(src)();
}

// ── One-time environment setup ────────────────────────────────────────────────
beforeAll(() => {
  // jsdom omits pointer-capture APIs
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();

  // Make rAF synchronous — afterLayout = rAF(rAF(fn)) so two nested calls,
  // both resolve immediately.
  let _id = 0;
  global.requestAnimationFrame = (fn) => {
    fn(performance.now());
    return ++_id;
  };
  global.cancelAnimationFrame = vi.fn();

  // Desktop viewport: wider than both breakpoints (mobile=600, tablet=900)
  Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, writable: true, configurable: true });

  // Load modules — App / Config / afterLayout already on globalThis from setup.js
  loadModule("js/draggable.js"); // → App.Draggable
  loadModule("js/contextmenu.js"); // → App.ContextMenu

  // DOMContentLoaded already fired; call init() manually so event listeners
  // for contextmenu/click/keydown are registered on document.
  App.ContextMenu.init();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a minimal .terminal-window with .titlebar and attach to body.
 * Optionally mock getBoundingClientRect so resize can start with a real size.
 */
function makeWindow({ w = 0, h = 0 } = {}) {
  const win = document.createElement("div");
  win.className = "terminal-window";

  const tb = document.createElement("div");
  tb.className = "titlebar";
  win.appendChild(tb);

  if (w && h) {
    win.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: w,
      bottom: h,
      width: w,
      height: h,
    });
  }

  document.body.appendChild(win);
  return win;
}

/** Build a PointerEvent or fall back to MouseEvent for older jsdom builds. */
function ptr(type, { x = 0, y = 0, id = 1 } = {}) {
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id };
  try {
    return new PointerEvent(type, init);
  } catch {
    const e = new MouseEvent(type, init);
    Object.defineProperty(e, "pointerId", { value: id });
    return e;
  }
}

// ── Draggable: resize handles created on init ─────────────────────────────────
describe("Draggable — resize handles", () => {
  let win;
  beforeEach(() => {
    win = makeWindow();
    App.Draggable.init(win);
  });
  afterEach(() => win.remove());

  it("adds exactly 8 resize handles", () => {
    expect(win.querySelectorAll(".resize-handle").length).toBe(8);
  });

  it("creates one handle per edge direction", () => {
    for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      const el = win.querySelector(`.resize-${edge}`);
      expect(el, `.resize-${edge} missing`).not.toBeNull();
      expect(el.dataset.edge).toBe(edge);
    }
  });

  it("every handle has the base resize-handle class", () => {
    win
      .querySelectorAll("[data-edge]")
      .forEach((h) => expect(h.classList.contains("resize-handle")).toBe(true));
  });
});

// ── Draggable: drag via titlebar ──────────────────────────────────────────────
describe("Draggable — drag via titlebar", () => {
  let win;
  beforeEach(() => {
    win = makeWindow();
    App.Draggable.init(win);
    // After init, pinToScreen sets left/top to "0px" (jsdom rect = 0,0,0,0)
  });
  afterEach(() => win.remove());

  it("pointerdown on titlebar adds .dragging class", () => {
    const tb = win.querySelector(".titlebar");
    tb.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    expect(win.classList.contains("dragging")).toBe(true);
  });

  it("pointermove after pointerdown translates the window", () => {
    // start=0,0 (pinToScreen); pointerdown at 100,80 → move to 200,130 (+100,+50)
    const tb = win.querySelector(".titlebar");
    tb.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    tb.dispatchEvent(ptr("pointermove", { x: 200, y: 130 }));

    expect(win.style.left).toBe("100px");
    expect(win.style.top).toBe("50px");
  });

  it("pointerup removes .dragging class", () => {
    const tb = win.querySelector(".titlebar");
    tb.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    tb.dispatchEvent(ptr("pointerup", { x: 100, y: 80 }));
    expect(win.classList.contains("dragging")).toBe(false);
  });

  it("does NOT drag when clicking a .dot inside the titlebar", () => {
    const tb = win.querySelector(".titlebar");
    const dot = document.createElement("span");
    dot.className = "dot";
    tb.appendChild(dot);

    // pointerdown on the dot — the handler returns early
    dot.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    tb.dispatchEvent(ptr("pointermove", { x: 200, y: 160 }));

    // window should NOT have been dragged
    expect(win.classList.contains("dragging")).toBe(false);
    dot.remove();
  });

  it("does NOT drag when clicking a .resize-handle (resize takes priority)", () => {
    const tb = win.querySelector(".titlebar");
    const handle = win.querySelector(".resize-n");

    handle.dispatchEvent(ptr("pointerdown", { x: 100, y: 0 }));
    tb.dispatchEvent(ptr("pointermove", { x: 200, y: 50 }));

    // Drag listener ignores events from resize handles
    expect(win.classList.contains("dragging")).toBe(false);
  });
});

// ── Draggable: double-click snaps to center ───────────────────────────────────
describe("Draggable — double-click titlebar snaps to center", () => {
  let win;
  beforeEach(() => {
    // Give the window a real size via getBoundingClientRect mock
    win = makeWindow({ w: 860, h: 640 });
    App.Draggable.init(win);
    // pinToScreen now reads width=860/height=640 from the mock
  });
  afterEach(() => win.remove());

  it("sets left/top to viewport-centred position on dblclick", () => {
    const tb = win.querySelector(".titlebar");
    tb.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    // Expected: (1280 - 860) / 2 = 210,  (900 - 640) / 2 = 130
    expect(win.style.left).toBe("210px");
    expect(win.style.top).toBe("130px");
  });
});

// ── Draggable: resize ─────────────────────────────────────────────────────────
describe("Draggable — resize via handles", () => {
  let win;
  beforeEach(() => {
    // Provide a real rect so getPos() returns startW=860 / startH=640
    win = makeWindow({ w: 860, h: 640 });
    App.Draggable.init(win);
  });
  afterEach(() => win.remove());

  it("pointerdown on .resize-se adds .resizing class", () => {
    const se = win.querySelector(".resize-se");
    se.dispatchEvent(ptr("pointerdown", { x: 860, y: 640 }));
    expect(win.classList.contains("resizing")).toBe(true);
  });

  it("pointermove on .resize-se grows width and height", () => {
    const se = win.querySelector(".resize-se");
    se.dispatchEvent(ptr("pointerdown", { x: 860, y: 640 })); // startW=860, startH=640
    win.dispatchEvent(ptr("pointermove", { x: 910, y: 680 })); // dx=+50, dy=+40

    expect(win.style.width).toBe("910px"); // 860 + 50
    expect(win.style.height).toBe("680px"); // 640 + 40
  });

  it("pointermove on .resize-nw shrinks width and height from top-left", () => {
    const nw = win.querySelector(".resize-nw");
    nw.dispatchEvent(ptr("pointerdown", { x: 0, y: 0 })); // startW=860, startH=640
    win.dispatchEvent(ptr("pointermove", { x: 50, y: 40 })); // dx=+50, dy=+40 (shrinking nw)

    expect(win.style.width).toBe("810px"); // 860 - 50
    expect(win.style.height).toBe("600px"); // 640 - 40
  });

  it("pointerup removes .resizing class", () => {
    const se = win.querySelector(".resize-se");
    se.dispatchEvent(ptr("pointerdown", { x: 860, y: 640 }));
    win.dispatchEvent(ptr("pointerup", { x: 860, y: 640 }));
    expect(win.classList.contains("resizing")).toBe(false);
  });

  it("resize does not shrink below MIN_W=340 / MIN_H=220", () => {
    const nw = win.querySelector(".resize-nw");
    nw.dispatchEvent(ptr("pointerdown", { x: 0, y: 0 }));
    win.dispatchEvent(ptr("pointermove", { x: 2000, y: 2000 })); // try to shrink massively

    const gotW = Number.parseFloat(win.style.width || "860");
    const gotH = Number.parseFloat(win.style.height || "640");
    expect(gotW).toBeGreaterThanOrEqual(340);
    expect(gotH).toBeGreaterThanOrEqual(220);
  });
});

// ── Draggable: initAll ────────────────────────────────────────────────────────
describe("Draggable.initAll", () => {
  it("initialises resize handles on every .terminal-window element", () => {
    const w1 = makeWindow();
    const w2 = makeWindow();

    App.Draggable.initAll();

    // Each window gets 8 handles (initAll calls init() on each)
    expect(w1.querySelectorAll(".resize-handle").length).toBeGreaterThanOrEqual(8);
    expect(w2.querySelectorAll(".resize-handle").length).toBeGreaterThanOrEqual(8);

    w1.remove();
    w2.remove();
  });
});

// ── ContextMenu ───────────────────────────────────────────────────────────────
describe("ContextMenu — right-click on background", () => {
  // Reset menu visibility between tests WITHOUT removing the node.
  // If we remove the node, the ContextMenu closure still holds the detached
  // reference and skips build() on the next show() call → getElementById = null.
  beforeEach(() => {
    document.getElementById("bg-context-menu")?.classList.remove("visible");
  });

  it("right-click on a non-terminal element shows the menu", () => {
    const el = document.createElement("div");
    el.className = "backdrop";
    document.body.appendChild(el);

    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 300,
      }),
    );

    // rAF is synchronous → .visible is added immediately
    const menu = document.getElementById("bg-context-menu");
    expect(menu, "#bg-context-menu element must exist").not.toBeNull();
    expect(menu.classList.contains("visible"), "menu must have .visible").toBe(true);

    el.remove();
  });

  it("right-click INSIDE a .terminal-window does NOT show the menu", () => {
    const win = makeWindow();

    win.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 300,
      }),
    );

    const menu = document.getElementById("bg-context-menu");
    // Either no menu at all, or not visible
    expect(menu?.classList.contains("visible") ?? false).toBe(false);

    win.remove();
  });

  it("context menu contains expected action items", () => {
    const el = document.createElement("div");
    el.className = "backdrop";
    document.body.appendChild(el);

    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      }),
    );

    const menu = document.getElementById("bg-context-menu");
    const items = menu?.querySelectorAll(".ctx-item");
    expect(items?.length ?? 0, "at least 2 .ctx-item elements").toBeGreaterThanOrEqual(2);

    const text = menu?.textContent ?? "";
    expect(text).toContain("new terminal");
    expect(text).toContain("Close");

    el.remove();
  });

  it("Escape key hides the visible menu", () => {
    const el = document.createElement("div");
    el.className = "backdrop";
    document.body.appendChild(el);

    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      }),
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    const menu = document.getElementById("bg-context-menu");
    expect(menu?.classList.contains("visible") ?? false).toBe(false);

    el.remove();
  });

  it("clicking outside the menu hides it", () => {
    const el = document.createElement("div");
    el.className = "backdrop";
    document.body.appendChild(el);

    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
      }),
    );

    // Click somewhere not inside the menu
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const menu = document.getElementById("bg-context-menu");
    expect(menu?.classList.contains("visible") ?? false).toBe(false);

    el.remove();
  });
});
