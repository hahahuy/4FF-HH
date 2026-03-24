#!/usr/bin/env node
/**
 * scripts/build-blog.js
 * Generates dist/blog/ from content/blog/ source files.
 * Run after `vite build` and `minify-js.js`.
 *
 *   node scripts/build-blog.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { marked } from "marked";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_BLOG = join(ROOT, "content", "blog");
const DIST_BLOG = join(ROOT, "dist", "blog");

// hello-world becomes the README intro, excluded from post list + no page generated
const README_SLUG = "hello-world";

// ─── helpers ──────────────────────────────────────────────────────────────────

function slugify(filename) {
  return filename.replace(/\.md$/i, "").toLowerCase().replace(/_/g, "-");
}

/** Strip YAML frontmatter delimited by --- */
function stripFrontmatter(src) {
  if (!src.startsWith("---")) return src;
  const end = src.indexOf("\n---", 3);
  if (end === -1) return src;
  return src.slice(end + 4).trimStart();
}

/** Strip HTML tags for plain-text excerpt */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(html, maxLen = 160) {
  return stripHtml(html).slice(0, maxLen);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readTime(html) {
  const words = stripHtml(html).split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Parse h2/h3 headings, inject IDs, return sidebar TOC HTML + patched body. */
function buildToc(html) {
  const headings = [];
  const bodyWithIds = html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/h[23]>/gi,
    (_m, tag, attrs, inner) => {
      const plain = inner.replace(/<[^>]+>/g, "").trim();
      const id =
        "h-" +
        plain
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      headings.push({ level: parseInt(tag[1]), text: plain, id });
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );

  if (headings.length === 0) return { tocHtml: "", bodyWithIds: html };

  let toc =
    '<nav class="toc" aria-label="Contents">' +
    '<p class="toc-label">Contents</p>' +
    '<ul class="toc-list">';

  let i = 0;
  while (i < headings.length) {
    const h = headings[i];
    if (h.level === 2) {
      const subs = [];
      let j = i + 1;
      while (j < headings.length && headings[j].level === 3) {
        subs.push(headings[j]);
        j++;
      }
      if (subs.length > 0) {
        toc += `<li class="toc-h2"><details><summary><a href="#${h.id}">${h.text}</a></summary><ul>`;
        subs.forEach((s) => {
          toc += `<li class="toc-h3"><a href="#${s.id}">${s.text}</a></li>`;
        });
        toc += `</ul></details></li>`;
        i = j;
      } else {
        toc += `<li class="toc-h2"><a href="#${h.id}">${h.text}</a></li>`;
        i++;
      }
    } else {
      toc += `<li class="toc-h3 toc-orphan"><a href="#${h.id}">${h.text}</a></li>`;
      i++;
    }
  }
  toc += "</ul></nav>";
  return { tocHtml: toc, bodyWithIds };
}

/**
 * Scan raw markdown of each post for [text](/blog/slug/) links to sibling posts.
 * Returns { slug: [linkedSlug, ...], ... }
 */
function buildGraphLinks(entries) {
  const slugSet = new Set(entries.map((e) => e.slug));
  const links = {};
  entries.forEach(({ slug, rawSrc }) => {
    links[slug] = [];
    const re = /\[.*?\]\(\/blog\/([^/]+)\/\)/g;
    let m;
    while ((m = re.exec(rawSrc)) !== null) {
      if (slugSet.has(m[1]) && m[1] !== slug) links[slug].push(m[1]);
    }
  });
  return links;
}

/**
 * Build Explorer sidebar HTML from posts array.
 * Groups by folder field; posts without a folder go flat after folders.
 */
function buildExplorerHtml(posts, currentSlug) {
  const foldered = {};
  const flat = [];

  for (const p of posts) {
    if (p.folder) {
      if (!foldered[p.folder]) foldered[p.folder] = [];
      foldered[p.folder].push(p);
    } else {
      flat.push(p);
    }
  }

  let html = "";

  for (const [folder, items] of Object.entries(foldered)) {
    html += `<li><details class="explorer-folder"><summary>${folder}</summary><ul>`;
    for (const p of items) {
      const active = p.slug === currentSlug ? " active" : "";
      html += `<li class="explorer-item${active}"><a href="/blog/${p.slug}/">• ${p.title}</a></li>`;
    }
    html += `</ul></details></li>`;
  }

  for (const p of flat) {
    const active = p.slug === currentSlug ? " active" : "";
    html += `<li class="explorer-item${active}"><a href="/blog/${p.slug}/">• ${p.title}</a></li>`;
  }

  return html;
}

// ─── inlined CSS ──────────────────────────────────────────────────────────────

const STYLE = `
  :root {
    --bg-page:      #0d1117;
    --bg-window:    #161b22;
    --text-primary: #c9d1d9;
    --text-muted:   #6e7681;
    --color-blue:   #58a6ff;
    --color-green:  #7ee787;
    --border-color: #30363d;
    --font-mono:    'JetBrains Mono', monospace;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    background: var(--bg-page);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-feature-settings: "liga" 0;
    line-height: 1.6;
    min-height: 100vh;
    padding: 2.5rem 3rem 3rem;
  }
  /* ── Top bar (back to terminal) ── */
  .top-bar {
    max-width: 1720px;
    margin: 0 auto 1.25rem;
  }
  .top-bar a {
    font-size: .82rem;
    color: var(--text-muted);
    text-decoration: none;
    transition: color .12s;
  }
  .top-bar a:hover { color: var(--color-blue); }
  /* ── Centred shell wrapping all 3 columns ── */
  .page-shell {
    max-width: 1720px;
    margin: 0 auto;
    background: var(--bg-window);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }
  /* ── Layout grid inside the shell ── */
  .layout {
    display: grid;
    grid-template-columns: 210px 1fr 210px;
    min-height: 80vh;
    background: var(--bg-window);
  }
  /* ── Left sidebar ── */
  .sidebar-left {
    position: sticky;
    top: 2.5rem;
    max-height: calc(100vh - 5rem);
    overflow-y: auto;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1.1rem;
    gap: .75rem;
  }
  .brand {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-blue);
    text-decoration: none;
  }
  .brand:hover { color: var(--color-green); }
  .controls {
    display: flex;
    align-items: center;
    gap: .4rem;
  }
  .search-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    gap: .25rem;
    background: var(--bg-page);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: .25rem .5rem;
  }
  .search-wrap input {
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: .82rem;
    width: 100%;
  }
  .search-wrap input::placeholder { color: var(--text-muted); }
  .icon-btn {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    padding: .25rem .4rem;
    font-size: .85rem;
    transition: color .12s, border-color .12s;
  }
  .icon-btn:hover { color: var(--color-blue); border-color: var(--color-blue); }
  .controls.search-active .icon-btn { display: none; }
  .search-results {
    background: var(--bg-page);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: .82rem;
    overflow: hidden;
  }
  .search-results a {
    display: block;
    padding: .35rem .6rem;
    color: var(--text-primary);
    text-decoration: none;
    border-bottom: 1px solid var(--border-color);
  }
  .search-results a:last-child { border-bottom: none; }
  .search-results a:hover { background: rgba(88,166,255,.08); color: var(--color-blue); }
  .search-results .sr-match { background: rgba(126,231,135,.15); }
  .search-count { font-size: .75rem; color: var(--text-muted); padding: .2rem .6rem; }
  /* ── Explorer ── */
  .explorer-label {
    font-size: .72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: .3rem;
    user-select: none;
  }
  .explorer-label::after { content: "▾"; transition: transform .15s; }
  .explorer-collapsed .explorer-label::after { content: "▸"; }
  .explorer-list { list-style: none; padding: 0; margin: .5rem 0 0; font-size: .83rem; }
  .explorer-folder > summary {
    color: var(--color-blue);
    cursor: pointer;
    padding: .2rem 0;
    list-style: none;
  }
  .explorer-folder > summary::-webkit-details-marker { display: none; }
  .explorer-folder > summary::before { content: "▶ "; font-size: .7em; opacity: .6; }
  .explorer-folder[open] > summary::before { content: "▼ "; }
  .explorer-folder ul { list-style: none; padding-left: .85rem; margin: 0; }
  .explorer-item a {
    display: block;
    color: var(--text-primary);
    text-decoration: none;
    padding: .18rem 0;
    transition: color .12s;
  }
  .explorer-item a:hover { color: var(--color-blue); }
  .explorer-item.active a { color: var(--color-green); }
  /* ── Main content ── */
  .main-content { padding: 2rem 2.5rem; min-width: 0; }
  article h1, .readme-title { font-size: 1.75rem; color: var(--color-green); margin-bottom: .35rem; }
  h2 { font-size: 1.2rem; margin: 1.6rem 0 .5rem; }
  h3 { font-size: 1rem; margin: 1.4rem 0 .4rem; }
  time { color: var(--text-muted); font-size: .85rem; display: block; margin-bottom: .5rem; letter-spacing: .03em; }
  p { margin-bottom: 1rem; }
  a { color: var(--color-blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre {
    background: var(--bg-page);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--color-blue);
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    margin-bottom: 1rem;
    line-height: 1.55;
    position: relative;
  }
  .copy-btn {
    position: absolute;
    top: .45rem;
    right: .5rem;
    padding: .18rem .55rem;
    font-family: var(--font-mono);
    font-size: .72rem;
    color: var(--text-muted);
    background: var(--bg-window);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    cursor: pointer;
    transition: color .15s, border-color .15s;
    user-select: none;
    line-height: 1.6;
  }
  .copy-btn.copied { color: var(--color-green); border-color: var(--color-green); }
  code { font-family: var(--font-mono); font-size: .9em; line-height: 1.55; }
  p code, li code {
    background: var(--bg-page);
    border: 1px solid var(--border-color);
    border-radius: 2px;
    padding: .1em .3em;
  }
  ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
  li { margin-bottom: .25rem; }
  blockquote {
    border-left: 3px solid var(--color-blue);
    margin: 1rem 0;
    padding: .5rem 1rem;
    color: var(--text-muted);
    font-style: italic;
    background: rgba(88,166,255,.04);
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: .9rem; }
  th, td { border: 1px solid var(--border-color); padding: .4rem .75rem; text-align: left; }
  th { background: var(--bg-page); color: var(--color-green); }
  hr { border: none; border-top: 1px solid var(--border-color); margin: 2rem 0; opacity: .4; }
  /* ── README index ── */
  .readme-body { max-width: 680px; }
  .readme-body .post-list { margin-top: 2rem; }
  .blog-intro { margin-bottom: 1.75rem; color: var(--text-muted); font-size: .9rem; line-height: 1.65; }
  .post-list { list-style: none; padding: 0; }
  .post-list li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding: .5rem .4rem;
    border-bottom: 1px solid var(--border-color);
    transition: background .12s;
    border-left: 2px solid transparent;
  }
  .post-list li:last-child { border-bottom: none; }
  .post-list li:hover { background: rgba(88,166,255,.06); border-left-color: var(--color-blue); }
  .post-list a { font-weight: 500; }
  .post-list time { font-size: .8rem; white-space: nowrap; flex-shrink: 0; margin-bottom: 0; }
  .post-meta {
    font-size: .78rem;
    color: var(--text-muted);
    display: inline-block;
    margin-bottom: 1.5rem;
    letter-spacing: .02em;
  }
  .back-top {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 500;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-titlebar, #1f2428);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: .9rem;
    opacity: 0;
    transition: opacity .2s, color .15s, border-color .15s;
    pointer-events: none;
  }
  .back-top.visible { opacity: 1; pointer-events: auto; }
  .back-top:hover { color: var(--color-blue); border-color: var(--color-blue); text-decoration: none; }
  /* ── TOC (in sidebar-left on post pages) ── */
  .toc { padding-top: 0; }
  .toc-label {
    font-size: .72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin-bottom: .5rem;
  }
  .toc-list, .toc-list ul { list-style: none; padding: 0; margin: 0; }
  .toc-h2 > a {
    font-size: .82rem;
    color: var(--text-primary);
    display: block;
    padding: .2rem 0;
    text-decoration: none;
    transition: color .12s;
  }
  .toc-h2 > a:hover { color: var(--color-blue); }
  .toc-h2 details summary {
    list-style: none;
    cursor: pointer;
    font-size: .82rem;
    color: var(--text-primary);
    padding: .2rem 0;
    transition: color .12s;
  }
  .toc-h2 details summary::-webkit-details-marker { display: none; }
  .toc-h2 details summary::before { content: "▶ "; font-size: .7em; opacity: .55; }
  .toc-h2 details[open] summary::before { content: "▼ "; }
  .toc-h2 details summary a { color: inherit; text-decoration: none; }
  .toc-h2 details summary:hover { color: var(--color-blue); }
  .toc-h3 a {
    font-size: .78rem;
    color: var(--text-muted);
    display: block;
    padding: .15rem 0 .15rem .75rem;
    text-decoration: none;
    transition: color .12s;
  }
  .toc-h3 a:hover { color: var(--color-blue); }
  /* ── Graph panel (right sidebar) ── */
  .sidebar-right {
    border-left: 1px solid var(--border-color);
    padding: 1.5rem 1rem;
  }
  .graph-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: .6rem;
  }
  .graph-label {
    font-size: .72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  /* Graph box — fixed small block */
  .graph-box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 220px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-page);
  }
  #graph-canvas { width: 100%; height: 100%; display: block; cursor: grab; }
  .graph-expand-btn {
    position: absolute;
    top: .35rem;
    right: .35rem;
    background: rgba(22,27,34,.75);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    padding: .2rem .3rem;
    font-size: .78rem;
    line-height: 1;
    transition: color .12s, border-color .12s;
  }
  .graph-expand-btn:hover { color: var(--color-blue); border-color: var(--color-blue); }
  /* Graph modal (full-screen overlay) */
  .graph-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(13,17,23,.88);
    z-index: 100;
    align-items: center;
    justify-content: center;
  }
  .graph-modal.open { display: flex; }
  .graph-modal-inner {
    position: relative;
    width: min(90vw, 700px);
    height: min(85vh, 700px);
    background: var(--bg-window);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }
  #graph-canvas-modal { width: 100%; height: 100%; display: block; cursor: grab; }
  .graph-modal-close {
    position: absolute;
    top: .6rem;
    right: .7rem;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    padding: .2rem .45rem;
    font-size: .85rem;
    transition: color .12s, border-color .12s;
  }
  .graph-modal-close:hover { color: var(--color-blue); border-color: var(--color-blue); }
  .sidebar-right.hidden { display: none; }
  /* ── Light mode ── */
  body.light {
    --bg-page: #f6f8fa;
    --bg-window: #ffffff;
    --text-primary: #24292f;
    --text-muted: #57606a;
    --border-color: #d0d7de;
  }
  /* ── Responsive ── */
  @media (max-width: 1000px) {
    body { padding: 1.5rem 1.25rem 2rem; }
    .layout { grid-template-columns: 210px 1fr; }
    .sidebar-right { display: none; }
  }
  @media (max-width: 640px) {
    body { padding: 1rem .5rem 1.5rem; }
    .layout { grid-template-columns: 1fr; }
    .sidebar-left { position: static; max-height: none; }
    html { font-size: 13px; }
    .main-content { padding: 1rem; }
  }
  /* ── Footer ── */
  .site-footer {
    max-width: 1720px;
    margin: 2rem auto 0;
    padding: 1.25rem 0 .75rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: .6rem 1.5rem;
    font-size: .78rem;
    color: var(--text-muted);
  }
  .site-footer a { color: var(--text-muted); text-decoration: none; transition: color .12s; }
  .site-footer a:hover { color: var(--color-blue); }
  .footer-left { display: flex; flex-direction: column; gap: .3rem; }
  .footer-right { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }
`;

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

const YEAR = new Date().getFullYear();
const FOOTER_HTML = `
  <footer class="site-footer">
    <div class="footer-left">
      <span>© ${YEAR} Ha Huy (Tony). All rights reserved.</span>
      <span>
        Blog content licensed under
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        — code snippets under
        <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT</a>.
      </span>
      <span>Views are my own and do not represent any employer or institution.</span>
    </div>
    <div class="footer-right">
      <a href="https://hahuy.site">← terminal</a>
      <a href="/blog/">~/blog</a>
      <a href="https://github.com/hahahuy" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="mailto:quanghuyha098@gmail.com">contact</a>
    </div>
  </footer>`;

// ─── inlined client JS ────────────────────────────────────────────────────────

const CLIENT_JS = `
(function () {
  // Dark mode toggle
  document.getElementById('btn-dark').addEventListener('click', function () {
    document.body.classList.toggle('light');
  });

  // Graph toggle (hides/shows right panel)
  document.getElementById('btn-graph').addEventListener('click', function () {
    document.getElementById('graph-panel').classList.toggle('hidden');
  });

  // Graph expand modal
  var modal = document.getElementById('graph-modal');
  var expandBtn = document.getElementById('graph-expand-btn');
  var closeBtn = document.getElementById('graph-modal-close');
  if (modal && expandBtn) {
    expandBtn.addEventListener('click', function () {
      modal.classList.add('open');
      renderGraph('graph-canvas-modal');
    });
    closeBtn.addEventListener('click', function () { modal.classList.remove('open'); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // Explorer accordion (index page uses a plain .explorer-label click)
  var explorerLabel = document.querySelector('.explorer-label');
  if (explorerLabel) {
    explorerLabel.addEventListener('click', function () {
      var nav = document.querySelector('.sidebar-nav');
      if (nav) nav.classList.toggle('explorer-collapsed');
    });
  }

  // Search
  var idx = window.BLOG_META.posts;
  var currentSlug = window.BLOG_META.currentSlug;
  var input = document.getElementById('search');
  var results = document.getElementById('search-results');
  var controls = input.closest('.controls');

  // Expand search bar on focus — hide icon buttons
  input.addEventListener('focus', function () {
    controls.classList.add('search-active');
  });
  input.addEventListener('blur', function () {
    controls.classList.remove('search-active');
  });

  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { results.hidden = true; return; }

    if (!currentSlug) {
      // Global search on index — filter post titles and excerpts
      var hits = idx.filter(function (p) {
        return p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
      });
      if (!hits.length) { results.hidden = true; return; }
      hits.forEach(function (p) {
        var a = document.createElement('a');
        a.href = '/blog/' + p.slug + '/';
        a.textContent = p.title;
        results.appendChild(a);
      });
    } else {
      // Local search on post page — highlight all matches within article
      var article = document.querySelector('article');
      article.querySelectorAll('mark.sh').forEach(function (m) {
        m.replaceWith(document.createTextNode(m.textContent));
      });
      article.normalize();
      var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      var count = 0;
      var nodes = [];
      var node;
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach(function (tn) {
        var text = tn.textContent;
        var lc = text.toLowerCase();
        var pos = 0;
        var i;
        var frag = document.createDocumentFragment();
        var hasMatch = false;
        while ((i = lc.indexOf(q, pos)) !== -1) {
          hasMatch = true;
          count++;
          if (i > pos) frag.appendChild(document.createTextNode(text.slice(pos, i)));
          var mark = document.createElement('mark');
          mark.className = 'sh';
          mark.style.background = 'rgba(126,231,135,.3)';
          mark.style.color = 'inherit';
          mark.textContent = text.slice(i, i + q.length);
          frag.appendChild(mark);
          pos = i + q.length;
        }
        if (!hasMatch) return;
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        tn.parentNode.replaceChild(frag, tn);
      });
      var div = document.createElement('div');
      div.className = 'search-count';
      div.textContent = count ? count + ' match' + (count > 1 ? 'es' : '') : 'no matches';
      results.appendChild(div);
    }
    results.hidden = false;
  });

  // Graph rendering — shared function for inline + modal canvas
  function renderGraph(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var meta = window.BLOG_META;
    var DPR = window.devicePixelRatio || 1;
    var W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.scale(DPR, DPR);

    var nodes = meta.posts.map(function (p, i) {
      var angle = (2 * Math.PI * i) / meta.posts.length;
      return {
        slug: p.slug, title: p.title,
        x: W / 2 + Math.cos(angle) * Math.min(W, H) * .3,
        y: H / 2 + Math.sin(angle) * Math.min(W, H) * .3,
        vx: 0, vy: 0
      };
    });

    var edges = [];
    Object.entries(meta.links).forEach(function (kv) {
      var from = kv[0], tos = kv[1];
      tos.forEach(function (to) {
        var s = nodes.find(function (n) { return n.slug === from; });
        var t = nodes.find(function (n) { return n.slug === to; });
        if (s && t) edges.push([s, t]);
      });
    });

    // Simple force simulation (50 ticks)
    for (var tick = 0; tick < 50; tick++) {
      nodes.forEach(function (a, i) {
        nodes.forEach(function (b, j) {
          if (i >= j) return;
          var dx = b.x - a.x, dy = b.y - a.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          var f = 800 / (d * d);
          a.vx -= f * dx / d; a.vy -= f * dy / d;
          b.vx += f * dx / d; b.vy += f * dy / d;
        });
      });
      edges.forEach(function (e) {
        var a = e[0], b = e[1];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var f = (d - 60) * 0.05;
        a.vx += f * dx / d; a.vy += f * dy / d;
        b.vx -= f * dx / d; b.vy -= f * dy / d;
      });
      nodes.forEach(function (n) {
        n.x = Math.max(20, Math.min(W - 20, n.x + n.vx * .5));
        n.y = Math.max(20, Math.min(H - 20, n.y + n.vy * .5));
        n.vx *= .8; n.vy *= .8;
      });
    }

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(88,166,255,.35)'; ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var a = e[0], b = e[1];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    nodes.forEach(function (n) {
      var isActive = n.slug === meta.currentSlug;
      ctx.beginPath();
      ctx.arc(n.x, n.y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#7ee787' : '#58a6ff';
      ctx.fill();
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#6e7681';
      ctx.fillText(n.title.slice(0, 18), n.x + 8, n.y + 4);
    });

    canvas.addEventListener('click', function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
      var hit = nodes.find(function (n) { return Math.hypot(n.x - mx, n.y - my) < 10; });
      if (hit) window.location.href = '/blog/' + hit.slug + '/';
    });
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
      canvas.style.cursor = nodes.some(function (n) { return Math.hypot(n.x - mx, n.y - my) < 10; }) ? 'pointer' : 'default';
    });
  }

  // Render inline graph on load
  renderGraph('graph-canvas');

  // Scroll-to-top button visibility
  (function () {
    var btn = document.querySelector('.back-top');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
  })();

  // Copy buttons for fenced code blocks
  (function () {
    var LANGS = /\blanguage-(\w+)\b/;
    var SKIP  = /^(text|plaintext|none|markup|html|xml|svg|mathml)$/i;
    document.querySelectorAll('pre > code[class]').forEach(function (code) {
      var m = code.className.match(LANGS);
      if (!m || SKIP.test(m[1])) return;
      var pre = code.parentElement;
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.innerText).then(function () {
          btn.textContent = 'copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 1800);
        }).catch(function () {
          btn.textContent = 'error';
          setTimeout(function () { btn.textContent = 'copy'; }, 1800);
        });
      });
      pre.appendChild(btn);
    });
  })();
})();
`;

// ─── templates ────────────────────────────────────────────────────────────────

function postPage({ title, date, slug, bodyHtml, mins, blogMeta, explorerHtml }) {
  const { tocHtml, bodyWithIds } = buildToc(bodyHtml);
  const desc = excerpt(bodyHtml);
  const url = `https://hahuy.site/blog/${slug}/`;
  const meta = { ...blogMeta, currentSlug: slug };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Ha Huy</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="${date}">
  ${FONT_LINK}
  <style>${STYLE}</style>
</head>
<body>
  <div class="top-bar"><a href="/blog/">← back to blog menu</a></div>
  <div class="page-shell">
    <div class="layout">
      <aside class="sidebar-left">
        <a href="/blog/" class="brand">~/blog</a>
        <div class="controls">
          <div class="search-wrap"><input id="search" placeholder="Search post…" autocomplete="off"></div>
          <button class="icon-btn" id="btn-dark" title="Toggle theme">🌙</button>
          <button class="icon-btn" id="btn-graph" title="Toggle graph">⊞</button>
        </div>
        <div id="search-results" class="search-results" hidden></div>
        <div class="sidebar-nav">
          ${tocHtml}
          <details class="explorer-details" style="margin-top:1rem">
            <summary class="explorer-label">Explorer</summary>
            <ul class="explorer-list">${explorerHtml}</ul>
          </details>
        </div>
      </aside>
      <main class="main-content">
        <article>
          <h1>${title}</h1>
          <time datetime="${date}">${formatDate(date)}</time>
          <span class="post-meta">~${mins} min read</span>
          ${bodyWithIds}
        </article>
      </main>
      <aside class="sidebar-right" id="graph-panel">
        <div class="graph-header">
          <span class="graph-label">Graph View</span>
        </div>
        <div class="graph-box">
          <canvas id="graph-canvas"></canvas>
          <button class="graph-expand-btn" id="graph-expand-btn" title="Expand graph">⊹</button>
        </div>
      </aside>
    </div>
  </div>
  <div class="graph-modal" id="graph-modal">
    <div class="graph-modal-inner">
      <canvas id="graph-canvas-modal"></canvas>
      <button class="graph-modal-close" id="graph-modal-close">✕</button>
    </div>
  </div>
  ${FOOTER_HTML}
  <a href="#" class="back-top" aria-label="Scroll to top">↑</a>
  <script>window.BLOG_META = ${JSON.stringify(meta)};</script>
  <script>${CLIENT_JS}</script>
</body>
</html>`;
}

function indexPage(posts, blogMeta, explorerHtml) {
  const items = posts
    .map(
      ({ title, date, slug }) =>
        `<li>
      <a href="/blog/${slug}/">• ${title}</a>
      <time datetime="${date}">${formatDate(date)}</time>
    </li>`,
    )
    .join("\n    ");

  const meta = { ...blogMeta, currentSlug: null };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog — Ha Huy</title>
  <meta name="description" content="Writing on software, engineering, and building things.">
  <meta property="og:title" content="Blog — Ha Huy">
  <meta property="og:description" content="Writing on software, engineering, and building things.">
  <meta property="og:url" content="https://hahuy.site/blog/">
  <meta property="og:type" content="website">
  ${FONT_LINK}
  <style>${STYLE}</style>
</head>
<body>
  <div class="top-bar"><a href="https://hahuy.site">← back to terminal</a></div>
  <div class="page-shell">
    <div class="layout">
      <aside class="sidebar-left">
        <a href="/blog/" class="brand">~/blog</a>
        <div class="controls">
          <div class="search-wrap"><input id="search" placeholder="Search posts…" autocomplete="off"></div>
          <button class="icon-btn" id="btn-dark" title="Toggle theme">🌙</button>
          <button class="icon-btn" id="btn-graph" title="Toggle graph">⊞</button>
        </div>
        <div id="search-results" class="search-results" hidden></div>
        <div class="sidebar-nav">
          <span class="explorer-label">Explorer</span>
          <ul class="explorer-list">${explorerHtml}</ul>
        </div>
      </aside>
      <main class="main-content">
        <div class="readme-body">
          <h1 class="readme-title">~/blog</h1>
          <div class="blog-intro">
            <p>Hey — I'm Ha Huy (Tony). This is where I write things down.</p>
            <p>Not tutorials, not polished essays — just notes from building things,
            breaking things, and occasionally understanding why.</p>
            <h3>What's here</h3>
            <ul>
              <li>Engineering deep-dives and career guides</li>
              <li>Build notes (including how this terminal portfolio was made)</li>
              <li>Tooling opinions I can't keep to myself</li>
            </ul>
            <p style="margin-top:1rem">The blog lives inside a terminal at <a href="/">hahuy.site</a> — type <code>ls blog/</code> to navigate it there.</p>
          </div>
          <ul class="post-list">
          ${items}
          </ul>
        </div>
      </main>
      <aside class="sidebar-right" id="graph-panel">
        <div class="graph-header">
          <span class="graph-label">Graph View</span>
        </div>
        <div class="graph-box">
          <canvas id="graph-canvas"></canvas>
          <button class="graph-expand-btn" id="graph-expand-btn" title="Expand graph">⊹</button>
        </div>
      </aside>
    </div>
  </div>
  <div class="graph-modal" id="graph-modal">
    <div class="graph-modal-inner">
      <canvas id="graph-canvas-modal"></canvas>
      <button class="graph-modal-close" id="graph-modal-close">✕</button>
    </div>
  </div>
  ${FOOTER_HTML}
  <a href="#" class="back-top" aria-label="Scroll to top">↑</a>
  <script>window.BLOG_META = ${JSON.stringify(meta)};</script>
  <script>${CLIENT_JS}</script>
</body>
</html>`;
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const manifestPath = join(CONTENT_BLOG, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("❌  content/blog/manifest.json not found");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Sort newest-first
  const sorted = [...manifest].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const allPostEntries = [];

  for (const entry of sorted) {
    const mdPath = join(CONTENT_BLOG, entry.file);
    if (!existsSync(mdPath)) {
      console.error(`❌  Missing source file: content/blog/${entry.file}`);
      process.exit(1);
    }

    const rawSrc = readFileSync(mdPath, "utf8");
    const body = stripFrontmatter(rawSrc);
    // Strip the leading H1 — the template injects <h1>${title}</h1> itself
    const bodyHtml = marked.parse(body).replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
    const slug = slugify(entry.file);
    const mins = readTime(bodyHtml);
    const folder = entry.folder ?? "";

    allPostEntries.push({ title: entry.title, date: entry.date, slug, bodyHtml, rawSrc, mins, folder });
  }

  // Exclude hello-world from post list (its content becomes the README intro)
  const postsForList = allPostEntries.filter((p) => p.slug !== README_SLUG);

  // Build graph links from raw markdown
  const graphLinks = buildGraphLinks(
    allPostEntries.map((p) => ({ slug: p.slug, rawSrc: p.rawSrc })),
  );

  // blogMeta passed to both templates
  const blogMeta = {
    posts: postsForList.map((p) => ({
      title: p.title,
      slug: p.slug,
      folder: p.folder,
      excerpt: excerpt(p.bodyHtml),
    })),
    links: graphLinks,
    currentSlug: null,
  };

  // Explorer HTML (all posts for list, no current slug on index)
  const explorerHtmlIndex = buildExplorerHtml(postsForList, null);

  // Write individual post pages (skip hello-world)
  mkdirSync(DIST_BLOG, { recursive: true });

  for (const post of postsForList) {
    const explorerHtml = buildExplorerHtml(postsForList, post.slug);
    const outDir = join(DIST_BLOG, post.slug);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "index.html");
    writeFileSync(
      outPath,
      postPage({
        title: post.title,
        date: post.date,
        slug: post.slug,
        bodyHtml: post.bodyHtml,
        mins: post.mins,
        blogMeta,
        explorerHtml,
      }),
      "utf8",
    );
    console.log(`  ✅ blog/${post.slug}/index.html`);
  }

  // Write index
  writeFileSync(join(DIST_BLOG, "index.html"), indexPage(postsForList, blogMeta, explorerHtmlIndex), "utf8");
  console.log(`  ✅ blog/index.html`);

  // Copy standalone graph assets into dist/blog/graphs/
  const graphsSrc = join(ROOT, "content", "blog", "graphs");
  if (existsSync(graphsSrc)) {
    const graphsDist = join(DIST_BLOG, "graphs");
    mkdirSync(graphsDist, { recursive: true });
    for (const file of readdirSync(graphsSrc)) {
      copyFileSync(join(graphsSrc, file), join(graphsDist, file));
      console.log(`  ✅ blog/graphs/${file}`);
    }
  }
}

main();
