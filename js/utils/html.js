/* ============================================================
   js/utils/html.js — Shared HTML-safety helpers
   Replaces local esc()/escapeHtml() and sanitiseHtml() copies
   in commands.js, terminal.js, note-editor.js, message-panel.js,
   and init-panels.js.
   ============================================================ */

'use strict';

/**
 * Escape special HTML characters so a string is safe to inject
 * into innerHTML.  Replaces all local `esc()` / `escapeHtml()` copies.
 *
 * @param {*} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * SEC-6: Strip dangerous elements and attributes from a parsed-Markdown
 * container before it is inserted into the page.
 * Replaces all local `sanitiseHtml()` copies.
 *
 * @param {Element} el
 */
function sanitiseHtml(el) {
  el.querySelectorAll('script,iframe,object,embed,form,base').forEach(n => n.remove());
  el.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attr => {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }
      if (
        ['href', 'src', 'action'].includes(attr.name) &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        node.removeAttribute(attr.name);
      }
    });
  });
}

// Export to globalThis for modules loaded via new Function(src)()
globalThis.escHtml     = escHtml;
globalThis.sanitiseHtml = sanitiseHtml;
