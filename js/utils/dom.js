/* ============================================================
   js/utils/dom.js — Shared DOM timing helpers
   Replaces the double-rAF pattern used in draggable.js,
   init-panels.js, contextmenu.js, and note-editor.js.
   ============================================================ */

'use strict';

/**
 * Run `fn` after two animation frames so the browser has had a chance
 * to paint an initial state (e.g. opacity:0) before the callback fires.
 *
 * @param {() => void} fn
 */
function afterLayout(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// Export to globalThis for modules loaded via new Function(src)()
globalThis.afterLayout = afterLayout;
