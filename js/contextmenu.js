/* ============================================================
   contextmenu.js — Background right-click context menu
   ============================================================ */

'use strict';

const ContextMenu = (() => {

  let menuEl = null;

  // ── Build DOM ─────────────────────────────────────────────
  function build() {
    menuEl = document.createElement('div');
    menuEl.id = 'bg-context-menu';
    menuEl.setAttribute('role', 'menu');
    menuEl.setAttribute('aria-label', 'Background options');

    const items = [
      {
        icon: '⬡',
        label: 'Normal Portfolio',
        action: () => window.location.href('https://hahahuy.github.io/porfoliosite/', '_blank', 'noopener,noreferrer'),
      },
      { separator: true },
      {
        icon: '✕',
        label: 'Close all terminal windows',
        action: closeAllWindows,
      },
      {
        icon: '+',
        label: 'Create new terminal window',
        action: createNewWindow,
      },
    ];

    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'ctx-separator';
        menuEl.appendChild(sep);
        return;
      }

      const el = document.createElement('div');
      el.className = 'ctx-item';
      el.setAttribute('role', 'menuitem');
      el.setAttribute('tabindex', '-1');
      el.innerHTML =
        `<span class="ctx-icon">${item.icon}</span>` +
        `<span>${item.label}</span>`;

      el.addEventListener('click', () => {
        hide();
        item.action();
      });

      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          hide();
          item.action();
        }
      });

      menuEl.appendChild(el);
    });

    document.body.appendChild(menuEl);
  }

  // ── Show / hide ───────────────────────────────────────────
  function show(x, y) {
    if (!menuEl) build();

    // Reset then make visible to measure
    menuEl.classList.remove('visible');
    menuEl.style.left = '0px';
    menuEl.style.top  = '0px';

    // Position — clamp to viewport
    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mw = menuEl.offsetWidth  || 210;
      const mh = menuEl.offsetHeight || 120;

      menuEl.style.left = `${Math.min(x, vw - mw - 8)}px`;
      menuEl.style.top  = `${Math.min(y, vh - mh - 8)}px`;
      menuEl.classList.add('visible');

      // Focus first item for keyboard nav
      const first = menuEl.querySelector('.ctx-item');
      if (first) first.focus();
    });
  }

  function hide() {
    if (!menuEl) return;
    menuEl.classList.remove('visible');
  }

  // ── Actions ───────────────────────────────────────────────
  function closeAllWindows() {
    document.querySelectorAll('.terminal-window').forEach(w => {
      w.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      w.style.opacity = '0';
      w.style.transform = (w.style.transform || '') + ' scale(0.95)';
      setTimeout(() => w.remove(), 200);
    });
  }

  function createNewWindow() {
    const existing = document.querySelectorAll('.terminal-window');
    if (existing.length === 0) return;

    // Clone the first terminal window
    const source  = existing[0];
    const clone   = source.cloneNode(true);

    // Give clone a fresh ID to avoid duplicate IDs
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => {
      el.id = el.id + '_' + Date.now();
    });

    // Offset clone so it doesn't fully overlap
    const offset = 32 * existing.length;
    clone.style.transform = `translate(${offset}px, ${offset}px)`;

    // Clear output + re-show hint in clone
    const cloneOutput = clone.querySelector('.output, #output, [id^="output"]');
    if (cloneOutput) {
      cloneOutput.innerHTML = '';
      const hint = document.createElement('div');
      hint.className = 'output-line muted';
      hint.textContent = 'Type `help` for available commands.';
      cloneOutput.appendChild(hint);
    }

    document.body.appendChild(clone);

    // Re-init draggable on the new window's titlebar
    if (typeof Draggable !== 'undefined' && Draggable.init) {
      Draggable.init(clone);
    }

    // Animate in
    clone.style.opacity = '0';
    clone.style.transition = 'opacity 0.2s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.opacity = '1';
      });
    });
  }

  // ── Global event wiring ───────────────────────────────────
  function init() {
    // Right-click on background (not on a terminal window)
    document.addEventListener('contextmenu', e => {
      // Only intercept clicks on the background, not inside terminal windows
      if (e.target.closest('.terminal-window')) return;

      e.preventDefault();
      show(e.clientX, e.clientY);
    });

    // Click anywhere else → hide
    document.addEventListener('click', e => {
      if (!menuEl) return;
      if (!menuEl.contains(e.target)) hide();
    });

    // Escape key → hide
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hide();
    });
  }

  return { init };

})();

document.addEventListener('DOMContentLoaded', () => ContextMenu.init());
