/* ============================================================
   filesystem.js — Virtual Filesystem + Fetch Loader
   ============================================================ */

'use strict';

// Base path for fetching markdown content (GitHub Pages subpath)
const BASE = '/4FF-HH';

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
        src: '/content/projects.md',
      },
    },
    'blog': {
      __type: 'dir',
      // Future posts will be added here dynamically
      // For now, hint file to guide the user
      'index.txt': {
        __type: 'file',
        content: '# Blog\n\nComing soon. Future posts will appear here.\n\nCheck back later — or `open github` for updates.',
      },
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
