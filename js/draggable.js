/* ============================================================
   draggable.js — Factory: DraggableFactory.makeDraggable(windowEl)
   ============================================================ */

'use strict';

const DraggableFactory = (() => {

  /**
   * Make a .terminal-window element draggable within #desktop.
   * Uses left/top positioning (position:absolute) instead of transform.
   * @param {HTMLElement} windowEl — the .terminal-window root
   * @returns {{ destroy: Function }}
   */
  function makeDraggable(windowEl) {
    const handle  = windowEl.querySelector('.titlebar');
    const desktop = document.getElementById('desktop');

    let isDragging = false;
    let startPointerX, startPointerY;
    let startLeft,    startTop;

    // ── Drag start ──────────────────────────────────────────
    function onPointerDown(e) {
      // Disable drag on mobile
      if (window.innerWidth <= 768) return;
      // Only primary button
      if (e.button !== 0) return;
      // Don't drag when clicking the close dot
      if (e.target.classList.contains('dot-red')) return;

      isDragging = true;
      handle.setPointerCapture(e.pointerId);
      windowEl.classList.add('dragging');

      // Bring to front on mousedown (delegated to WindowManager)
      WindowManager.bringToFront(windowEl);

      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startLeft     = windowEl.offsetLeft;
      startTop      = windowEl.offsetTop;

      e.preventDefault();
    }

    // ── Drag move ───────────────────────────────────────────
    function onPointerMove(e) {
      if (!isDragging) return;

      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;

      const rawLeft = startLeft + dx;
      const rawTop  = startTop  + dy;

      const { x, y } = clampToDesktop(rawLeft, rawTop);
      windowEl.style.left = x + 'px';
      windowEl.style.top  = y + 'px';
    }

    // ── Drag end ────────────────────────────────────────────
    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      windowEl.classList.remove('dragging');
    }

    function onPointerCancel() {
      isDragging = false;
      windowEl.classList.remove('dragging');
    }

    // ── Double-click → snap to center of desktop ────────────
    function onDblClick() {
      if (window.innerWidth <= 768) return;
      const dw = desktop.offsetWidth;
      const dh = desktop.offsetHeight;
      const ww = windowEl.offsetWidth;
      const wh = windowEl.offsetHeight;

      windowEl.style.transition = 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      windowEl.style.left = Math.max(0, Math.floor((dw - ww) / 2)) + 'px';
      windowEl.style.top  = Math.max(0, Math.floor((dh - wh) / 2)) + 'px';

      windowEl.addEventListener('transitionend', () => {
        windowEl.style.transition = '';
      }, { once: true });
    }

    // ── Clamp to desktop bounds ──────────────────────────────
    function clampToDesktop(left, top) {
      const dw = desktop.offsetWidth;
      const dh = desktop.offsetHeight;
      const ww = windowEl.offsetWidth;
      const wh = windowEl.offsetHeight;

      return {
        x: Math.max(0, Math.min(left, dw - ww)),
        y: Math.max(0, Math.min(top,  dh - wh)),
      };
    }

    // Attach listeners
    handle.addEventListener('pointerdown',  onPointerDown);
    handle.addEventListener('pointermove',  onPointerMove);
    handle.addEventListener('pointerup',    onPointerUp);
    handle.addEventListener('pointercancel', onPointerCancel);
    handle.addEventListener('dblclick',     onDblClick);

    // ── destroy ─────────────────────────────────────────────
    function destroy() {
      handle.removeEventListener('pointerdown',  onPointerDown);
      handle.removeEventListener('pointermove',  onPointerMove);
      handle.removeEventListener('pointerup',    onPointerUp);
      handle.removeEventListener('pointercancel', onPointerCancel);
      handle.removeEventListener('dblclick',     onDblClick);
    }

    return { destroy };
  }

  return { makeDraggable };

})();
