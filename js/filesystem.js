// Base path for fetching markdown content.
// Set via Config.CONTENT_BASE (js/utils/config.js).
// '' = custom domain at root (hahuy.site).
// '/4FF-HH' = GitHub Pages subpath deploy.
const BASE = (globalThis.BASE = Config.CONTENT_BASE);

/**
 * Virtual filesystem tree.
 *
 * Directories: objects with __type: 'dir'
 * Files:       objects with __type: 'file' and either:
 *   - src: string  → fetched from BASE + src at read time
 *   - content: string → inline text content
 */
const FS = (globalThis.FS = {
  "~": {
    __type: "dir",
    "about.md": {
      __type: "file",
      src: "/content/about.md",
    },
    "skills.md": {
      __type: "file",
      src: "/content/skills.md",
    },
    "contact.md": {
      __type: "file",
      src: "/content/contact.md",
    },
    "transformers.py": {
      __type: "file",
      content: `import numpy as np

def softmax(x):
    exp_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

def layer_norm(x, eps=1e-5):
    mean = np.mean(x, axis=-1, keepdims=True)
    var  = np.var(x, axis=-1, keepdims=True)
    return (x - mean) / np.sqrt(var + eps)

def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

def attention(Q, K, V, mask=None):
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    if mask is not None:
        scores = scores + (mask * -1e9)
    weights = softmax(scores)
    return weights @ V, weights

class MultiHeadAttention:
    def __init__(self, d_model, n_heads):
        assert d_model % n_heads == 0
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        np.random.seed(42)
        self.W_q = np.random.randn(d_model, d_model) * 0.01
        self.W_k = np.random.randn(d_model, d_model) * 0.01
        self.W_v = np.random.randn(d_model, d_model) * 0.01
        self.W_o = np.random.randn(d_model, d_model) * 0.01

    def forward(self, x, mask=None):
        seq_len, _ = x.shape
        Q = (x @ self.W_q).reshape(seq_len, self.n_heads, self.d_k).transpose(1, 0, 2)
        K = (x @ self.W_k).reshape(seq_len, self.n_heads, self.d_k).transpose(1, 0, 2)
        V = (x @ self.W_v).reshape(seq_len, self.n_heads, self.d_k).transpose(1, 0, 2)
        outputs = [attention(Q[i], K[i], V[i], mask)[0] for i in range(self.n_heads)]
        return np.concatenate(outputs, axis=-1) @ self.W_o

class FeedForward:
    def __init__(self, d_model, d_ff=None):
        d_ff = d_ff or 4 * d_model
        self.W1 = np.random.randn(d_model, d_ff) * 0.01
        self.W2 = np.random.randn(d_ff, d_model) * 0.01

    def forward(self, x):
        return gelu(x @ self.W1) @ self.W2

class TransformerBlock:
    def __init__(self, d_model=128, n_heads=4, d_ff=None):
        self.attention = MultiHeadAttention(d_model, n_heads)
        self.ffn       = FeedForward(d_model, d_ff)

    def forward(self, x, mask=None):
        x = layer_norm(x + self.attention.forward(x, mask))
        x = layer_norm(x + self.ffn.forward(x))
        return x

def positional_encoding(seq_len, d_model):
    position = np.arange(seq_len)[:, np.newaxis]
    div_term = np.exp(np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model))
    pe = np.zeros((seq_len, d_model))
    pe[:, 0::2] = np.sin(position * div_term)
    pe[:, 1::2] = np.cos(position * div_term)
    return pe

class MicroTransformer:
    def __init__(self, vocab_size=1000, d_model=128, n_heads=4, n_layers=2):
        self.d_model = d_model
        self.token_embeddings = np.random.randn(vocab_size, d_model) * 0.01
        self.blocks = [TransformerBlock(d_model, n_heads) for _ in range(n_layers)]

    def forward(self, token_ids, mask=None):
        x = self.token_embeddings[token_ids] + positional_encoding(len(token_ids), self.d_model)
        for block in self.blocks:
            x = block.forward(x, mask)
        return x
`,
    },
    "resume.pdf": {
      __type: "file",
      src: "/content/resume.pdf",
      mimeType: "application/pdf",
    },
    projects: {
      __type: "dir",
      "README.md": {
        __type: "file",
        src: "/content/projects/README.md",
      },
    },
    blog: {
      __type: "dir",
      // Populated at runtime by loadBlogManifest()
    },
    image: {
      __type: "dir",
      // Populated at runtime by loadUploadedImages()
    },
  },
});

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
  } else if (arg === "~" || arg === "/") {
    segments = ["~"];
  } else if (arg.startsWith("~/")) {
    segments = ["~", ...arg.slice(2).split("/").filter(Boolean)];
  } else {
    // Relative path
    segments = [...currentPath];
    const parts = arg.split("/").filter(Boolean);
    for (const part of parts) {
      if (part === "..") {
        if (segments.length > 1) segments.pop();
      } else if (part !== ".") {
        segments.push(part);
      }
    }
  }

  // Walk the FS tree
  let node = /** @type {any} */ (FS);
  for (const seg of segments) {
    if (node && typeof node === "object" && seg in node) {
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
    .filter(([k]) => !k.startsWith("__"))
    .map(([name, val]) => ({
      name,
      type: val.__type || "file",
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
  throw new Error("file has no content or src");
}

/**
 * Return all entry names visible at a given virtual path
 * (used by autocomplete for file-argument completion).
 */
function fsEntriesAt(pathArr) {
  const result = fsResolve(pathArr);
  if (!result || result.node.__type !== "dir") return [];
  return fsListDir(result.node).map((e) => e.name);
}

/**
 * Fetch content/blog/manifest.json and populate the virtual ~/blog/ dir.
 * Called once at boot. Adding a new .md file + manifest entry is all
 * that's needed to make it appear — no changes to filesystem.js required.
 *
 * Manifest format: [{ "file": "post.md", "title": "...", "date": "YYYY-MM-DD" }]
 */
async function loadBlogManifest() {
  const blogNode = FS["~"].blog;

  try {
    const res = await fetch(`${BASE}/content/blog/manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();

    // Build index content dynamically from manifest
    const maxLen = posts.reduce((m, p) => Math.max(m, p.file.length), 0);
    const indexLines = ["# Blog", "", "Posts available:", ""];
    posts.forEach((p) => {
      const name = p.file;
      const pad = " ".repeat(Math.max(1, maxLen - name.length + 2));
      indexLines.push(`  ${name}${pad}— ${p.title}  (${p.date})`);
    });
    indexLines.push("", "Read a post:  cat blog/<filename>.md");

    blogNode["index.md"] = {
      __type: "file",
      content: indexLines.join("\n"),
    };

    // Register each post as a .md file
    posts.forEach((p) => {
      blogNode[p.file] = {
        __type: "file",
        src: `/content/blog/${p.file}`,
      };
    });
  } catch (err) {
    // Fallback: leave blog dir empty with an error note
    blogNode["index.md"] = {
      __type: "file",
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
  const CF = Config.CF_BASE;
  const controller = new AbortController();
  const _timer = setTimeout(() => controller.abort(), 3000); // 3s — covers CF cold start
  try {
    const res = await fetch(`${CF}/notesListPublic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    clearTimeout(_timer);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.notes) || !data.notes.length) return;

    data.notes.forEach((n) => {
      if (!n.filename || !/^[a-zA-Z0-9_-]+\.md$/.test(n.filename)) return;
      if (typeof n.content !== "string") return;
      const node = { __type: "file", content: n.content };
      if (n.location === "blog") {
        FS["~"].blog[n.filename] = node;
      } else if (n.location === "projects") {
        FS["~"].projects[n.filename] = node;
      } else if (n.location === "root") {
        FS["~"][n.filename] = node;
      }
    });
  } catch (e) {
    clearTimeout(_timer);
    /* fail silently — FS still works without published notes */
  }
}

// ── MIME helpers ─────────────────────────────────────────────

/**
 * Extension → MIME type lookup for binary/media files.
 * Used by `cat` to decide how to render a file (image vs PDF vs text).
 */
const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/**
 * Return the MIME type for a file node.
 * Prefers node.mimeType if set, otherwise falls back to extension lookup.
 *
 * @param {string}  filename  e.g. 'photo.png', 'resume.pdf'
 * @param {object}  [node]    FS node (may have a mimeType property)
 * @returns {string|null}
 */
function fsMimeType(filename, node) {
  if (node?.mimeType) return node.mimeType;
  const ext = (filename || "").split(".").pop().toLowerCase();
  return MIME_BY_EXT[ext] || null;
}

/**
 * Fetch content/images/manifest.json and populate the virtual ~/images/ dir.
 * Called once at boot in parallel with loadBlogManifest + loadPublishedNotes.
 * Falls back silently on 404 (no images uploaded yet).
 *
 * Manifest format: [{ "name": "photo.png", "mimeType": "image/png" }, ...]
 */
async function loadUploadedImages() {
  const imagesNode = FS["~"].image;
  try {
    const res = await fetch(`${BASE}/content/images/manifest.json`);
    if (!res.ok) return; // 404 = no images yet — silent fallback

    const entries = await res.json();
    if (!Array.isArray(entries)) return;

    entries.forEach((entry) => {
      if (!entry.name || typeof entry.name !== "string") return;
      if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(entry.name)) return;
      imagesNode[entry.name] = {
        __type: "file",
        src: `/content/images/${entry.name}`,
        mimeType:
          typeof entry.mimeType === "string"
            ? entry.mimeType
            : `image/${entry.name.split(".").pop().toLowerCase()}`,
      };
    });
  } catch (_) {
    /* fail silently — images dir stays empty */
  }
}

// Export to globalThis for modules loaded via new Function(src)()
globalThis.fsResolve = fsResolve;
globalThis.fsListDir = fsListDir;
globalThis.fsReadFile = fsReadFile;
globalThis.fsEntriesAt = fsEntriesAt;
globalThis.loadBlogManifest = loadBlogManifest;
globalThis.loadPublishedNotes = loadPublishedNotes;
globalThis.loadUploadedImages = loadUploadedImages;
globalThis.MIME_BY_EXT = MIME_BY_EXT;
globalThis.fsMimeType = fsMimeType;
