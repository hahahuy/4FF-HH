/* ============================================================
   draggable.js — Drag + Resize for all .terminal-window elements
   Uses position:fixed + left/top so resize edges are stable.
   ============================================================ */

'use strict';

const Draggable = (() => {

  const MIN_W      = 340;
  const MIN_H      = 220;
  const MOBILE_BP  = Config.BREAKPOINT_MOBILE;   // must match CSS breakpoint

  const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  // ── Bring-to-front ────────────────────────────────────────
  let zCounter = 20;
  function bringToFront(el) { el.style.zIndex = ++zCounter; }

  // ── Pin to fixed coords ───────────────────────────────────
  /**
   * Snapshot current screen position → position:fixed.
   * On mobile the window is always fullscreen instead.
   */
  function pinToScreen(win) {
    afterLayout(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      win.style.position  = 'fixed';
      win.style.transform = '';
      win.style.margin    = '0';

      if (vw <= MOBILE_BP) {
        win.style.left   = '0px';
        win.style.top    = '0px';
        win.style.width  = `${vw}px`;
        win.style.height = `${vh}px`;
      } else {
        const rect = win.getBoundingClientRect();
        win.style.left   = `${rect.left}px`;
        win.style.top    = `${rect.top}px`;
        win.style.width  = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
      }
    });
  }

  function getPos(win) {
    const rect = win.getBoundingClientRect();
    return {
      left:   rect.left,
      top:    rect.top,
      width:  rect.width  || win.offsetWidth,
      height: rect.height || win.offsetHeight,
    };
  }

  // ── Viewport resize → clamp all windows ──────────────────
  let _rafPending = false;

  function handleViewportResize() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      document.querySelectorAll('.terminal-window:not(.info-panel)').forEach(win => {
        if (vw <= MOBILE_BP) {
          // Fullscreen on mobile — remove any manual sizing
          win.style.left   = '0px';
          win.style.top    = '0px';
          win.style.width  = `${vw}px`;
          win.style.height = `${vh}px`;
        } else {
          // Desktop / tablet: clamp size then position
          const p    = getPos(win);
          const newW = Math.min(p.width,  vw - 16);
          const newH = Math.min(p.height, vh - 16);
          const newL = clamp(p.left, 0, vw - newW);
          const newT = clamp(p.top,  0, vh - newH);

          win.style.width  = `${newW}px`;
          win.style.height = `${newH}px`;
          win.style.left   = `${newL}px`;
          win.style.top    = `${newT}px`;
        }
      });
    });
  }

  window.addEventListener('resize', handleViewportResize);

  // ── Drag ──────────────────────────────────────────────────
  function initDrag(win, handle) {
    let dragging  = false;
    let startPX, startPY, startL, startT;

    // Edge bounce state — track which edges were hit last frame
    let prevHit   = { l: false, r: false, t: false, b: false };
    let bouncing  = false;

    function triggerBounce(bx, by) {
      if (bouncing) return;
      bouncing = true;
      // --bx / --by are the "push" direction (away from the wall)
      win.style.setProperty('--bx', `${bx}px`);
      win.style.setProperty('--by', `${by}px`);
      win.style.animation = 'terminal-bounce 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)';
      win.addEventListener('animationend', () => {
        win.style.animation = '';
        win.style.removeProperty('--bx');
        win.style.removeProperty('--by');
        bouncing = false;
      }, { once: true });
    }

    handle.addEventListener('pointerdown', e => {
      if (window.innerWidth <= MOBILE_BP) return;
      if (e.target.classList.contains('dot')) return;
      // Resize handles sit at top:0 and overlap the titlebar physically.
      // If the click originated on a resize handle, let resize take it.
      if (e.target.closest('.resize-handle')) return;

      dragging = true;
      handle.setPointerCapture(e.pointerId);
      win.classList.add('dragging');
      bringToFront(win);

      startPX = e.clientX;
      startPY = e.clientY;
      const p = getPos(win);
      startL  = p.left;
      startT  = p.top;
      e.preventDefault();
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p    = getPos(win);
      const vw   = window.innerWidth;
      const vh   = window.innerHeight;
      const rawL = startL + e.clientX - startPX;
      const rawT = startT + e.clientY - startPY;
      const newL = clamp(rawL, 0, vw - p.width);
      const newT = clamp(rawT, 0, vh - p.height);

      win.style.left = `${newL}px`;
      win.style.top  = `${newT}px`;

      // ── Bounce on edge contact ─────────────────────────────
      const hitL = rawL < 0;
      const hitR = rawL > vw - p.width;
      const hitT = rawT < 0;
      const hitB = rawT > vh - p.height;

      // Only fire when NEWLY hitting (not while already pressing against edge)
      const newlyHit = (hitL && !prevHit.l) || (hitR && !prevHit.r)
                    || (hitT && !prevHit.t) || (hitB && !prevHit.b);

      if (newlyHit) {
        const bx = hitR ? -8 : hitL ?  8 : 0;
        const by = hitB ? -8 : hitT ?  8 : 0;
        triggerBounce(bx, by);
      }

      prevHit = { l: hitL, r: hitR, t: hitT, b: hitB };
    });

    const stopDrag = () => {
      if (!dragging) return;
      dragging  = false;
      prevHit   = { l: false, r: false, t: false, b: false };
      win.classList.remove('dragging');
    };
    handle.addEventListener('pointerup',     stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    // Double-click titlebar → snap to center
    handle.addEventListener('dblclick', () => {
      const p  = getPos(win);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      win.style.transition = 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      win.style.left = `${(vw - p.width)  / 2}px`;
      win.style.top  = `${(vh - p.height) / 2}px`;
      win.addEventListener('transitionend', () => {
        win.style.transition = '';
      }, { once: true });
    });
  }

  // ── Resize ────────────────────────────────────────────────
  function initResize(win) {

    EDGES.forEach(edge => {
      const div = document.createElement('div');
      div.className = `resize-handle resize-${edge}`;
      div.dataset.edge = edge;
      win.appendChild(div);
    });

    let resizing = false;
    let edge, startPX, startPY, startL, startT, startW, startH;

    win.addEventListener('pointerdown', e => {
      const handle = e.target.closest('.resize-handle');
      if (!handle || window.innerWidth <= MOBILE_BP) return;

      edge     = handle.dataset.edge;
      resizing = true;
      win.setPointerCapture(e.pointerId);
      win.classList.add('resizing');
      bringToFront(win);

      startPX = e.clientX;
      startPY = e.clientY;
      const p = getPos(win);
      startL  = p.left;
      startT  = p.top;
      startW  = p.width;
      startH  = p.height;

      e.preventDefault();
      e.stopPropagation();
    });

    win.addEventListener('pointermove', e => {
      if (!resizing) return;

      const dx = e.clientX - startPX;
      const dy = e.clientY - startPY;

      let newL = startL, newT = startT, newW = startW, newH = startH;

      // East: right edge moves → left/top stay, width grows
      if (edge.includes('e')) {
        newW = Math.max(MIN_W, startW + dx);
      }

      // West: left edge moves → right edge stays fixed
      // Allow any expansion (dx negative = no lower bound).
      // Cap shrink: dx cannot exceed startW - MIN_W (would push below MIN_W).
      if (edge.includes('w')) {
        const clampedDx = Math.min(dx, startW - MIN_W); // cap positive (shrink) only
        newW = startW - clampedDx;
        newL = startL + clampedDx;
      }

      // South: bottom edge moves → left/top stay, height grows
      if (edge.includes('s')) {
        newH = Math.max(MIN_H, startH + dy);
      }

      // North: top edge moves → bottom edge stays fixed
      // Allow any expansion (dy negative = no lower bound).
      // Cap shrink: dy cannot exceed startH - MIN_H.
      if (edge.includes('n')) {
        const clampedDy = Math.min(dy, startH - MIN_H); // cap positive (shrink) only
        newH = startH - clampedDy;
        newT = startT + clampedDy;
      }

      win.style.left   = `${newL}px`;
      win.style.top    = `${newT}px`;
      win.style.width  = `${newW}px`;
      win.style.height = `${newH}px`;
    });

    const stopResize = () => {
      if (!resizing) return;
      resizing = false;
      win.classList.remove('resizing');
    };
    win.addEventListener('pointerup',     stopResize);
    win.addEventListener('pointercancel', stopResize);
  }

  // ── Public ────────────────────────────────────────────────
  function init(winEl) {
    const titlebar = winEl.querySelector('.titlebar');
    if (!titlebar) return;

    // Anchor to fixed screen coords — breaks out of flexbox centering
    pinToScreen(winEl);

    initDrag(winEl, titlebar);
    initResize(winEl);

    winEl.addEventListener('pointerdown', () => bringToFront(winEl), { capture: true });
  }

  function initAll() {
    document.querySelectorAll('.terminal-window').forEach(init);
  }

  return { init, initAll };

})();

App.Draggable = Draggable;  // publish to App namespace

document.addEventListener('DOMContentLoaded', () => Draggable.initAll());
