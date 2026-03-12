/**
 * tests/filesystem.test.js — Vitest port of fsResolve / fsListDir / fsReadFile / fsEntriesAt tests
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Filesystem globals are set up by tests/setup.js (beforeAll).
// fsResolve, fsListDir, fsReadFile, fsEntriesAt, FS are all globals.

describe('fsResolve', () => {
  it('no arg returns current path node', () => {
    const r = fsResolve(['~'], null);
    expect(r).toBeTruthy();
    expect(r.node.__type).toBe('dir');
    expect(r.path).toEqual(['~']);
  });

  it('"~" resets to home', () => {
    const r = fsResolve(['~', 'projects'], '~');
    expect(r.path).toEqual(['~']);
  });

  it('"/" resets to home', () => {
    const r = fsResolve(['~', 'blog'], '/');
    expect(r.path).toEqual(['~']);
  });

  it('absolute ~/path resolves correctly', () => {
    const r = fsResolve(['~'], '~/projects');
    expect(r).toBeTruthy();
    expect(r.path).toEqual(['~', 'projects']);
    expect(r.node.__type).toBe('dir');
  });

  it('relative dir segment', () => {
    const r = fsResolve(['~'], 'blog');
    expect(r).toBeTruthy();
    expect(r.node.__type).toBe('dir');
    expect(r.path).toEqual(['~', 'blog']);
  });

  it('relative file resolution', () => {
    const r = fsResolve(['~'], 'about.md');
    expect(r).toBeTruthy();
    expect(r.node.__type).toBe('file');
  });

  it('".." goes up one level', () => {
    const r = fsResolve(['~', 'projects'], '..');
    expect(r.path).toEqual(['~']);
  });

  it('".." at root stays at root', () => {
    const r = fsResolve(['~'], '..');
    expect(r.path).toEqual(['~']);
  });

  it('non-existent path returns null', () => {
    const r = fsResolve(['~'], 'does-not-exist.md');
    expect(r).toBeNull();
  });

  it('deeply nested file', () => {
    const r = fsResolve(['~'], 'projects/README.md');
    expect(r).toBeTruthy();
    expect(r.node.__type).toBe('file');
  });

  it('blog/index.md resolves', () => {
    const r = fsResolve(['~'], 'blog/index.md');
    expect(r).toBeTruthy();
    expect(r.node.__type).toBe('file');
  });

  it('blog posts resolve', () => {
    const r1 = fsResolve(['~'], 'blog/hello-world.md');
    const r2 = fsResolve(['~'], 'blog/building-a-cli-portfolio.md');
    expect(r1).toBeTruthy();
    expect(r2).toBeTruthy();
  });
});

describe('fsListDir', () => {
  it('lists home directory entries', () => {
    const r = fsResolve(['~'], null);
    const entries = fsListDir(r.node);
    expect(entries.length).toBeGreaterThan(0);
    const names = entries.map(e => e.name);
    expect(names).toContain('about.md');
    expect(names).toContain('skills.md');
    expect(names).toContain('projects');
    expect(names).toContain('blog');
  });

  it('entries have correct type flags', () => {
    const r = fsResolve(['~'], null);
    const entries = fsListDir(r.node);
    const projects = entries.find(e => e.name === 'projects');
    const about    = entries.find(e => e.name === 'about.md');
    expect(projects.type).toBe('dir');
    expect(about.type).toBe('file');
  });

  it('blog has expected posts', () => {
    const r = fsResolve(['~', 'blog'], null);
    const entries = fsListDir(r.node);
    const names = entries.map(e => e.name);
    expect(names).toContain('hello-world.md');
    expect(names).toContain('building-a-cli-portfolio.md');
    expect(names).toContain('index.md');
  });

  it('does not expose __type as entry', () => {
    const r = fsResolve(['~'], null);
    const entries = fsListDir(r.node);
    expect(entries.some(e => e.name === '__type')).toBe(false);
  });
});

describe('fsReadFile', () => {
  it('inline content resolves immediately', async () => {
    const r = fsResolve(['~', 'blog'], 'index.md');
    expect(r).toBeTruthy();
    const content = await fsReadFile(r.node);
    expect(content).toContain('Blog');
  });
});

describe('fsEntriesAt', () => {
  it('returns names for valid path', () => {
    const names = fsEntriesAt(['~']);
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain('about.md');
  });

  it('returns [] for invalid path', () => {
    expect(fsEntriesAt(['~', 'ghost'])).toEqual([]);
  });

  it('returns [] for file node', () => {
    expect(fsEntriesAt(['~', 'about.md'])).toEqual([]);
  });
});
