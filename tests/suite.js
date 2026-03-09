/* ============================================================
   tests/suite.js — In-browser test runner for 4FF-HH terminal
   No build step, no dependencies. Run via tests/index.html.
   ============================================================ */

'use strict';

const T = (() => {
  let _pass = 0, _fail = 0;
  const results = [];

  function assert(desc, fn) {
    try {
      fn();
      results.push({ ok: true, desc });
      _pass++;
    } catch (err) {
      results.push({ ok: false, desc, err: err.message });
      _fail++;
    }
  }

  function eq(a, b) {
    const as = JSON.stringify(a), bs = JSON.stringify(b);
    if (as !== bs) throw new Error(`Expected ${bs}, got ${as}`);
  }

  function ok(val, msg = 'value should be truthy') {
    if (!val) throw new Error(msg);
  }

  function notOk(val, msg = 'value should be falsy') {
    if (val) throw new Error(msg);
  }

  function throws(fn, msg = 'should throw') {
    try { fn(); throw new Error(msg); }
    catch (e) { if (e.message === msg) throw e; }
  }

  async function run(suiteFn) {
    await suiteFn({ assert, eq, ok, notOk, throws });
    return { pass: _pass, fail: _fail, results };
  }

  return { run };
})();

// ── Test suites ───────────────────────────────────────────────

