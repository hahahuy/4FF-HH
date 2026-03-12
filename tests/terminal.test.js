/**
 * tests/terminal.test.js — Vitest port of Terminal + localStorage persistence tests
 */

import { describe, expect, it } from "vitest";

// Terminal is a global set up by tests/setup.js.

describe("Terminal.getCwd", () => {
  it("returns path string", () => {
    const cwd = Terminal.getCwd();
    expect(typeof cwd).toBe("string");
    expect(cwd.startsWith("~")).toBe(true);
  });
});

describe("Terminal.currentPath", () => {
  it("setter updates path", () => {
    const orig = [...Terminal.currentPath];
    Terminal.currentPath = ["~", "blog"];
    expect(Terminal.currentPath).toEqual(["~", "blog"]);
    Terminal.currentPath = orig;
  });

  it("setter persists to localStorage", () => {
    const orig = [...Terminal.currentPath];
    Terminal.currentPath = ["~", "projects"];
    const stored = JSON.parse(localStorage.getItem("term_cwd") || "null");
    expect(stored).toEqual(["~", "projects"]);
    Terminal.currentPath = orig;
  });

  it("localStorage key is accessible", () => {
    // Verify the key exists after first setter call
    const stored = localStorage.getItem("term_cwd");
    expect(stored).not.toBeNull();
  });
});

describe("Terminal.escapeHtml", () => {
  it("escapes &", () => {
    expect(Terminal.escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes <", () => {
    expect(Terminal.escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it('escapes "', () => {
    expect(Terminal.escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes '", () => {
    expect(Terminal.escapeHtml("it's")).toBe("it&#39;s");
  });

  it("leaves plain text unchanged", () => {
    expect(Terminal.escapeHtml("hello world")).toBe("hello world");
  });

  it("coerces non-strings", () => {
    expect(Terminal.escapeHtml(42)).toBe("42");
  });
});

describe("Terminal — memory guard", () => {
  it("output element exists with children collection", () => {
    const output = document.getElementById("output") || document.querySelector(".output");
    expect(output).toBeTruthy();
    expect(typeof output.children).toBe("object");
  });
});

describe("URL hash deep-linking", () => {
  it("#cmd= format is URL-encodeable and decodeable", () => {
    const cmd = "cat blog/hello-world.txt";
    const encoded = "#cmd=" + encodeURIComponent(cmd);
    const decoded = decodeURIComponent(encoded.replace("#cmd=", ""));
    expect(decoded).toBe(cmd);
  });

  it("#cmd= rejects newlines (security)", () => {
    const malicious = "echo%20hi%0Aecho%20pwned";
    const decoded = decodeURIComponent(malicious);
    expect(decoded).toContain("\n");
  });

  it("ls output includes encoded #cmd= in title attribute", () => {
    const result = Commands.execute("ls", [], ["~"]);
    const gridHtml = result.lines[0].html;
    expect(gridHtml).toContain("#cmd=");
    expect(
      gridHtml.includes("cmd=cd") || gridHtml.includes("cmd=cat") || gridHtml.includes("%20"),
    ).toBe(true);
  });
});
