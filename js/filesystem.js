/* ============================================================
   filesystem.js — Virtual Filesystem + Fetch Loader
   ============================================================ */

'use strict';

// Base path for fetching markdown content.
// Empty string = custom domain at root (hahuy.site).
// Change to '/4FF-HH' if reverting to github.io subpath.
const BASE = '';

/**
 * Virtual filesystem tree.
 *
 * Directories: objects with __type: 'dir'
 * Files:       objects with __type: 'file' and either:
 *   - src: string  → fetched from BASE + src at read time
 *   - content: string → inline text content
 */
const FS = {
  '~': {
    __type: 'dir',
    'about.txt': {
      __type: 'file',
      src: '/content/about.md',
    },
    'skills.txt': {
      __type: 'file',
      src: '/content/skills.md',
    },
    'contact.txt': {
      __type: 'file',
      src: '/content/contact.md',
    },
    'projects': {
      __type: 'dir',
      'README.txt': {
        __type: 'file',
        src: '/content/projects/README.md',
      },
    },
    'blog': {
      __type: 'dir',
      // Populated at runtime by loadBlogManifest()
    },
  },
};

// ── Path resolution helpers ─────────────────────────────────

/**
 * Resolve a path array + optional argument string to a node in FS.
 * Returns { node, path } or null if not found.
 *
 * @param {string[]} currentPath  e.g. ['~', 'projects']
 * @param {string}   [arg]        e.g. 'blog' or '../about.txt' or '~/skills.txt'
 */
function fsResolve(currentPath, arg) {
  let segments;

  if (!arg) {
    segments = [...currentPath];
  } else if (arg === '~' || arg === '/') {
    segments = ['~'];
  } else if (arg.startsWith('~/')) {
    segments = ['~', ...arg.slice(2).split('/').filter(Boolean)];
  } else {
    // Relative path
    segments = [...currentPath];
    const parts = arg.split('/').filter(Boolean);
    for (const part of parts) {
      if (part === '..') {
        if (segments.length > 1) segments.pop();
      } else if (part !== '.') {
        segments.push(part);
      }
    }
  }

  // Walk the FS tree
  let node = FS;
  for (const seg of segments) {
    if (node && typeof node === 'object' && seg in node) {
      node = node[seg];
    } else {
      return null;
    }
  }

  return { node, path: segments };
}

/**
 * List the entries of a directory node.
 * Returns array of { name, type } objects.
 */
function fsListDir(dirNode) {
  return Object.entries(dirNode)
    .filter(([k]) => !k.startsWith('__'))
    .map(([name, val]) => ({
      name,
      type: val.__type || 'file',
    }));
}

/**
 * Fetch file contents.  Returns a Promise<string>.
 * Handles both inline `content` and remote `src` nodes.
 */
async function fsReadFile(fileNode) {
  if (fileNode.content !== undefined) {
    return fileNode.content;
  }
  if (fileNode.src) {
    const url = BASE + fileNode.src;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    return await res.text();
  }
  throw new Error('file has no content or src');
}

/**
 * Return all entry names visible at a given virtual path
 * (used by autocomplete for file-argument completion).
 */
function fsEntriesAt(pathArr) {
  const result = fsResolve(pathArr);
  if (!result || result.node.__type !== 'dir') return [];
  return fsListDir(result.node).map(e => e.name);
}

/**
 * Fetch content/blog/manifest.json and populate the virtual ~/blog/ dir.
 * Called once at boot. Adding a new .md file + manifest entry is all
 * that's needed to make it appear — no changes to filesystem.js required.
 *
 * Manifest format: [{ "file": "post.md", "title": "...", "date": "YYYY-MM-DD" }]
 */
async function loadBlogManifest() {
  const blogNode = FS['~']['blog'];

  try {
    const res = await fetch(BASE + '/content/blog/manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();

    // Build index content dynamically from manifest
    const maxLen = posts.reduce((m, p) => Math.max(m, p.file.replace(/\.md$/, '.txt').length), 0);
    const indexLines = ['# Blog', '', 'Posts available:', ''];
    posts.forEach(p => {
      const name = p.file.replace(/\.md$/, '.txt');
      const pad  = ' '.repeat(Math.max(1, maxLen - name.length + 2));
      indexLines.push(`  ${name}${pad}— ${p.title}  (${p.date})`);
    });
    indexLines.push('', 'Read a post:  cat blog/<filename>.txt');

    blogNode['index.txt'] = {
      __type: 'file',
      content: indexLines.join('\n'),
    };

    // Register each post as a .txt file
    posts.forEach(p => {
      const name = p.file.replace(/\.md$/, '.txt');
      blogNode[name] = {
        __type: 'file',
        src: `/content/blog/${p.file}`,
      };
    });

  } catch (err) {
    // Fallback: leave blog dir empty with an error note
    blogNode['index.txt'] = {
      __type: 'file',
      content: `# Blog\n\nCould not load post list: ${err.message}`,
    };
  }
}

/**
 * Fetch published notes from the Cloud Function and populate
 * the virtual FS at boot time.
 * Notes with location='blog'     → FS['~']['blog']['<name>.txt']
 * Notes with location='projects' → FS['~']['projects']['<name>.txt']
 * Notes with location='root'     → FS['~']['<name>.txt']
 *
 * Called once in parallel with loadBlogManifest() at terminal boot.
 */
async function loadPublishedNotes() {
  const CF = 'https://asia-southeast1-hahuy-portfolio-f7f16.cloudfunctions.net';
  try {
    const res = await fetch(`${CF}/notesListPublic`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    '{}',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.notes) || !data.notes.length) return;

    data.notes.forEach(n => {
      if (!n.filename || !/^[a-zA-Z0-9_-]+\.md$/.test(n.filename)) return;
      if (typeof n.content !== 'string') return;
      const txtName = n.filename.replace(/\.md$/, '.txt');
      const node    = { __type: 'file', content: n.content };
      if (n.location === 'blog') {
        FS['~']['blog'][txtName] = node;
      } else if (n.location === 'projects') {
        FS['~']['projects'][txtName] = node;
      } else if (n.location === 'root') {
        FS['~'][txtName] = node;
      }
    });
  } catch (e) { /* fail silently — FS still works without published notes */ }
}
