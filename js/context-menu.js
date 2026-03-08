/* ============================================================
   context-menu.js — ContextMenu IIFE
   Right-click context menu on the #desktop backdrop.
   ============================================================ */

'use strict';

const ContextMenu = (() => {

  let menuEl = null;

  // ── init ──────────────────────────────────────────────────
  function init() {
    // Build menu element
    menuEl = document.createElement('ul');
    menuEl.id        = 'context-menu';
    menuEl.setAttribute('role', 'menu');
    menuEl.hidden    = true;

    const items = [
      { label: 'New Window',       action: () => WindowManager.createWindow() },
      { label: 'Close All Windows', action: () => WindowManager.closeAll() },
    ];

    items.forEach(({ label, action }) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.tabIndex = -1;
      li.textContent = label;
      li.addEventListener('click', () => {
        hide();
        action();
      });
      menuEl.appendChild(li);
    });

    document.body.appendChild(menuEl);

    // Show on right-click on desktop (not inside a terminal window)
    document.getElementById('desktop').addEventListener('contextmenu', onContextMenu);

    // Dismiss on click, Escape, or second contextmenu
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }

  // ── onContextMenu ─────────────────────────────────────────
  function onContextMenu(e) {
    // If right-click is inside a terminal window, do nothing (let browser default or skip)
    if (e.target.closest('.terminal-window')) return;

    e.preventDefault();
    show(e.clientX, e.clientY);
  }

  // ── show ──────────────────────────────────────────────────
  function show(x, y) {
    menuEl.hidden = false;

    // Clamp to viewport
    const menuW = menuEl.offsetWidth  || 180;
    const menuH = menuEl.offsetHeight || 80;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;

    const left = Math.min(x, vw - menuW - 4);
    const top  = Math.min(y, vh - menuH - 4);

    menuEl.style.left = Math.max(0, left) + 'px';
    menuEl.style.top  = Math.max(0, top)  + 'px';
  }

  // ── hide ──────────────────────────────────────────────────
  function hide() {
    if (menuEl) menuEl.hidden = true;
  }

  function onDocClick(e) {
    if (menuEl && !menuEl.hidden && !menuEl.contains(e.target)) {
      hide();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') hide();
  }

  return { init };

})();
