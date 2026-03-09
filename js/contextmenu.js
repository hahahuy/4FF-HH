/* ============================================================
   contextmenu.js — Background right-click context menu
   ============================================================ */

'use strict';

const ContextMenu = (() => {

  let menuEl   = null;
  let template = null; // deep-clone of the original window, captured at init

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
        action: () => window.open('https://hahahuy.github.io/porfoliosite/', '_blank', 'noopener,noreferrer'),
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
    if (!template) return;

    // Clone from the stored template — works even when all windows are closed
    const clone = template.cloneNode(true);

    // Give clone fresh IDs to avoid collisions
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => {
      el.id = el.id + '_' + Date.now();
    });

    // Offset so it doesn't sit exactly on top of existing windows
    const existing = document.querySelectorAll('.terminal-window');
    const offset   = 32 * (existing.length + 1);
    clone.style.transform = `translate(${offset}px, ${offset}px)`;

    // Clear output and show a fresh hint
    const cloneOutput = clone.querySelector('.output');
    if (cloneOutput) {
      cloneOutput.innerHTML = '';
      const hint = document.createElement('div');
      hint.className = 'output-line muted';
      hint.textContent = 'Type `help` for available commands.';
      cloneOutput.appendChild(hint);
    }

    document.body.appendChild(clone);

    // Wire up drag + resize on the new window
    if (typeof Draggable !== 'undefined' && Draggable.init) {
      Draggable.init(clone);
    }

    // Animate in
    clone.style.opacity    = '0';
    clone.style.transition = 'opacity 0.2s ease';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clone.style.opacity = '1';
    }));
  }

  // ── Global event wiring ───────────────────────────────────
  function init() {
    // Capture a clean template clone BEFORE anything can be closed
    const original = document.querySelector('.terminal-window');
    if (original) {
      template = original.cloneNode(true);
      // Strip live output from template so every new window starts fresh
      const tmplOutput = template.querySelector('.output');
      if (tmplOutput) tmplOutput.innerHTML = '';
    }
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
