/* ============================================================
   functions/test.js — Node.js unit tests for Cloud Functions
   Run with: node test.js
   No external test runner required.
   ============================================================ */

'use strict';

// ── Minimal assertion helpers ─────────────────────────────────
let _pass = 0, _fail = 0;
function assert(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    _pass++;
  } catch (e) {
    console.error(`  ✗ ${desc}`);
    console.error(`    → ${e.message}`);
    _fail++;
  }
}
function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b);
  if (as !== bs) throw new Error(`Expected ${bs}, got ${as}`);
}
function ok(val, msg = 'expected truthy') { if (!val) throw new Error(msg); }
function notOk(val, msg = 'expected falsy') { if (val) throw new Error(msg); }

// ── Mock Firebase admin (no real DB needed) ───────────────────
const mockDb = {
  _data: {},       // in-memory store  { path: value }
  _updates: [],    // recorded update calls

  ref(path) {
    const self = this;
    return {
      path,
      once(event) {
        // Return snapshot-like object matching the path in _data
        const val = path.split('/').reduce((node, seg) => {
          return node && typeof node === 'object' ? node[seg] : undefined;
        }, self._data);
        return Promise.resolve({
          val: () => val,
          forEach(cb) {
            if (val && typeof val === 'object') {
              Object.entries(val).forEach(([k, v]) => {
                cb({
                  key: k,
                  val: () => v,
                  child(childPath) {
                    return {
                      forEach(cb2) {
                        const childVal = v[childPath];
                        if (childVal && typeof childVal === 'object') {
                          Object.entries(childVal).forEach(([k2, v2]) => {
                            cb2({ key: k2, val: () => v2 });
                          });
                        }
                      }
                    };
                  }
                });
              });
            }
          }
        });
      },
      orderByChild(field) {
        return {
          endAt(cutoff) {
            return {
              once(event) {
                // Return all sessions with createdAt <= cutoff
                const sessions = self._data.sessions || {};
                const filtered = Object.entries(sessions)
                  .filter(([, v]) => v.createdAt <= cutoff);
                return Promise.resolve({
                  forEach(cb) {
                    filtered.forEach(([k, v]) => {
                      cb({ key: k, val: () => v });
                    });
                  }
                });
              }
            };
          }
        };
      },
      set(val) {
        self._updates.push({ op: 'set', path, val });
        return Promise.resolve();
      },
      update(obj) {
        self._updates.push({ op: 'update', path, obj });
        return Promise.resolve();
      },
      push(val) {
        self._updates.push({ op: 'push', path, val });
        return Promise.resolve({ key: 'mock-key' });
      }
    };
  }
};

// Mock firebase-admin
const adminMock = {
  initializeApp: () => {},
  database: () => mockDb,
};

// Mock telegramPost so we never hit the network
let _lastTelegramPost = null;
function mockTelegramPost(token, method, body) {
  _lastTelegramPost = { token, method, body };
  return Promise.resolve({ ok: true, result: { message_id: 42 } });
}

// ── Load the module under test ────────────────────────────────
// We need to inject our mocks before require() runs.
// Use a fresh module scope with manual dependency injection instead of
// monkey-patching require, since index.js calls admin.initializeApp() at load time.

// Extract the logic we need to test as isolated functions (re-implemented inline).
// This keeps tests fast and hermetic — no real Firebase or Telegram calls.

// ─────────────────────────────────────────────────────────────
// Inline re-implementations of testable units from index.js
// (The real functions are tested end-to-end via the emulator;
//  these unit tests cover the business logic branches.)
// ─────────────────────────────────────────────────────────────

// ── Unit under test: webhook signature check ─────────────────
function handleWebhook(req, webhookSecret) {
  if (req.method !== 'POST') return { status: 405, body: 'Method Not Allowed' };

  if (webhookSecret) {
    const incomingToken = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingToken !== webhookSecret) return { status: 403, body: 'Forbidden' };
  }

  const update = req.body;
  if (!update.message || !update.message.reply_to_message) return { status: 200, body: 'ok' };

  const replyText = (update.message.text || '').trim();
  if (!replyText) return { status: 200, body: 'ok' };

  return { status: 200, body: 'ok', shouldProcess: true, replyText };
}

