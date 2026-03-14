/**
 * tests/commands.test.js — Vitest port of Commands.execute tests
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Commands, Terminal, App.* are all globals set up by tests/setup.js.

function mockCtx() {
  return {
    appendLine: () => {},
    appendHTML: () => {},
    scrollBottom: () => {},
    winEl: document.querySelector(".terminal-window"),
  };
}

describe("Commands.execute — core commands", () => {
  it("help returns lines array", () => {
    const result = Commands.execute("help", [], ["~"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("help includes core commands (theme, grep, download)", () => {
    const result = Commands.execute("help", [], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(allHtml).toContain("theme");
    expect(allHtml).toContain("grep");
    expect(allHtml).toContain("download");
  });

  it("ls ~ returns entries", () => {
    const result = Commands.execute("ls", [], ["~"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("ls ~ output includes shareable #cmd= link in title", () => {
    const result = Commands.execute("ls", [], ["~"]);
    const gridHtml = result.lines[0].html;
    expect(gridHtml).toContain("#cmd=");
  });

  it("ls nonexistent returns error", () => {
    const result = Commands.execute("ls", ["ghost"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("cd projects returns newPath", () => {
    const result = Commands.execute("cd", ["projects"], ["~"]);
    expect(result.newPath).toEqual(["~", "projects"]);
  });

  it("cd .. from projects goes to ~", () => {
    const result = Commands.execute("cd", [".."], ["~", "projects"]);
    expect(result.newPath).toEqual(["~"]);
  });

  it("cd nonexistent returns error", () => {
    const result = Commands.execute("cd", ["ghost"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("cd into a file returns error", () => {
    const result = Commands.execute("cd", ["about.md"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("pwd returns current path string", () => {
    const result = Commands.execute("pwd", [], ["~", "projects"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines[0].html).toContain("~/projects");
  });

  it("whoami returns lines", () => {
    const result = Commands.execute("whoami", [], ["~"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("clear returns clear:true", () => {
    const result = Commands.execute("clear", [], ["~"]);
    expect(result.clear).toBe(true);
  });

  it("echo returns input text", () => {
    const result = Commands.execute("echo", ["hello", "world"], ["~"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines[0].html).toContain("hello world");
  });

  it("echo empty returns empty line", () => {
    const result = Commands.execute("echo", [], ["~"]);
    expect(result.lines).toBeTruthy();
  });

  it("cat without arg returns error", () => {
    const result = Commands.execute("cat", [], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("cat nonexistent file returns error", () => {
    const result = Commands.execute("cat", ["ghost.md"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("cat a directory returns error", () => {
    const result = Commands.execute("cat", ["projects"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("cat inline file returns output descriptor", () => {
    const result = Commands.execute("cat", ["blog/index.md"], ["~"], mockCtx());
    expect(result === null || result?.lines || result?.markdown).toBeTruthy();
  });

  it("open without arg returns usage", () => {
    const result = Commands.execute("open", [], ["~"]);
    expect(result.lines).toBeTruthy();
  });

  it("open unknown alias returns error", () => {
    const result = Commands.execute("open", ["foobar"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("history returns lines (may be empty)", () => {
    const result = Commands.execute("history", [], ["~"]);
    expect(result.lines).toBeTruthy();
  });

  it("history ordering — oldest entry shown first", () => {
    const hist = Terminal.commandHistory;
    if (hist.length < 2) return;
    const result = Commands.execute("history", [], ["~"]);
    expect(result.lines).toBeTruthy();
    const lastLine = result.lines[result.lines.length - 1].html;
    const firstLine = result.lines[0].html;
    const lastNum = Number.parseInt(lastLine.match(/(\d+)/)[1], 10);
    const firstNum = Number.parseInt(firstLine.match(/(\d+)/)[1], 10);
    expect(lastNum).toBeGreaterThan(firstNum);
  });

  it("unknown command returns error line", () => {
    const result = Commands.execute("foobar", [], ["~"]);
    expect(result.lines).toBeTruthy();
    expect(result.lines[0].html).toContain("command not found");
  });

  it("empty command returns null", () => {
    expect(Commands.execute("", [], ["~"])).toBeNull();
  });

  it("names() returns array of command names", () => {
    const names = Commands.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain("help");
    expect(names).toContain("ls");
    expect(names).toContain("cd");
    expect(names).toContain("cat");
    expect(names).toContain("clear");
    expect(names).toContain("theme");
    expect(names).toContain("download");
    expect(names).toContain("grep");
  });
});

describe("Commands.execute — theme", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem("term_theme");
  });

  it("theme list returns available themes", () => {
    const result = Commands.execute("theme", ["list"], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(allHtml).toContain("dracula");
    expect(allHtml).toContain("solarized");
    expect(allHtml).toContain("light");
    expect(allHtml).toContain("default");
  });

  it("theme with no args shows list", () => {
    const result = Commands.execute("theme", [], ["~"]);
    expect(result.lines).toBeTruthy();
  });

  it("theme dracula sets data-theme attribute", () => {
    Commands.execute("theme", ["dracula"], ["~"]);
    expect(document.documentElement.dataset.theme).toBe("dracula");
  });

  it("theme default removes data-theme attribute", () => {
    document.documentElement.dataset.theme = "dracula";
    Commands.execute("theme", ["default"], ["~"]);
    expect(document.documentElement.dataset.theme).toBeFalsy();
  });

  it("theme invalid name returns error", () => {
    const result = Commands.execute("theme", ["rainbow"], ["~"]);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain("unknown theme");
  });

  it("theme persists to localStorage", () => {
    Commands.execute("theme", ["solarized"], ["~"]);
    expect(localStorage.getItem("term_theme")).toBe("solarized");
  });
});

describe("Commands.execute — download", () => {
  it("download with no args shows usage", () => {
    const result = Commands.execute("download", [], ["~"]);
    expect(result.lines).toBeTruthy();
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(
      allHtml.includes("Usage") || allHtml.includes("usage") || allHtml.includes("Available"),
    ).toBe(true);
  });

  it("download resume returns success line with filename", () => {
    const result = Commands.execute("download", ["resume"], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(allHtml).toContain("resume.pdf");
  });

  it("download unknown target returns error", () => {
    const result = Commands.execute("download", ["unicorn"], ["~"]);
    expect(result.error).toBeTruthy();
  });

  it("download cv alias works", () => {
    const result = Commands.execute("download", ["cv"], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(allHtml).toContain("resume.pdf");
  });
});

describe("Commands.execute — grep", () => {
  it("grep without args returns error", () => {
    const result = Commands.execute("grep", [], ["~"]);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain("grep");
  });

  it("grep with term returns null (fully async)", () => {
    const result = Commands.execute("grep", ["typescript"], ["~"], mockCtx());
    expect(result).toBeNull();
  });

  it("grep calls ctx.appendLine with status", () => {
    let called = false;
    const ctx = {
      appendLine: () => {
        called = true;
      },
      appendHTML: () => {},
      scrollBottom: () => {},
    };
    Commands.execute("grep", ["hello"], ["~"], ctx);
    expect(called).toBe(true);
  });
});

describe("Commands.execute — message", () => {
  it("message no args shows usage", () => {
    const result = Commands.execute("message", [], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(
      allHtml.includes("Usage") || allHtml.includes("usage") || allHtml.includes("message"),
    ).toBe(true);
  });

  it("message no args shows last-name hint when stored", () => {
    localStorage.setItem("mp_last_name", "TestUser");
    const result = Commands.execute("message", [], ["~"]);
    const allHtml = result.lines.map((l) => l.html).join(" ");
    expect(allHtml).toContain("TestUser");
    localStorage.removeItem("mp_last_name");
  });
});

describe("Commands.execute — SEC-1 deep-link whitelist", () => {
  const WL = /^(cat|ls|cd|whoami|neofetch|theme|help|pwd|echo|fortune|cowsay|banner|weather)\b/i;

  it("whitelist matches safe commands", () => {
    expect(WL.test("cat about.md")).toBe(true);
    expect(WL.test("ls projects")).toBe(true);
    expect(WL.test("cd blog")).toBe(true);
    expect(WL.test("whoami")).toBe(true);
    expect(WL.test("neofetch")).toBe(true);
    expect(WL.test("theme dracula")).toBe(true);
    expect(WL.test("help")).toBe(true);
    expect(WL.test("pwd")).toBe(true);
    expect(WL.test("echo hello")).toBe(true);
    expect(WL.test("fortune")).toBe(true);
    expect(WL.test("cowsay moo")).toBe(true);
    expect(WL.test("weather Hanoi")).toBe(true);
  });

  it("whitelist blocks dangerous commands", () => {
    expect(WL.test("message --name evil")).toBe(false);
    expect(WL.test("open github")).toBe(false);
    expect(WL.test("reload")).toBe(false);
    expect(WL.test("quit")).toBe(false);
    expect(WL.test("init")).toBe(false);
    expect(WL.test("download resume")).toBe(false);
  });

  it("whitelist is case-insensitive", () => {
    expect(WL.test("CAT about.md")).toBe(true);
    expect(WL.test("LS")).toBe(true);
    expect(WL.test("Help")).toBe(true);
  });

  it("whitelist requires word boundary (no prefix spoofing)", () => {
    expect(WL.test("catfish")).toBe(false);
    expect(WL.test("helpdesk")).toBe(false);
    expect(WL.test("lsblk")).toBe(false);
  });
});
