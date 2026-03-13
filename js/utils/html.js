/**
 * Escape special HTML characters so a string is safe to inject
 * into innerHTML.  Replaces all local `esc()` / `escapeHtml()` copies.
 *
 * @param {*} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * SEC-6: Strip dangerous elements and attributes from a parsed-Markdown
 * container before it is inserted into the page.
 * Replaces all local `sanitiseHtml()` copies.
 *
 * @param {Element} el
 */
function sanitiseHtml(el) {
  el.querySelectorAll("script,iframe,object,embed,form,base").forEach((n) => n.remove());
  el.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }
      if (["href", "src", "action"].includes(attr.name) && /^\s*javascript:/i.test(attr.value)) {
        node.removeAttribute(attr.name);
      }
    });
  });
}

// Export to globalThis for modules loaded via new Function(src)()
globalThis.escHtml = escHtml;
globalThis.sanitiseHtml = sanitiseHtml;

/**
 * Render all ```mermaid fenced blocks inside an already-sanitised .md-render
 * container.  Must be called after sanitiseHtml().
 *
 * marked.js turns ```mermaid into <pre><code class="language-mermaid">…</code></pre>.
 * We replace each such block with an <svg> produced by mermaid.render().
 *
 * @param {Element} el  — the .md-render container
 */
async function renderMermaid(el) {
  if (typeof mermaid === "undefined") return;
  const blocks = el.querySelectorAll("code.language-mermaid");
  if (!blocks.length) return;
  let idx = 0;
  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre) continue;
    const source = code.textContent || "";
    const id = `mermaid-${Date.now()}-${idx++}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const wrap = document.createElement("div");
      wrap.className = "mermaid-diagram";
      wrap.innerHTML = svg;
      pre.replaceWith(wrap);
    } catch (_) {
      // Leave the raw pre/code block if rendering fails
    }
  }
}

globalThis.renderMermaid = renderMermaid;
