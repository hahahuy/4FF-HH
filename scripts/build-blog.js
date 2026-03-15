#!/usr/bin/env node
/**
 * scripts/build-blog.js
 * Generates dist/blog/ from content/blog/ source files.
 * Run after `vite build` and `minify-js.js`.
 *
 *   node scripts/build-blog.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { marked } from "marked";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_BLOG = join(ROOT, "content", "blog");
const DIST_BLOG = join(ROOT, "dist", "blog");

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
  }
  nav {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    padding: .75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-size: .85rem;
    background: var(--bg-window);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 0 var(--border-color);
  }
  nav a {
    color: var(--color-blue);
    text-decoration: none;
  }
  nav a:hover { text-decoration: underline; }
  article, .index-body {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  h1 { font-size: 1.75rem; margin-bottom: .35rem; line-height: 1.3; color: var(--color-green); }
  h2 { font-size: 1.2rem; margin: 1.6rem 0 .5rem; }
  h3 { font-size: 1rem; margin: 1.4rem 0 .4rem; }
  time { color: var(--text-muted); font-size: .85rem; display: block; margin-bottom: .5rem; letter-spacing: .03em; }
  p { margin-bottom: 1rem; }
  a { color: var(--color-blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre {
    background: var(--bg-window);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--color-blue);
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    margin-bottom: 1rem;
    line-height: 1.55;
  }
  code {
    font-family: var(--font-mono);
    font-size: .9em;
    line-height: 1.55;
  }
  p code, li code {
    background: var(--bg-window);
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
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: .9rem;
  }
  th, td {
    border: 1px solid var(--border-color);
    padding: .4rem .75rem;
    text-align: left;
  }
  th { background: var(--bg-window); color: var(--color-green); }
  hr { border: none; border-top: 1px solid var(--border-color); margin: 2rem 0; opacity: .4; }
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
  .post-list li:hover {
    background: rgba(88,166,255,.06);
    border-left-color: var(--color-blue);
  }
  .post-list a { font-weight: 500; }
  .post-list time { font-size: .8rem; white-space: nowrap; flex-shrink: 0; margin-bottom: 0; }
  .page-title {
    font-size: 1.3rem;
    margin-bottom: 1.5rem;
    color: var(--color-green);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: .5rem;
  }
  .post-meta {
    font-size: .78rem;
    color: var(--text-muted);
    display: inline-block;
    margin-bottom: 1.5rem;
    letter-spacing: .02em;
  }
  .back-top {
    display: inline-block;
    margin-top: 2.5rem;
    font-size: .82rem;
    color: var(--text-muted);
    text-decoration: none;
    transition: color .15s;
  }
  .back-top:hover { color: var(--color-blue); text-decoration: none; }
  @media (max-width: 600px) {
    html { font-size: 13px; }
    article, .index-body { padding: 1rem; }
    .post-list li { flex-direction: column; gap: .15rem; }
  }
`;

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

// ─── templates ────────────────────────────────────────────────────────────────

function postPage({ title, date, slug, bodyHtml, mins }) {
  const desc = excerpt(bodyHtml);
  const url = `https://hahuy.site/blog/${slug}/`;
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
  <nav>
    <a href="/">[← terminal]</a>
    <a href="/blog/">[all posts]</a>
  </nav>
  <article>
    <h1>${title}</h1>
    <time datetime="${date}">${formatDate(date)}</time>
    <span class="post-meta">~${mins} min read</span>
    ${bodyHtml}
    <a href="#" class="back-top">↑ top</a>
  </article>
</body>
</html>`;
}

function indexPage(posts) {
  const items = posts
    .map(
      ({ title, date, slug }) =>
        `<li>
      <a href="/blog/${slug}/">• ${title}</a>
      <time datetime="${date}">${formatDate(date)}</time>
    </li>`,
    )
    .join("\n    ");

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
  <nav>
    <a href="/">[← back to terminal]</a>
  </nav>
  <div class="index-body">
    <h1 class="page-title">~/blog</h1>
    <ul class="post-list">
    ${items}
    </ul>
  </div>
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

  const posts = [];

  for (const entry of sorted) {
    const mdPath = join(CONTENT_BLOG, entry.file);
    if (!existsSync(mdPath)) {
      console.error(`❌  Missing source file: content/blog/${entry.file}`);
      process.exit(1);
    }

    const src = readFileSync(mdPath, "utf8");
    const body = stripFrontmatter(src);
    const bodyHtml = marked.parse(body);
    const slug = slugify(entry.file);
    const mins = readTime(bodyHtml);

    posts.push({ title: entry.title, date: entry.date, slug, bodyHtml });

    const outDir = join(DIST_BLOG, slug);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "index.html");
    writeFileSync(outPath, postPage({ title: entry.title, date: entry.date, slug, bodyHtml, mins }), "utf8");
    console.log(`  ✅ blog/${slug}/index.html`);
  }

  // Write index
  mkdirSync(DIST_BLOG, { recursive: true });
  writeFileSync(join(DIST_BLOG, "index.html"), indexPage(posts), "utf8");
  console.log(`  ✅ blog/index.html`);
}

main();
