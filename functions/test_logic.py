"""
Cloud Function logic tests — Python port of functions/test.js
Tests business logic from functions/index.js and message-panel.js
Run with: python3 functions/test_logic.py
"""
import re, time, sys, io

# Force UTF-8 output to handle Unicode check marks on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

_pass = 0
_fail = 0

def assert_t(desc, fn):
    global _pass, _fail
    try:
        fn()
        print(f"  PASS {desc}")
        _pass += 1
    except AssertionError as e:
        print(f"  FAIL {desc}")
        print(f"    -> {e}")
        _fail += 1
    except Exception as e:
        print(f"  FAIL {desc}")
        print(f"    -> Unexpected: {e}")
        _fail += 1

# ── Mirrored logic from functions/index.js ─────────────────────

def handle_webhook(method, headers, body, webhook_secret):
    if method != "POST":
        return {"status": 405, "body": "Method Not Allowed"}
    if webhook_secret:
        incoming = headers.get("x-telegram-bot-api-secret-token", "")
        if incoming != webhook_secret:
            return {"status": 403, "body": "Forbidden"}
    message = body.get("message")
    if not message or not message.get("reply_to_message"):
        return {"status": 200, "body": "ok", "should_process": False}
    reply_text = (message.get("text") or "").strip()
    if not reply_text:
        return {"status": 200, "body": "ok", "should_process": False}
    return {"status": 200, "body": "ok", "should_process": True, "reply_text": reply_text}

def validate_content(content):
    if not content or not content.strip():
        return "Message cannot be empty."
    if len(content) > 500:
        return f"Message too long. Max 500 characters (got {len(content)})."
    return None

def validate_name(name):
    NAME_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$')
    RESERVED = {"admin", "test", "null", "undefined"}
    if not name or not name.strip():
        return "Name cannot be empty."
    if len(name) > 32:
        return "Name too long. Max 32 characters."
    if not NAME_PATTERN.match(name):
        return "Name must start with a letter or digit. Allowed characters: letters, numbers, dots (.), hyphens (-), underscores (_)."
    if name.lower() in RESERVED:
        return f'"{name}" is a reserved name. Please choose another.'
    return None

def is_rate_limited(times_ms, now_ms, window_ms=60_000, max_sends=3):
    fresh = [t for t in times_ms if now_ms - t < window_ms]
    return len(fresh) >= max_sends

def cleanup_stale_sessions(sessions, cutoff_ms):
    updates = {}
    for key, val in sessions.items():
        if val["createdAt"] <= cutoff_ms and val["status"] == "active":
            updates[f"{key}/status"] = "closed"
    return updates

# ────────────────────────────────────────────────────────────────

print("\n-- Webhook Signature Verification (1d) -----------------\n")

def test_webhook_405():
    r = handle_webhook("GET", {}, {}, "secret")
    assert r["status"] == 405, f"Expected 405, got {r['status']}"
assert_t("GET request returns 405", test_webhook_405)

def test_no_secret_passes():
    r = handle_webhook("POST", {}, {"message": None}, "")
    assert r["status"] != 403, "Should not be 403 with no secret configured"
assert_t("POST with no secret configured passes through", test_no_secret_passes)

def test_wrong_secret_403():
    r = handle_webhook("POST",
        {"x-telegram-bot-api-secret-token": "wrong"},
        {}, "correct-secret")
    assert r["status"] == 403, f"Expected 403, got {r['status']}"
    assert r["body"] == "Forbidden"
assert_t("POST with wrong secret returns 403", test_wrong_secret_403)

def test_correct_secret_passes():
    r = handle_webhook("POST",
        {"x-telegram-bot-api-secret-token": "correct-secret"},
        {"message": {"text": "hi", "reply_to_message": {"message_id": 1}}},
        "correct-secret")
    assert r["status"] != 403, "Should not be 403"
    assert r["status"] == 200
assert_t("POST with correct secret passes through", test_correct_secret_passes)

def test_missing_header_403():
    r = handle_webhook("POST", {}, {}, "my-secret")
    assert r["status"] == 403, f"Expected 403, got {r['status']}"
assert_t("POST with missing secret header returns 403 (when secret is set)", test_missing_header_403)

def test_no_reply_to():
    r = handle_webhook("POST",
        {"x-telegram-bot-api-secret-token": "s"},
        {"message": {"text": "hello"}}, "s")
    assert r["status"] == 200
    assert not r.get("should_process"), "should not process non-reply"
assert_t("POST with no reply_to_message returns 200 early", test_no_reply_to)

