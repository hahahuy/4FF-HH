/* ============================================================
   draggable.js — Pointer Events drag for terminal window
   ============================================================ */

(function () {
  'use strict';

  const win    = document.getElementById('terminalWindow');
  const handle = document.getElementById('titlebar');

  let isDragging = false;
  let startX, startY;   // pointer position at drag start
  let startTX, startTY; // translateX/Y at drag start

  // Parse current transform translate values
  function getTranslate() {
    const style = window.getComputedStyle(win);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return { x: matrix.m41, y: matrix.m42 };
  }

  // Clamp window inside viewport
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function clampToViewport(tx, ty) {
    const rect = win.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // How far the window extends from its translated center
    const left   = rect.left   - tx;   // natural left edge (without translate)
    const top    = rect.top    - ty;
    const right  = left + rect.width;
    const bottom = top  + rect.height;

    const minTX = -left;                 // can't go further left than viewport edge
    const maxTX = vw - right;            // can't go further right than viewport edge
    const minTY = -top;
    const maxTY = vh - bottom;

    return {
      x: clamp(tx, minTX, maxTX),
      y: clamp(ty, minTY, maxTY),
    };
  }

  // ── Pointer Down ────────────────────────────────────────────
  handle.addEventListener('pointerdown', (e) => {
    // Ignore on mobile (CSS disables transform)
    if (window.innerWidth <= 600) return;

    isDragging = true;
    handle.setPointerCapture(e.pointerId);
    win.classList.add('dragging');

    startX = e.clientX;
    startY = e.clientY;

    const t = getTranslate();
    startTX = t.x;
    startTY = t.y;

    e.preventDefault();
  });

  // ── Pointer Move ────────────────────────────────────────────
  handle.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const rawTX = startTX + dx;
    const rawTY = startTY + dy;

    const { x, y } = clampToViewport(rawTX, rawTY);
    win.style.transform = `translate(${x}px, ${y}px)`;
  });

  // ── Pointer Up ──────────────────────────────────────────────
  handle.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    win.classList.remove('dragging');
  });

  handle.addEventListener('pointercancel', (e) => {
    isDragging = false;
    win.classList.remove('dragging');
  });

  // ── Double-click → Snap to center ───────────────────────────
  handle.addEventListener('dblclick', () => {
    win.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
    win.style.transform  = 'translate(0, 0)';

    // Re-enable CSS transition removal after snap
    win.addEventListener('transitionend', () => {
      win.style.transition = '';
    }, { once: true });
  });

}());