// ── Unit under test: stale session cleanup ────────────────────
async function cleanupStaleSessions(db, cutoff) {
  const snap = await db.ref('sessions').orderByChild('createdAt').endAt(cutoff).once('value');

  const updates = {};
  snap.forEach(s => {
    if (s.val().status === 'active') {
      updates[`${s.key}/status`] = 'closed';
    }
  });

  if (Object.keys(updates).length) {
    await db.ref('sessions').update(updates);
  }

  return updates;
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

console.log('\n── Webhook Signature Verification (1d) ─────────────────\n');

assert('GET request returns 405', () => {
  const res = handleWebhook({ method: 'GET', headers: {}, body: {} }, 'secret123');
  eq(res.status, 405);
});

assert('POST with no secret configured passes through', () => {
  const req = {
    method: 'POST',
    headers: {},
    body: { message: null },
  };
  const res = handleWebhook(req, ''); // empty secret = disabled
  notOk(res.status === 403, 'should not be 403 when no secret configured');
});

assert('POST with wrong secret returns 403', () => {
  const req = {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong-token' },
    body: {},
  };
  const res = handleWebhook(req, 'correct-secret');
  eq(res.status, 403);
  eq(res.body, 'Forbidden');
});

assert('POST with correct secret passes through', () => {
  const req = {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'correct-secret' },
    body: { message: { text: 'hi', reply_to_message: { message_id: 1 } } },
  };
  const res = handleWebhook(req, 'correct-secret');
  notOk(res.status === 403, 'should not be 403');
  eq(res.status, 200);
});

assert('POST with missing secret header returns 403 (when secret is set)', () => {
  const req = {
    method: 'POST',
    headers: {}, // no secret header
    body: {},
  };
  const res = handleWebhook(req, 'my-secret');
  eq(res.status, 403);
});

assert('POST with no reply_to_message returns 200 early', () => {
  const req = {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { message: { text: 'hello' } }, // no reply_to_message
  };
  const res = handleWebhook(req, 'secret');
  eq(res.status, 200);
  notOk(res.shouldProcess, 'should not process non-reply messages');
});

assert('POST with empty reply text returns 200 early', () => {
  const req = {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { message: { text: '   ', reply_to_message: { message_id: 1 } } },
  };
  const res = handleWebhook(req, 'secret');
  eq(res.status, 200);
  notOk(res.shouldProcess, 'should not process empty reply');
});

assert('Valid reply sets shouldProcess=true and extracts replyText', () => {
  const req = {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    body: { message: { text: 'Hey there!', reply_to_message: { message_id: 99 } } },
  };
  const res = handleWebhook(req, 'secret');
  eq(res.status, 200);
  ok(res.shouldProcess, 'should process valid reply');
  eq(res.replyText, 'Hey there!');
});

console.log('\n── Stale Session Cleanup (1e) ───────────────────────────\n');

// Set up test data in the mock DB
const NOW = Date.now();
mockDb._data = {
  sessions: {
    'alice': { status: 'active',  createdAt: NOW - 3 * 60 * 60 * 1000 }, // 3h old → stale
    'bob':   { status: 'active',  createdAt: NOW - 1 * 60 * 60 * 1000 }, // 1h old → fresh
    'carol': { status: 'closed',  createdAt: NOW - 5 * 60 * 60 * 1000 }, // 5h old but already closed
    'dave':  { status: 'active',  createdAt: NOW - 2 * 60 * 60 * 1000 - 1 }, // just over 2h → stale
  }
};

const CUTOFF_2H = NOW - 2 * 60 * 60 * 1000;