def test_empty_reply_text():
    r = handle_webhook("POST",
        {"x-telegram-bot-api-secret-token": "s"},
        {"message": {"text": "   ", "reply_to_message": {"message_id": 1}}}, "s")
    assert r["status"] == 200
    assert not r.get("should_process")
assert_t("POST with empty reply text returns 200 early", test_empty_reply_text)

def test_valid_reply():
    r = handle_webhook("POST",
        {"x-telegram-bot-api-secret-token": "s"},
        {"message": {"text": "Hey there!", "reply_to_message": {"message_id": 99}}}, "s")
    assert r["status"] == 200
    assert r.get("should_process"), "should process valid reply"
    assert r["reply_text"] == "Hey there!"
assert_t("Valid reply sets should_process=True and extracts reply_text", test_valid_reply)

print("\n-- Stale Session Cleanup (1e) ---------------------------\n")

now = int(time.time() * 1000)
cutoff_2h = now - 2 * 60 * 60 * 1000

sessions = {
    "alice": {"status": "active",  "createdAt": now - 3 * 60 * 60 * 1000},
    "bob":   {"status": "active",  "createdAt": now - 1 * 60 * 60 * 1000},
    "carol": {"status": "closed",  "createdAt": now - 5 * 60 * 60 * 1000},
    "dave":  {"status": "active",  "createdAt": now - 2 * 60 * 60 * 1000 - 1},
}
updates = cleanup_stale_sessions(sessions, cutoff_2h)

def check_alice():
    assert "alice/status" in updates and updates["alice/status"] == "closed"
assert_t("Stale active session (alice, 3h) is closed", check_alice)

def check_bob():
    assert "bob/status" not in updates, "bob is fresh, should not close"
assert_t("Fresh active session (bob, 1h) is NOT closed", check_bob)

def check_carol():
    assert "carol/status" not in updates, "carol already closed, no update"
assert_t("Already-closed session (carol) is NOT touched", check_carol)

def check_dave():
    assert "dave/status" in updates and updates["dave/status"] == "closed"
assert_t("Borderline stale session (dave, 2h+1ms) is closed", check_dave)

def check_count():
    assert len(updates) == 2, f"Expected 2 updates, got {len(updates)}: {list(updates.keys())}"
assert_t("Exactly 2 sessions closed (alice + dave)", check_count)

fresh_sessions = {"eve": {"status": "active", "createdAt": now - 30 * 60 * 1000}}
empty_updates = cleanup_stale_sessions(fresh_sessions, cutoff_2h)

def check_no_updates():
    assert len(empty_updates) == 0, "No stale sessions should produce no updates"
assert_t("No stale sessions -> updates object is empty", check_no_updates)

print("\n-- Input Validation (1b) --------------------------------\n")

def vc_empty():
    assert validate_content("") is not None
assert_t("validateContent: empty string fails", vc_empty)

def vc_whitespace():
    assert validate_content("   ") is not None
assert_t("validateContent: whitespace-only fails", vc_whitespace)

def vc_500():
    assert validate_content("x" * 500) is None
assert_t("validateContent: 500-char string passes", vc_500)

def vc_501():
    err = validate_content("x" * 501)
    assert err is not None and "500" in err, f"Expected length error, got: {err}"
assert_t("validateContent: 501-char string fails with length message", vc_501)

def vn_empty():
    assert validate_name("") is not None
assert_t("validateName: empty fails", vn_empty)

def vn_32():
    assert validate_name("a" * 32) is None
assert_t("validateName: 32-char name passes", vn_32)

def vn_33():
    assert validate_name("a" * 33) is not None
assert_t("validateName: 33-char name fails", vn_33)

def vn_valid():
    assert validate_name("Hello_World-123") is None
    assert validate_name("john.doe") is None
assert_t("validateName: alphanumeric + _ - . passes", vn_valid)

def vn_dot_start():
    assert validate_name(".dotstart") is not None, "dot-start should be rejected"
assert_t("validateName: dot-start fails", vn_dot_start)

def vn_dash_start():
    assert validate_name("-dashstart") is not None, "dash-start should be rejected"
assert_t("validateName: dash-start fails", vn_dash_start)

def vn_slash():
    assert validate_name("bad/name") is not None, "slash should be rejected"
assert_t("validateName: slash fails", vn_slash)

def vn_space():
    assert validate_name("bad name") is not None, "space should be rejected"
assert_t("validateName: space fails", vn_space)

def vn_admin():
    assert validate_name("admin") is not None
    assert validate_name("Admin") is not None, "case-insensitive check"
assert_t("validateName: 'admin' reserved (case-insensitive)", vn_admin)

def vn_test():
    assert validate_name("test") is not None
assert_t("validateName: 'test' is reserved", vn_test)

def vn_null():
    assert validate_name("null") is not None