async function runAllSuites() {
  return T.run(async ({ assert, eq, ok, notOk }) => {

    /* ── fsResolve ─────────────────────────────────────────── */
    assert('fsResolve: no arg returns current path node', () => {
      const r = fsResolve(['~'], null);
      ok(r, 'result exists');
      eq(r.node.__type, 'dir');
      eq(r.path, ['~']);
    });

    assert('fsResolve: "~" resets to home', () => {
      const r = fsResolve(['~', 'projects'], '~');
      eq(r.path, ['~']);
    });

    assert('fsResolve: "/" resets to home', () => {
      const r = fsResolve(['~', 'blog'], '/');
      eq(r.path, ['~']);
    });

    assert('fsResolve: absolute ~/path resolves correctly', () => {
      const r = fsResolve(['~'], '~/projects');
      ok(r, 'result exists');
      eq(r.path, ['~', 'projects']);
      eq(r.node.__type, 'dir');
    });

    assert('fsResolve: relative dir segment', () => {
      const r = fsResolve(['~'], 'blog');
      ok(r, 'result exists');
      eq(r.node.__type, 'dir');
      eq(r.path, ['~', 'blog']);
    });

    assert('fsResolve: relative file resolution', () => {
      const r = fsResolve(['~'], 'about.txt');
      ok(r, 'result exists');
      eq(r.node.__type, 'file');
    });

    assert('fsResolve: ".." goes up one level', () => {
      const r = fsResolve(['~', 'projects'], '..');
      eq(r.path, ['~']);
    });

    assert('fsResolve: ".." at root stays at root', () => {
      const r = fsResolve(['~'], '..');
      eq(r.path, ['~']);
    });

    assert('fsResolve: non-existent path returns null', () => {
      const r = fsResolve(['~'], 'does-not-exist.txt');
      eq(r, null);
    });

    assert('fsResolve: deeply nested file', () => {
      const r = fsResolve(['~'], 'projects/README.txt');
      ok(r, 'result exists');
      eq(r.node.__type, 'file');
    });

    assert('fsResolve: blog/index.txt resolves', () => {
      const r = fsResolve(['~'], 'blog/index.txt');
      ok(r, 'result exists');
      eq(r.node.__type, 'file');
    });

    assert('fsResolve: blog posts resolve', () => {
      const r1 = fsResolve(['~'], 'blog/hello-world.txt');
      const r2 = fsResolve(['~'], 'blog/building-a-cli-portfolio.txt');
      ok(r1, 'hello-world.txt exists');
      ok(r2, 'building-a-cli-portfolio.txt exists');
    });

    /* ── fsListDir ─────────────────────────────────────────── */
    assert('fsListDir: lists home directory entries', () => {
      const r = fsResolve(['~'], null);
      const entries = fsListDir(r.node);
      ok(entries.length > 0, 'has entries');
      const names = entries.map(e => e.name);
      ok(names.includes('about.txt'), 'about.txt present');
      ok(names.includes('skills.txt'), 'skills.txt present');
      ok(names.includes('projects'), 'projects dir present');
      ok(names.includes('blog'), 'blog dir present');
    });

    assert('fsListDir: entries have correct type flags', () => {
      const r = fsResolve(['~'], null);
      const entries = fsListDir(r.node);
      const projects = entries.find(e => e.name === 'projects');
      const about    = entries.find(e => e.name === 'about.txt');
      eq(projects.type, 'dir');
      eq(about.type,    'file');
    });

    assert('fsListDir: blog has expected posts', () => {
      const r = fsResolve(['~', 'blog'], null);
      const entries = fsListDir(r.node);
      const names = entries.map(e => e.name);
      ok(names.includes('hello-world.txt'), 'hello-world.txt');
      ok(names.includes('building-a-cli-portfolio.txt'), 'building-a-cli-portfolio.txt');
      ok(names.includes('index.txt'), 'index.txt');
    });

    assert('fsListDir: does not expose __type as entry', () => {
      const r = fsResolve(['~'], null);
      const entries = fsListDir(r.node);
      const hasType = entries.some(e => e.name === '__type');
      notOk(hasType, 'should not expose __type');
    });

    /* ── fsReadFile ────────────────────────────────────────── */
    assert('fsReadFile: inline content resolves immediately', async () => {
      const r = fsResolve(['~', 'blog'], 'index.txt');
      ok(r, 'file found');
      const content = await fsReadFile(r.node);
      ok(content.includes('Blog'), 'content contains Blog');
    });

    /* ── fsEntriesAt ───────────────────────────────────────── */
    assert('fsEntriesAt: returns names for valid path', () => {
      const names = fsEntriesAt(['~']);
      ok(Array.isArray(names), 'is array');
      ok(names.includes('about.txt'), 'includes about.txt');
    });

    assert('fsEntriesAt: returns [] for invalid path', () => {
      const names = fsEntriesAt(['~', 'ghost']);
      eq(names, []);
    });

    assert('fsEntriesAt: returns [] for file node', () => {
      const names = fsEntriesAt(['~', 'about.txt']);
      eq(names, []);
    });

    /* ── Commands.execute ──────────────────────────────────── */
    assert('Commands: help returns lines array', () => {
      const result = Commands.execute('help', [], ['~']);
      ok(result.lines && result.lines.length > 0, 'has lines');
    });

    assert('Commands: ls ~ returns entries', () => {
      const result = Commands.execute('ls', [], ['~']);
      ok(result.lines && result.lines.length > 0, 'has lines');
    });

    assert('Commands: ls nonexistent returns error', () => {
      const result = Commands.execute('ls', ['ghost'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: cd projects returns newPath', () => {
      const result = Commands.execute('cd', ['projects'], ['~']);
      eq(result.newPath, ['~', 'projects']);
    });

    assert('Commands: cd .. from projects goes to ~', () => {
      const result = Commands.execute('cd', ['..'], ['~', 'projects']);
      eq(result.newPath, ['~']);
    });

    assert('Commands: cd nonexistent returns error', () => {
      const result = Commands.execute('cd', ['ghost'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: cd into a file returns error', () => {
      const result = Commands.execute('cd', ['about.txt'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: pwd returns current path string', () => {
      const result = Commands.execute('pwd', [], ['~', 'projects']);
      ok(result.lines, 'has lines');
      const html = result.lines[0].html;
      ok(html.includes('~/projects'), 'path in output');
    });

    assert('Commands: whoami returns lines', () => {
      const result = Commands.execute('whoami', [], ['~']);
      ok(result.lines && result.lines.length > 0, 'has lines');
    });

    assert('Commands: clear returns clear:true', () => {
      const result = Commands.execute('clear', [], ['~']);
      eq(result.clear, true);
    });

    assert('Commands: echo returns input text', () => {
      const result = Commands.execute('echo', ['hello', 'world'], ['~']);
      ok(result.lines, 'has lines');
      ok(result.lines[0].html.includes('hello world'), 'text in output');
    });

    assert('Commands: echo empty returns empty line', () => {
      const result = Commands.execute('echo', [], ['~']);
      ok(result.lines, 'has lines');
    });

    assert('Commands: cat without arg returns error', () => {
      const result = Commands.execute('cat', [], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: cat nonexistent file returns error', () => {
      const result = Commands.execute('cat', ['ghost.txt'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: cat a directory returns error', () => {
      const result = Commands.execute('cat', ['projects'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: cat inline file returns loading line (async fetch)', () => {
      // blog/index.txt is inline so the loading line + async markdown
      const result = Commands.execute('cat', ['blog/index.txt'], ['~']);
      // Should return at least a loading indicator line
      ok(result.lines || result.markdown, 'returns some output descriptor');
    });

    assert('Commands: open without arg returns usage', () => {
      const result = Commands.execute('open', [], ['~']);
      ok(result.lines, 'has lines');
    });

    assert('Commands: open unknown alias returns error', () => {
      const result = Commands.execute('open', ['foobar'], ['~']);
      ok(result.error, 'has error');
    });

    assert('Commands: history returns lines (may be empty)', () => {
      const result = Commands.execute('history', [], ['~']);
      ok(result.lines, 'has lines');
    });

    assert('Commands: unknown command returns error line', () => {
      const result = Commands.execute('foobar', [], ['~']);
      ok(result.lines, 'has lines');
      const html = result.lines[0].html;
      ok(html.includes('command not found'), 'error in output');
    });

    assert('Commands: empty command returns null', () => {
      const result = Commands.execute('', [], ['~']);
      eq(result, null);
    });

    assert('Commands: names() returns array of command names', () => {
      const names = Commands.names();
      ok(Array.isArray(names), 'is array');
      ok(names.includes('help'), 'includes help');
      ok(names.includes('ls'), 'includes ls');
      ok(names.includes('cd'), 'includes cd');
      ok(names.includes('cat'), 'includes cat');
      ok(names.includes('clear'), 'includes clear');
    });

    /* ── Terminal.escapeHtml ───────────────────────────────── */
    assert('Terminal.escapeHtml: escapes &', () => {
      eq(Terminal.escapeHtml('a & b'), 'a &amp; b');
    });

    assert('Terminal.escapeHtml: escapes <', () => {
      eq(Terminal.escapeHtml('<script>'), '&lt;script&gt;');
    });

    assert('Terminal.escapeHtml: escapes "', () => {
      eq(Terminal.escapeHtml('"hello"'), '&quot;hello&quot;');
    });

    assert("Terminal.escapeHtml: escapes '", () => {
      eq(Terminal.escapeHtml("it's"), 'it&#39;s');
    });

    assert('Terminal.escapeHtml: leaves plain text unchanged', () => {
      eq(Terminal.escapeHtml('hello world'), 'hello world');
    });

    assert('Terminal.escapeHtml: coerces non-strings', () => {
      eq(Terminal.escapeHtml(42), '42');
    });

    /* ── Terminal.getCwd ───────────────────────────────────── */
    assert('Terminal.getCwd: returns path string', () => {
      const cwd = Terminal.getCwd();
      ok(typeof cwd === 'string', 'is string');
      ok(cwd.startsWith('~'), 'starts with ~');
    });

    /* ── Terminal.currentPath getter/setter ─────────────────── */
    assert('Terminal.currentPath: setter updates path', () => {
      const orig = [...Terminal.currentPath];
      Terminal.currentPath = ['~', 'blog'];
      eq(Terminal.currentPath, ['~', 'blog']);
      // restore
      Terminal.currentPath = orig;
    });

  });
}