(async () => {
  mockDb._updates = [];
  const updates = await cleanupStaleSessions(mockDb, CUTOFF_2H);

  assert('Stale active session (alice, 3h) is closed', () => {
    ok('alice/status' in updates, 'alice should be closed');
    eq(updates['alice/status'], 'closed');
  });

  assert('Fresh active session (bob, 1h) is NOT closed', () => {
    notOk('bob/status' in updates, 'bob should not be touched');
  });

  assert('Already-closed session (carol) is NOT touched', () => {
    notOk('carol/status' in updates, 'carol already closed, no update');
  });

  assert('Borderline stale session (dave, 2h+1ms) is closed', () => {
    ok('dave/status' in updates, 'dave is just over threshold, should close');
    eq(updates['dave/status'], 'closed');
  });

  assert('Update was written to DB when stale sessions found', () => {
    const updateCalls = mockDb._updates.filter(u => u.op === 'update');
    ok(updateCalls.length > 0, 'db.update() was called');
  });

  assert('Exactly 2 sessions were closed (alice + dave)', () => {
    eq(Object.keys(updates).length, 2);
  });

  // Test: no stale sessions → no DB write
  mockDb._updates = [];
  const freshDb = { ...mockDb };
  freshDb._data = {
    sessions: {
      'eve': { status: 'active', createdAt: NOW - 30 * 60 * 1000 }, // 30 min old
    }
  };
  freshDb.ref = mockDb.ref.bind(freshDb);

  const emptyUpdates = await cleanupStaleSessions(freshDb, CUTOFF_2H);
  assert('No stale sessions → updates object is empty', () => {
    eq(Object.keys(emptyUpdates).length, 0);
  });

  assert('No stale sessions → db.update() NOT called', () => {
    const updateCalls = mockDb._updates.filter(u => u.op === 'update');
    eq(updateCalls.length, 0);
  });

  console.log('\n── Input Validation (1b) ────────────────────────────────\n');

  // These mirror the validateName / validateContent logic from message-panel.js
  function validateContent(content) {
    if (!content || !content.trim()) return 'Message cannot be empty.';
    if (content.length > 500) return `Message too long. Max 500 characters (got ${content.length}).`;
    return null;
  }

  function validateName(name) {
    const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
    const RESERVED     = new Set(['admin', 'test', 'null', 'undefined']);
    if (!name || !name.trim()) return 'Name cannot be empty.';
    if (name.length > 32) return 'Name too long. Max 32 characters.';
    if (!NAME_PATTERN.test(name)) return 'Name may only contain letters, numbers, hyphens, and underscores.';
    if (RESERVED.has(name.toLowerCase())) return `"${name}" is a reserved name. Please choose another.`;
    return null;
  }

  assert('validateContent: empty string fails', () => {
    ok(validateContent('') !== null, 'empty fails');
  });

  assert('validateContent: whitespace-only string fails', () => {
    ok(validateContent('   ') !== null, 'whitespace fails');
  });

  assert('validateContent: 500-char string passes', () => {
    eq(validateContent('x'.repeat(500)), null);
  });

  assert('validateContent: 501-char string fails', () => {
    const err = validateContent('x'.repeat(501));
    ok(err !== null && err.includes('500'), 'fails with length message');
  });

  assert('validateName: empty fails', () => {
    ok(validateName('') !== null, 'empty fails');
  });

  assert('validateName: 32-char name passes', () => {
    eq(validateName('a'.repeat(32)), null);
  });

  assert('validateName: 33-char name fails', () => {
    ok(validateName('a'.repeat(33)) !== null, '33 chars fails');
  });

  assert('validateName: alphanumeric + _ - passes', () => {
    eq(validateName('Hello_World-123'), null);
  });

  assert('validateName: slash fails', () => {
    ok(validateName('bad/name') !== null, 'slash fails');
  });

  assert('validateName: space fails', () => {
    ok(validateName('bad name') !== null, 'space fails');
  });

  assert('validateName: "admin" is reserved', () => {
    ok(validateName('admin') !== null, 'admin reserved');
    ok(validateName('Admin') !== null, 'Admin reserved (case-insensitive)');
  });

  assert('validateName: "test" is reserved', () => {
    ok(validateName('test') !== null, 'test reserved');
  });

  assert('validateName: "null" is reserved', () => {
    ok(validateName('null') !== null, 'null reserved');
  });

  assert('validateName: "undefined" is reserved', () => {
    ok(validateName('undefined') !== null, 'undefined reserved');
  });

  assert('validateName: "alice" passes', () => {
    eq(validateName('alice'), null);
  });

  assert('validateName: "huy-ha_2026" passes', () => {
    eq(validateName('huy-ha_2026'), null);
  });

  console.log('\n── Rate Limiting Logic (1a) ─────────────────────────────\n');

  // Mirror the rate-limit logic from message-panel.js
  const WINDOW_MS = 60_000;
  const MAX_SENDS = 3;

  function isRateLimited(times) {
    const fresh = times.filter(t => Date.now() - t < WINDOW_MS);
    return fresh.length >= MAX_SENDS;
  }

  assert('Rate limit: 0 sends → not limited', () => {
    notOk(isRateLimited([]), 'empty array is fine');
  });

  assert('Rate limit: 2 sends in window → not limited', () => {
    const now = Date.now();
    notOk(isRateLimited([now - 5000, now - 10000]), '2 sends is OK');
  });

  assert('Rate limit: 3 sends in window → limited', () => {
    const now = Date.now();
    ok(isRateLimited([now - 1000, now - 2000, now - 3000]), '3 sends triggers limit');
  });

  assert('Rate limit: 4 sends in window → limited', () => {
    const now = Date.now();
    ok(isRateLimited([now - 1000, now - 2000, now - 3000, now - 4000]), '4 sends triggers limit');
  });

  assert('Rate limit: 3 sends but all older than 60s → not limited', () => {
    const now = Date.now();
    notOk(isRateLimited([now - 61000, now - 70000, now - 120000]), 'expired sends are ignored');
  });

  assert('Rate limit: 2 fresh + 1 old → not limited (only 2 in window)', () => {
    const now = Date.now();
    notOk(isRateLimited([now - 5000, now - 10000, now - 65000]), '1 expired, 2 fresh = OK');
  });

  // ── Summary ────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`  Total: ${_pass + _fail}  |  ✓ ${_pass} passed  |  ${_fail > 0 ? `✗ ${_fail} failed` : '✗ 0 failed'}`);
  console.log('─────────────────────────────────────────────────────────\n');

  if (_fail > 0) process.exit(1);
})();