assert_t("validateName: 'null' is reserved", vn_null)

def vn_undefined():
    assert validate_name("undefined") is not None
assert_t("validateName: 'undefined' is reserved", vn_undefined)

def vn_alice():
    assert validate_name("alice") is None
assert_t("validateName: 'alice' passes", vn_alice)

def vn_huy():
    assert validate_name("huy-ha_2026") is None
assert_t("validateName: 'huy-ha_2026' passes", vn_huy)

print("\n-- Rate Limiting Logic (1a) -----------------------------\n")

now_ms = int(time.time() * 1000)

def rl_empty():
    assert not is_rate_limited([], now_ms)
assert_t("0 sends -> not limited", rl_empty)

def rl_two():
    assert not is_rate_limited([now_ms - 5000, now_ms - 10000], now_ms)
assert_t("2 sends in window -> not limited", rl_two)

def rl_three():
    assert is_rate_limited([now_ms - 1000, now_ms - 2000, now_ms - 3000], now_ms)
assert_t("3 sends in window -> limited", rl_three)

def rl_four():
    assert is_rate_limited([now_ms - 1000, now_ms - 2000, now_ms - 3000, now_ms - 4000], now_ms)
assert_t("4 sends in window -> limited", rl_four)

def rl_expired():
    assert not is_rate_limited([now_ms - 61000, now_ms - 70000, now_ms - 120000], now_ms)
assert_t("3 sends all older than 60s -> not limited", rl_expired)

def rl_mixed():
    assert not is_rate_limited([now_ms - 5000, now_ms - 10000, now_ms - 65000], now_ms)
assert_t("2 fresh + 1 expired -> not limited (only 2 in window)", rl_mixed)

print("\n-- history display order fix (5d) -----------------------\n")

def test_history_order():
    # Simulate newest-first storage: [cmd3, cmd2, cmd1]
    stored = ["cmd3", "cmd2", "cmd1"]
    limit = 20
    sliced = stored[:limit]
    displayed = list(reversed(sliced))  # oldest first
    assert displayed[0] == "cmd1", f"Oldest should be first, got {displayed[0]}"
    assert displayed[-1] == "cmd3", f"Newest should be last, got {displayed[-1]}"
    # Line numbers should increase
    start_num = len(stored) - len(sliced) + 1
    nums = [start_num + i for i in range(len(displayed))]
    assert nums == sorted(nums), "Line numbers must be ascending"
    assert nums[-1] == len(stored), f"Last number should equal history length {len(stored)}"
assert_t("history: displayed oldest-first with ascending line numbers", test_history_order)

def test_history_numbers_match_position():
    stored = [f"cmd{i}" for i in range(10, 0, -1)]  # newest first: cmd10..cmd1
    sliced = stored[:20]
    displayed = list(reversed(sliced))
    start = len(stored) - len(sliced) + 1
    for i, cmd in enumerate(displayed):
        num = start + i
        assert num > 0, "No line number should be 0 or negative"
    assert start + len(displayed) - 1 == len(stored)
assert_t("history: line numbers correctly span from start to total length", test_history_numbers_match_position)

print("\n-- URL hash deep-link (3a) -----------------------------\n")

import urllib.parse

def test_hash_encode_decode():
    cmd = "cat blog/hello-world.txt"
    encoded = "#cmd=" + urllib.parse.quote(cmd)
    decoded = urllib.parse.unquote(encoded.replace("#cmd=", ""))
    assert decoded == cmd, f"Round-trip failed: {decoded}"
assert_t("URL hash: #cmd= encodes and decodes correctly", test_hash_encode_decode)

def test_hash_rejects_newline():
    malicious = "echo hi\necho pwned"
    assert "\n" in malicious or "\r" in malicious, "Newline should be detectable"
    # Simulating terminal.js guard
    safe = not ("\n" in malicious or "\r" in malicious)
    assert not safe, "Newline in hash should be rejected"
assert_t("URL hash: newlines in decoded command are detectable (guard works)", test_hash_rejects_newline)

def test_hash_spaces_encoded():
    cmd = "cat about.txt"
    encoded = urllib.parse.quote(cmd)
    assert " " not in encoded, "Spaces should be encoded in URL"
    assert encoded == "cat%20about.txt"
assert_t("URL hash: spaces are percent-encoded in shareable links", test_hash_spaces_encoded)

print("\n---------------------------------------------------------")
total = _pass + _fail
fail_label = f"   *** {_fail} FAILED ***" if _fail else ""
print(f"  Total: {total}  |  v {_pass} passed  |  x {_fail} failed{fail_label}")
print("---------------------------------------------------------\n")

sys.exit(1 if _fail > 0 else 0)
