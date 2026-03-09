/* ============================================================
   draggable.js — Drag + Resize for all .terminal-window elements
   ============================================================ */

'use strict';

const Draggable = (() => {

  const MIN_W = 340;
  const MIN_H = 220;

  // Edge names that get resize handles
  const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  // ── Utility ───────────────────────────────────────────────
  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /** Read the current CSS translate of an element */
  function getTranslate(el) {
    const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  }

  /**
   * Clamp a translate so the window stays inside the viewport.
   * el must already have its desired width/height set.
   */
  function clampTranslate(el, tx, ty) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Natural (un-translated) edges
    const naturalLeft   = rect.left   - tx;
    const naturalTop    = rect.top    - ty;
    const naturalRight  = naturalLeft + rect.width;
    const naturalBottom = naturalTop  + rect.height;

    return {
      x: clamp(tx, -naturalLeft, vw - naturalRight),
      y: clamp(ty, -naturalTop,  vh - naturalBottom),
    };
  }

  // ── Bring-to-front ────────────────────────────────────────
  let zCounter = 20;

  function bringToFront(el) {
    el.style.zIndex = ++zCounter;
  }

  // ── Drag logic ────────────────────────────────────────────
  function initDrag(win, handle) {
    let dragging = false;
    let startX, startY, startTX, startTY;

    handle.addEventListener('pointerdown', e => {
      if (window.innerWidth <= 600) return;
      // Ignore clicks on the traffic-light dots
      if (e.target.classList.contains('dot')) return;

      dragging = true;
      handle.setPointerCapture(e.pointerId);
      win.classList.add('dragging');
      bringToFront(win);

      startX = e.clientX;
      startY = e.clientY;
      const t = getTranslate(win);
      startTX = t.x;
      startTY = t.y;
      e.preventDefault();
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const { x, y } = clampTranslate(win, startTX + dx, startTY + dy);
      win.style.transform = `translate(${x}px, ${y}px)`;
    });

    const stopDrag = () => {
      if (!dragging) return;
      dragging = false;
      win.classList.remove('dragging');
    };
    handle.addEventListener('pointerup',     stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    // Double-click titlebar → snap to center
    handle.addEventListener('dblclick', () => {
      win.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
      win.style.transform  = 'translate(0, 0)';
      win.addEventListener('transitionend', () => {
        win.style.transition = '';
      }, { once: true });
    });
  }

  // ── Resize logic ──────────────────────────────────────────
  function initResize(win) {

    // Inject edge handles into the window element
    EDGES.forEach(edge => {
      const div = document.createElement('div');
      div.className = `resize-handle resize-${edge}`;
      div.dataset.edge = edge;
      win.appendChild(div);
    });

    let resizing   = false;
    let edge       = '';
    let startX, startY;
    let startW, startH;    // px dimensions at drag start
    let startTX, startTY;  // translate at drag start
    let startL, startT;    // getBoundingClientRect left/top at drag start

    win.addEventListener('pointerdown', e => {
      const handle = e.target.closest('.resize-handle');
      if (!handle) return;
      if (window.innerWidth <= 600) return;

      edge = handle.dataset.edge;
      resizing = true;
      win.setPointerCapture(e.pointerId);
      win.classList.add('resizing');
      bringToFront(win);

      startX = e.clientX;
      startY = e.clientY;

      const rect = win.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startL = rect.left;
      startT = rect.top;

      const t = getTranslate(win);
      startTX = t.x;
      startTY = t.y;

      e.preventDefault();
      e.stopPropagation();
    });

    win.addEventListener('pointermove', e => {
      if (!resizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newW  = startW;
      let newH  = startH;
      let newTX = startTX;
      let newTY = startTY;

      // East: stretch/shrink right edge, left edge stays put (translate unchanged)
      if (edge.includes('e')) {
        newW = Math.max(MIN_W, startW + dx);
      }

      // West: stretch/shrink left edge, right edge stays put (translate moves with it)
      if (edge.includes('w')) {
        const delta = clamp(dx, startW - MIN_W, Infinity);  // how far left edge moved right (+shrink)
        newW  = startW - delta;                              // shrink when delta > 0
        newTX = startTX + delta;                             // shift window right by same amount
      }

      // South: stretch/shrink bottom edge, top edge stays put (translate unchanged)
      if (edge.includes('s')) {
        newH = Math.max(MIN_H, startH + dy);
      }

      // North: stretch/shrink top edge, bottom edge stays put (translate moves with it)
      if (edge.includes('n')) {
        const delta = clamp(dy, startH - MIN_H, Infinity);  // how far top edge moved down (+shrink)
        newH  = startH - delta;
        newTY = startTY + delta;
      }

      win.style.width     = `${newW}px`;
      win.style.height    = `${newH}px`;
      // No viewport clamping here — drag handles that; clamping resize caused opposite-edge jump
      win.style.transform = `translate(${newTX}px, ${newTY}px)`;
    });

    const stopResize = () => {
      if (!resizing) return;
      resizing = false;
      win.classList.remove('resizing');
    };
    win.addEventListener('pointerup',     stopResize);
    win.addEventListener('pointercancel', stopResize);
  }

  // ── Public: attach drag + resize to one window element ────
  function init(winEl) {
    const titlebar = winEl.querySelector('.titlebar');
    if (!titlebar) return;

    // Remove fixed sizing so the window can be freely resized
    // (initial dimensions stay from CSS; after that JS owns them)
    initDrag(winEl, titlebar);
    initResize(winEl);

    // Bring to front on any click inside
    winEl.addEventListener('pointerdown', () => bringToFront(winEl), { capture: true });
  }

  // ── Boot: attach to every window present at load ──────────
  function initAll() {
    document.querySelectorAll('.terminal-window').forEach(init);
  }

  return { init, initAll };

})();

document.addEventListener('DOMContentLoaded', () => Draggable.initAll());
