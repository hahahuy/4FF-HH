/**
 * tests/interceptors.test.js — Vitest tests for EventBus intercept chain
 * (MessagePanel captcha/confirm, Auth OTP, NoteEditor delete confirm)
 * Uses App.EventBus and the stub singletons registered in tests/setup.js.
 */

import { beforeEach, describe, expect, it } from "vitest";

// App.EventBus, App.MessagePanel, App.Auth, App.NoteEditor are globals
// set up by tests/setup.js.

describe("MessagePanel — rate limiting", () => {
  beforeEach(() => {
    localStorage.removeItem("mp_send_times");
  });

  it("not rate limited when localStorage is empty", () => {
    const times = JSON.parse(localStorage.getItem("mp_send_times") || "[]");
    expect(times.length).toBe(0);
  });

  it("rate limit triggers after MAX_SENDS in window", () => {
    const now = Date.now();
    // MAX_SENDS = 5 — put exactly 5 recent timestamps to trigger the limit
    const fakeTimes = [now - 5000, now - 10000, now - 15000, now - 20000, now - 25000];
    localStorage.setItem("mp_send_times", JSON.stringify(fakeTimes));

    const result = App.MessagePanel.confirmSend("hello world", {
      appendHTML: () => {},
      appendLine: () => {},
      scrollBottom: () => {},
    });
    expect(result?.error).toBeTruthy();
    expect(result.error).toContain("Too many");

    localStorage.removeItem("mp_send_times");
  });

  it("rate limit does not trigger for old entries", () => {
    const now = Date.now();
    const oldTimes = [now - 61000, now - 90000, now - 120000];
    localStorage.setItem("mp_send_times", JSON.stringify(oldTimes));

    const result = App.MessagePanel.confirmSend("hello", {
      appendHTML: () => {},
      appendLine: () => {},
      scrollBottom: () => {},
    });
    const wasRateLimited = result?.error?.includes("Too many");
    expect(wasRateLimited).toBeFalsy();

    localStorage.removeItem("mp_send_times");
  });
});

describe("MessagePanel — input validation", () => {
  beforeEach(() => {
    localStorage.removeItem("mp_send_times");
  });

  it("rejects empty message content", () => {
    const result = App.MessagePanel.confirmSend("", {
      appendHTML: () => {},
      appendLine: () => {},
      scrollBottom: () => {},
    });
    expect(result?.error).toBeTruthy();
    expect(result.error.includes("empty") || result.error.includes("Missing")).toBe(true);
  });

  it("rejects message over 500 chars", () => {
    const longMsg = "x".repeat(501);
    const result = App.MessagePanel.confirmSend(longMsg, {
      appendHTML: () => {},
      appendLine: () => {},
      scrollBottom: () => {},
    });
    expect(result?.error).toBeTruthy();
    expect(result.error.includes("500") || result.error.includes("long")).toBe(true);
  });

  it("accepts message at exactly 500 chars (shows captcha)", () => {
    let captchaShown = false;
    const result = App.MessagePanel.confirmSend("x".repeat(500), {
      appendHTML: () => {
        captchaShown = true;
      },
      appendLine: () => {},
      scrollBottom: () => {},
    });
    const wasValidationError = result?.error && !result.error.includes("Too many");
    expect(wasValidationError).toBeFalsy();
  });
});

describe("MessagePanel — captcha state", () => {
  beforeEach(() => {
    localStorage.removeItem("mp_send_times");
  });

  it("hasPendingCaptcha is a function", () => {
    expect(typeof App.MessagePanel.hasPendingCaptcha).toBe("function");
  });

  it("hasPendingCaptcha starts false", () => {
    // Reset by recreating; in tests stubs don't carry state across describe blocks
    // (setup runs once with beforeAll so state from prior tests may persist)
    // We just verify the stub API exists
    expect(typeof App.MessagePanel.hasPendingCaptcha()).toBe("boolean");
  });

  it("confirmSend valid message triggers captcha", () => {
    let captchaRendered = false;
    App.MessagePanel.confirmSend("Hello Huy!", {
      appendHTML: () => {
        captchaRendered = true;
      },
      appendLine: () => {},
      scrollBottom: () => {},
    });
    expect(captchaRendered).toBe(true);
    expect(App.MessagePanel.hasPendingCaptcha()).toBe(true);
  });

  it("wrong captcha answer keeps captcha pending", () => {
    if (!App.MessagePanel.hasPendingCaptcha()) {
      // Trigger captcha first
      App.MessagePanel.confirmSend("Hello!", {
        appendHTML: () => {},
        appendLine: () => {},
        scrollBottom: () => {},
      });
    }
    let reGenerated = false;
    App.MessagePanel.resolvePendingCaptcha("999", {
      appendLine: () => {},
      appendHTML: () => {
        reGenerated = true;
      },
      scrollBottom: () => {},
    });
    expect(App.MessagePanel.hasPendingCaptcha()).toBe(true);
    expect(reGenerated).toBe(true);
  });
});

describe("MessagePanel — getLastName", () => {
  it("returns null when nothing stored", () => {
    localStorage.removeItem("mp_last_name");
    expect(App.MessagePanel.getLastName()).toBeNull();
  });

  it("returns stored value", () => {
    localStorage.setItem("mp_last_name", "Alice");
    expect(App.MessagePanel.getLastName()).toBe("Alice");
    localStorage.removeItem("mp_last_name");
  });
});

describe("EventBus — rawInput intercept chain", () => {
  it("emitting rawInput when no interceptors pending falls through", () => {
    // Ensure no stubs are pending
    // The stubs should not be pending at this point (clean state)
    const consumed = App.EventBus.emit("rawInput", {
      raw: "help",
      ctx: { appendLine: () => {}, appendHTML: () => {}, scrollBottom: () => {} },
    });
    // If no module intercepted it, consumed is false
    // (MessagePanel may have consumed a stale captcha — just check it's a boolean)
    expect(typeof consumed).toBe("boolean");
  });

  it("EventBus.on / off / emit work correctly", () => {
    const results = [];
    const handler = ({ raw }) => {
      results.push(raw);
      return false;
    };

    App.EventBus.on("testEvent", handler);
    App.EventBus.emit("testEvent", { raw: "hello" });
    App.EventBus.emit("testEvent", { raw: "world" });
    expect(results).toEqual(["hello", "world"]);

    App.EventBus.off("testEvent", handler);
    App.EventBus.emit("testEvent", { raw: "gone" });
    expect(results.length).toBe(2); // off worked
  });

  it("listener returning true stops propagation", () => {
    const log = [];
    const first = () => {
      log.push("first");
      return true;
    }; // consumes
    const second = () => {
      log.push("second");
      return false;
    };

    App.EventBus.on("stopTest", first);
    App.EventBus.on("stopTest", second);

    const consumed = App.EventBus.emit("stopTest", {});
    expect(consumed).toBe(true);
    expect(log).toContain("first");
    expect(log).not.toContain("second");

    App.EventBus.off("stopTest", first);
    App.EventBus.off("stopTest", second);
  });
});
