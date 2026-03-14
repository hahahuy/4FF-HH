/* ============================================================
   functions/index.js — Firebase Cloud Functions
   Telegram relay for the `message` terminal command
   ============================================================ */

'use strict';

const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const https     = require('https');
const crypto    = require('crypto');   // built-in Node module — no new deps

admin.initializeApp({
  databaseURL: 'https://hahuy-portfolio-f7f16-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

// ── Crypto helpers ──────────────────────────────────────────
function sha256hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still run a dummy comparison to avoid timing leaks on length
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── CORS helper (browser → Cloud Function calls) ───────────
function setCors(res, req) {
  const allowed = ['https://hahuy.site', 'http://localhost', 'http://127.0.0.1'];
  const origin  = (req.headers.origin || '').trim();
  if (allowed.some(o => origin.startsWith(o))) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Session token validator (shared by all notes functions) ─
async function validateSessionToken(token) {
  if (!token || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    return { valid: false, reason: 'malformed' };
  }
  const snap = await db.ref(`owner_sessions/${token}`).once('value');
  const data  = snap.val();
  if (!data) return { valid: false, reason: 'not found' };
  if (data.expires < Date.now()) {
    await snap.ref.remove();
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}

// ── Filename validator ──────────────────────────────────────
const FILENAME_RE = /^[a-zA-Z0-9_-]+\.md$/;
function isValidFilename(name) {
  return typeof name === 'string' && FILENAME_RE.test(name) && name.length <= 64;
}

// ── GitHub API helpers ───────────────────────────────────────
// Centralise GitHub header construction — used by pushToGitHub,
// fileUpload, and updateImagesManifest.
function makeGitHubHeaders(pat) {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json',
  };
}

// ── GitHub auto-sync helper ──────────────────────────────────
// Notes are stored on GitHub at content/notes/<filename> (encoded).
// Double base64: inner pass = obfuscation stored on GitHub,
//                outer pass = GitHub API transport requirement.
// pathOverride: if set, use this GitHub path instead of 'content/notes/<filename>'
// obfuscate: false for site files (plain Markdown on GitHub), true for notes (double-base64)
// Errors are logged but never propagate to the caller —
// RTDB is the source of truth; GitHub is a mirror.
async function pushToGitHub(filename, content, action, pathOverride = null, obfuscate = true) {
  const pat   = process.env.GITHUB_PAT;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  if (!pat || !owner || !repo) return; // not configured — skip silently

  const filepath = pathOverride || `content/notes/${filename}`;
  const apiUrl   = `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`;
  const headers  = makeGitHubHeaders(pat);

  try {
    if (action === 'delete') {
      const getRes = await fetch(apiUrl, { headers });
      if (!getRes.ok) return; // file doesn't exist on GitHub — nothing to delete
      const existing = await getRes.json();
      await fetch(apiUrl, {
        method:  'DELETE',
        headers,
        body: JSON.stringify({
          message: pathOverride ? `content: delete ${filename}` : `notes: delete ${filename}`,
          sha:     existing.sha,
        }),
      });
      return;
    }

    // create or update
    // obfuscate=true  → double base64 (notes)
    // obfuscate=false → single base64 (site files — plain Markdown on GitHub)
    const encoded = obfuscate
      ? Buffer.from(Buffer.from(content, 'utf8').toString('base64'), 'utf8').toString('base64')
      : Buffer.from(content, 'utf8').toString('base64');

    // GET sha if file already exists on GitHub
    let sha = null;
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) { sha = (await getRes.json()).sha || null; }

    const message = pathOverride ? `content: update ${filename}` : `notes: ${action} ${filename}`;

    await fetch(apiUrl, {
      method:  'PUT',
      headers,
      body: JSON.stringify({
        message,
        content: encoded,
        ...(sha ? { sha } : {}),
      }),
    });
  } catch (e) {
    console.error(`pushToGitHub: ${action} ${filename} failed — ${e.message}`);
  }
}

// ── Site file whitelist (path traversal prevention) ─────────
// Client sends only a fileKey; server resolves to the actual GitHub path.
const SITE_FILE_WHITELIST = {
  'about':         'content/about.md',
  'contact':       'content/contact.md',
  'projects':      'content/projects/README.md',
  'skills':        'content/skills.md',
  'shorter-about': 'content/shorter-about.md',
};

function resolveSiteFilePath(fileKey) {
  if (SITE_FILE_WHITELIST[fileKey]) return SITE_FILE_WHITELIST[fileKey];
  const m = fileKey.match(/^blog\/([a-zA-Z0-9_-]+\.md)$/);
  if (m) return `content/blog/${m[1]}`;
  return null;
}

// ── Rate limiter helper ──────────────────────────────────────
// Returns true if rate limit exceeded, false if OK.
async function isRateLimited(namespace, ip, maxCount, windowMs) {
  const ipHash = sha256hex(ip).slice(0, 16);
  const rlRef  = db.ref(`rate_limits/${namespace}/${ipHash}`);
  const rlSnap = await rlRef.once('value');
  const rlData = rlSnap.val() || { count: 0, window_start: 0 };
  const now    = Date.now();

  if (now - rlData.window_start < windowMs) {
    if (rlData.count >= maxCount) return true;
    await rlRef.update({ count: rlData.count + 1 });
  } else {
    await rlRef.set({ count: 1, window_start: now });
  }
  return false;
}

// ── RTDB key encoder ────────────────────────────────────────
// Firebase RTDB keys cannot contain "." so "test.md" → "test_dot_md"
function toRtdbKey(filename) {
  return filename.replace(/\./g, '_dot_');
}
function fromRtdbKey(key) {
  return key.replace(/_dot_/g, '.');
}

// ── Helper: POST a JSON payload to the Telegram Bot API ────
//    (unchanged — used by existing message functions)
function telegramPost(token, method, body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path:     `/bot${token}/${method}`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Region matching the Realtime Database location ─────────
const REGION = 'asia-southeast1';

// ══════════════════════════════════════════════════════════
// 1.  onNewSingleMessage
//     Triggered when a visitor sends a one-shot message.
//     Forwards it to the owner's Telegram chat.
// ══════════════════════════════════════════════════════════
exports.onNewSingleMessage = functions
  .region(REGION)
  .database.ref('/single_messages/{id}')
  .onCreate(async (snapshot) => {
    const msg = snapshot.val();
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    await telegramPost(token, 'sendMessage', {
      chat_id: chatId,
      text:    `📩 New message:\n${msg.content}`,
    });

    return null;
  });

// ══════════════════════════════════════════════════════════
// 2.  onNewSessionMessage
//     Triggered when a visitor sends a message in a live
//     chat session.  Forwards it to Telegram and stores the
//     returned message_id so the webhook can match replies.
// ══════════════════════════════════════════════════════════
exports.onNewSessionMessage = functions
  .region(REGION)
  .database.ref('/sessions/{name}/messages/{id}')
  .onCreate(async (snapshot, context) => {
    const msg = snapshot.val();

    // Only forward visitor messages — ignore owner replies
    // (they arrive via the webhook, not the DB trigger)
    if (msg.sender !== 'visitor') return null;

    const { name } = context.params;
    const token     = process.env.TELEGRAM_TOKEN;
    const chatId    = process.env.TELEGRAM_CHAT_ID;

    const result = await telegramPost(token, 'sendMessage', {
      chat_id: chatId,
      text:    `💬 [${name}] ${msg.content}`,
    });

    // Store Telegram message_id so the webhook can thread replies
    if (result.ok && result.result && result.result.message_id) {
      await snapshot.ref.update({
        telegramMsgId: result.result.message_id,
      });
    }

    return null;
  });

// ══════════════════════════════════════════════════════════
// 3.  telegramWebhook
//     HTTP endpoint Telegram calls when the owner replies
//     to a forwarded message in Telegram.
//     Finds the matching session via telegramMsgId and
//     pushes the owner reply into Firebase so the live
//     chat panel receives it in real-time.
//
//     Security: verifies the X-Telegram-Bot-Api-Secret-Token
//     header set during webhook registration (1d).
// ══════════════════════════════════════════════════════════
exports.telegramWebhook = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // ── Webhook signature verification (1d) ────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingToken = req.headers['x-telegram-bot-api-secret-token'];
      if (incomingToken !== webhookSecret) {
        return res.status(403).send('Forbidden');
      }
    }

    const update = req.body;

    // Only handle replies to forwarded messages
    if (!update.message || !update.message.reply_to_message) {
      return res.status(200).send('ok');
    }

    const replyToMsgId = update.message.reply_to_message.message_id;
    const replyText    = (update.message.text || '').trim();

    if (!replyText) return res.status(200).send('ok');

    // ── Find the session that owns this telegramMsgId ───────
    const sessionsSnap = await db.ref('sessions').once('value');
    let targetSession  = null;

    sessionsSnap.forEach(sessionSnap => {
      if (targetSession) return;
      sessionSnap.child('messages').forEach(msgSnap => {
        if (msgSnap.val().telegramMsgId === replyToMsgId) {
          targetSession = sessionSnap.key;
        }
      });
    });

    if (!targetSession) {
      // Reply was to a single_message — nothing to push back
      return res.status(200).send('ok');
    }

    // ── Push owner reply into the session ──────────────────
    await db.ref(`sessions/${targetSession}/messages`).push({
      content:   replyText,
      sender:    'owner',
      timestamp: Date.now(),
    });

    return res.status(200).send('ok');
  });

// ══════════════════════════════════════════════════════════
// 4.  cleanupStaleSessions
//     Scheduled function that runs every hour and closes
//     any session older than 2 hours that is still active.
//     Belt-and-suspenders for the frontend beforeunload (1e).
// ══════════════════════════════════════════════════════════
exports.cleanupStaleSessions = functions
  .region(REGION)
  .pubsub.schedule('every 60 minutes')
  .onRun(async () => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

    const snap = await db.ref('sessions')
      .orderByChild('createdAt')
      .endAt(cutoff)
      .once('value');

    const updates = {};
    snap.forEach(s => {
      if (s.val().status === 'active') {
        updates[`${s.key}/status`] = 'closed';
      }
    });

    if (Object.keys(updates).length) {
      await db.ref('sessions').update(updates);
      console.log(`cleanupStaleSessions: closed ${Object.keys(updates).length} stale session(s)`);
    }

    return null;
  });

// ══════════════════════════════════════════════════════════
// 5.  authRequest
//     Owner calls this with their passphrase.
//     Checks it against the hash stored in /auth_config,
//     then sends a 6-digit OTP via Telegram.
//
//     Rate limited: 5 requests per 10 minutes per IP.
// ══════════════════════════════════════════════════════════
exports.authRequest = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { passphrase } = req.body || {};
    if (!passphrase || typeof passphrase !== 'string' || passphrase.length > 256) {
      return res.status(400).json({ error: 'invalid request' });
    }

    // ── Rate limit by IP (5 req / 10 min) ──────────────────
    const ip         = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash     = sha256hex(ip).slice(0, 16);
    const rlRef      = db.ref(`rate_limits/auth/${ipHash}`);
    const rlSnap     = await rlRef.once('value');
    const rlData     = rlSnap.val() || { count: 0, window_start: 0 };
    const WINDOW_MS  = 10 * 60 * 1000;
    const now        = Date.now();

    if (now - rlData.window_start < WINDOW_MS) {
      if (rlData.count >= 5) {
        return res.status(429).json({ error: 'too many requests — try again later' });
      }
      await rlRef.update({ count: rlData.count + 1 });
    } else {
      await rlRef.set({ count: 1, window_start: now });
    }

    // ── Passphrase check ────────────────────────────────────
    const configSnap = await db.ref('auth_config/passphrase_hash').once('value');
    const storedHash = configSnap.val();
    if (!storedHash) {
      console.error('authRequest: /auth_config/passphrase_hash not set in RTDB');
      return res.status(500).json({ error: 'server misconfigured' });
    }

    const incoming = sha256hex(passphrase);
    if (!timingSafeEqual(incoming, storedHash)) {
      return res.status(403).json({ error: 'invalid passphrase' });
    }

    // ── Generate and store OTP ──────────────────────────────
    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = now + 5 * 60 * 1000;  // 5 minutes
    await db.ref(`auth_otp/${otp}`).set({ expires, used: false });

    // ── Send OTP via Telegram ───────────────────────────────
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    await telegramPost(token, 'sendMessage', {
      chat_id: chatId,
      text:    `🔐 Your OTP: ${otp}\nExpires in 5 minutes.`,
    });

    return res.status(200).json({ ok: true, message: 'OTP sent to owner' });
  });

// ══════════════════════════════════════════════════════════
// 6.  validateOTP
//     Owner submits the 6-digit OTP received on Telegram.
//     On success returns a 64-char session token valid 4h.
// ══════════════════════════════════════════════════════════
exports.validateOTP = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { otp } = req.body || {};
    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ error: 'OTP must be exactly 6 digits' });
    }

    const snap = await db.ref(`auth_otp/${otp}`).once('value');
    const data  = snap.val();

    if (!data) {
      return res.status(403).json({ error: 'invalid or expired OTP' });
    }
    if (data.expires < Date.now()) {
      await snap.ref.remove();
      return res.status(403).json({ error: 'OTP expired' });
    }
    if (data.used) {
      return res.status(403).json({ error: 'OTP already used' });
    }

    // Mark used BEFORE responding to prevent replay
    await snap.ref.update({ used: true });

    // Generate session token
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 4 * 60 * 60 * 1000;  // 4 hours
    await db.ref(`owner_sessions/${token}`).set({ expires });

    // Cleanup OTP node
    await snap.ref.remove();

    return res.status(200).json({ ok: true, token, expires });
  });

// ══════════════════════════════════════════════════════════
// 7.  verifySession
//     Lightweight check: is this session token still valid?
// ══════════════════════════════════════════════════════════
exports.verifySession = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token } = req.body || {};
    const result = await validateSessionToken(token);
    return res.status(result.valid ? 200 : 403).json(result);
  });

// ══════════════════════════════════════════════════════════
// 8.  notesList
//     Returns all notes sorted by updatedAt descending.
// ══════════════════════════════════════════════════════════
exports.notesList = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    const snap  = await db.ref('notes').once('value');
    const notes = [];

    snap.forEach(child => {
      const d = child.val();
      notes.push({
        filename:  fromRtdbKey(child.key),   // decode _dot_ back to "."
        createdAt: d.createdAt || 0,
        updatedAt: d.updatedAt || 0,
        preview:   typeof d.content === 'string' ? d.content.slice(0, 80) : '',
        location:  d.location || 'notes',   // default: private
      });
    });

    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    return res.status(200).json({ ok: true, notes });
  });

// ══════════════════════════════════════════════════════════
// 9.  notesRead
//     Returns the full content of a single note.
// ══════════════════════════════════════════════════════════
exports.notesRead = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, filename } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!isValidFilename(filename)) {
      return res.status(400).json({ error: 'invalid filename' });
    }

    const snap = await db.ref(`notes/${toRtdbKey(filename)}`).once('value');
    if (!snap.exists()) {
      return res.status(404).json({ error: `${filename}: not found` });
    }

    return res.status(200).json({ ok: true, note: snap.val() });
  });

// ══════════════════════════════════════════════════════════
// 10. notesWrite
//     Create, update, or delete a note.
// ══════════════════════════════════════════════════════════
exports.notesWrite = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, action, filename, content, location: reqLocation } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!isValidFilename(filename)) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    if (!['create', 'update', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be create, update, or delete' });
    }

    const noteRef = db.ref(`notes/${toRtdbKey(filename)}`);  // encode "." → "_dot_"
    const now     = Date.now();

    if (action === 'create') {
      const existing = await noteRef.once('value');
      if (existing.exists()) {
        return res.status(409).json({ error: `${filename}: already exists` });
      }
      const body = typeof content === 'string' ? content : '';
      const loc  = ['blog', 'root', 'projects'].includes(reqLocation) ? reqLocation : 'notes';
      await noteRef.set({ content: body, createdAt: now, updatedAt: now, location: loc });
      await pushToGitHub(filename, body, 'create');
      return res.status(200).json({ ok: true });
    }

    if (action === 'update') {
      const existing = await noteRef.once('value');
      if (!existing.exists()) {
        return res.status(404).json({ error: `${filename}: not found` });
      }
      const body = typeof content === 'string' ? content : '';
      await noteRef.update({ content: body, updatedAt: now });
      await pushToGitHub(filename, body, 'update');
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const existing = await noteRef.once('value');
      if (!existing.exists()) {
        return res.status(404).json({ error: `${filename}: not found` });
      }
      await noteRef.remove();
      await pushToGitHub(filename, '', 'delete');
      return res.status(200).json({ ok: true });
    }
  });

// ══════════════════════════════════════════════════════════
// 11. dailyCleanup
//     Scheduled function that runs daily at 02:00 ICT
//     (19:00 UTC) and sweeps all accumulating RTDB paths:
//     /auth_otp, /owner_sessions, /rate_limits,
//     /sessions (closed/stale), /single_messages (old).
// ══════════════════════════════════════════════════════════
exports.dailyCleanup = functions
  .region(REGION)
  .pubsub.schedule('0 19 * * *')   // 02:00 ICT (UTC+7)
  .timeZone('UTC')
  .onRun(async () => {
    const now     = Date.now();
    let   removed = 0;

    // 1. /auth_otp — expired OTP nodes (normally 5-min TTL)
    const otpSnap = await db.ref('auth_otp').once('value');
    const otpDels = [];
    otpSnap.forEach(child => {
      if (!child.val().expires || child.val().expires < now) {
        otpDels.push(child.ref.remove());
        removed++;
      }
    });
    await Promise.all(otpDels);

    // 2. /owner_sessions — expired session tokens (4-hour TTL)
    const sessSnap = await db.ref('owner_sessions').once('value');
    const sessDels = [];
    sessSnap.forEach(child => {
      if (!child.val().expires || child.val().expires < now) {
        sessDels.push(child.ref.remove());
        removed++;
      }
    });
    await Promise.all(sessDels);

    // 3. /rate_limits — windows older than 1 day
    const rlCutoff = now - 24 * 60 * 60 * 1000;
    const rlSnap   = await db.ref('rate_limits/auth').once('value');
    const rlDels   = [];
    rlSnap.forEach(child => {
      if (!child.val().window_start || child.val().window_start < rlCutoff) {
        rlDels.push(child.ref.remove());
        removed++;
      }
    });
    await Promise.all(rlDels);

    // 4. /sessions — closed sessions older than 7 days (delete entirely)
    const msgCutoff = now - 7 * 24 * 60 * 60 * 1000;
    const chatSnap  = await db.ref('sessions')
      .orderByChild('createdAt').endAt(msgCutoff).once('value');
    const chatDels  = [];
    chatSnap.forEach(child => {
      if (child.val().status === 'closed' || child.val().status === 'active') {
        chatDels.push(child.ref.remove());
        removed++;
      }
    });
    await Promise.all(chatDels);

    // 5. /single_messages — older than 30 days
    const smCutoff = now - 30 * 24 * 60 * 60 * 1000;
    const smSnap   = await db.ref('single_messages')
      .orderByChild('timestamp').endAt(smCutoff).once('value');
    const smDels   = [];
    smSnap.forEach(child => { smDels.push(child.ref.remove()); removed++; });
    await Promise.all(smDels);

    console.log(`dailyCleanup: removed ${removed} stale node(s)`);
    return null;
  });

// ══════════════════════════════════════════════════════════
// 12. siteFileWrite
//     Authenticated: write plain Markdown to a site content
//     file on GitHub (no RTDB involvement).
//     Client sends fileKey (not path) — server resolves to
//     the actual GitHub path from SITE_FILE_WHITELIST.
// ══════════════════════════════════════════════════════════
exports.siteFileWrite = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, fileKey, content } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!fileKey || typeof fileKey !== 'string' || fileKey.length > 128) {
      return res.status(400).json({ error: 'invalid fileKey' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }
    if (content.length > 512 * 1024) {
      return res.status(400).json({ error: 'content too large (max 512 KB)' });
    }

    const gitPath = resolveSiteFilePath(fileKey);
    if (!gitPath) {
      return res.status(400).json({ error: `fileKey '${fileKey}' is not in the site file whitelist` });
    }

    // Derive a display filename for the commit message (last path segment)
    const displayName = gitPath.split('/').pop();

    try {
      await pushToGitHub(displayName, content, 'update', gitPath, /* obfuscate= */ false);
    } catch (e) {
      return res.status(500).json({ error: `GitHub push failed: ${e.message}` });
    }

    return res.status(200).json({ ok: true });
  });

// ══════════════════════════════════════════════════════════
// 13. notesMove
//     Authenticated: update the `location` field of a note
//     in RTDB (the source of truth for publish/visibility).
//     newLocation: 'notes' | 'blog' | 'root' | 'projects'
// ══════════════════════════════════════════════════════════
exports.notesMove = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, filename, newLocation } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!isValidFilename(filename)) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    const VALID_LOCATIONS = ['notes', 'blog', 'root', 'projects'];
    if (!VALID_LOCATIONS.includes(newLocation)) {
      return res.status(400).json({ error: `newLocation must be one of: ${VALID_LOCATIONS.join(', ')}` });
    }

    const noteRef = db.ref(`notes/${toRtdbKey(filename)}`);
    const snap    = await noteRef.once('value');
    if (!snap.exists()) {
      return res.status(404).json({ error: `${filename}: not found` });
    }

    await noteRef.update({ location: newLocation, updatedAt: Date.now() });
    return res.status(200).json({ ok: true });
  });

// ══════════════════════════════════════════════════════════
// 14. notesListPublic
//     No auth required — returns notes where location !== 'notes'
//     for the boot-time public FS population.
//     Rate-limited: 60 req/min/IP
//     Capped: 50 notes max, 64 KB/note content
// ══════════════════════════════════════════════════════════
exports.notesListPublic = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Rate limit: 60 req / 1 min / IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const limited = await isRateLimited('notesPublic', ip, 60, 60 * 1000);
    if (limited) {
      return res.status(429).json({ error: 'too many requests — try again later' });
    }

    const snap  = await db.ref('notes').once('value');
    const notes = [];

    snap.forEach(child => {
      const d = child.val();
      if (!d || typeof d.content !== 'string') return;
      const loc = d.location || 'notes';
      if (loc === 'notes') return;  // skip private
      notes.push({
        filename: fromRtdbKey(child.key),
        content:  d.content.slice(0, 65536),   // 64 KB cap
        location: loc,
      });
    });

    return res.status(200).json({ ok: true, notes: notes.slice(0, 50) });
  });

// ══════════════════════════════════════════════════════════
// 15. blogManifestRemove
//     Authenticated: removes a post entry from
//     content/blog/manifest.json on GitHub.
//     Called when a static blog post is moved to notes.
// ══════════════════════════════════════════════════════════
exports.blogManifestRemove = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, file } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!file || !/^[a-zA-Z0-9_-]+\.md$/.test(file) || file.length > 64) {
      return res.status(400).json({ error: 'invalid file parameter (must match [a-zA-Z0-9_-]+.md)' });
    }

    const pat   = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    if (!pat || !owner || !repo) {
      return res.status(500).json({ error: 'GitHub not configured' });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content/blog/manifest.json`;
    const headers = {
      'Authorization': `Bearer ${pat}`,
      'Accept':        'application/vnd.github+json',
      'Content-Type':  'application/json',
    };

    try {
      // Fetch current manifest.json from GitHub
      const getRes = await fetch(apiUrl, { headers });
      if (!getRes.ok) {
        return res.status(500).json({ error: `Could not fetch manifest.json: HTTP ${getRes.status}` });
      }
      const ghData = await getRes.json();
      const sha    = ghData.sha;
      const rawJson = Buffer.from(ghData.content, 'base64').toString('utf8');

      let posts;
      try { posts = JSON.parse(rawJson); }
      catch (e) { return res.status(500).json({ error: 'manifest.json is not valid JSON' }); }

      const originalLen = posts.length;
      const filtered = posts.filter(p => p.file !== file);

      if (filtered.length === originalLen) {
        // Entry wasn't in manifest — that's OK (idempotent)
        return res.status(200).json({ ok: true, notFound: true });
      }

      const newContent = Buffer.from(JSON.stringify(filtered, null, 2) + '\n', 'utf8').toString('base64');

      const putRes = await fetch(apiUrl, {
        method:  'PUT',
        headers,
        body: JSON.stringify({
          message: `content: remove ${file} from blog manifest`,
          content: newContent,
          sha,
        }),
      });

      if (!putRes.ok) {
        const errBody = await putRes.text();
        return res.status(500).json({ error: `GitHub PUT failed: ${putRes.status} — ${errBody.slice(0, 200)}` });
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error(`blogManifestRemove: ${e.message}`);
      return res.status(500).json({ error: e.message });
    }
  });

// ══════════════════════════════════════════════════════════
// 17. aiAsk
//     Public: proxy a question to the HF Inference API
//     (Mistral-7B-Instruct) with a portfolio system prompt.
//     Rate-limited: 10 req / hour / IP.
// ══════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are the AI assistant for Hahuy's terminal portfolio (hahuy.site).
Answer questions about the owner concisely (≤150 words). Be direct and technical.

About the owner:
Hahuy is a full-stack developer and builder focused on fast, elegant, purposeful tools.
He does full-stack development, developer tooling, and open source.
Currently learning Assembly & Rust; interested in Drone engineering.
Built this portfolio as a zero-dependency vanilla JS terminal UI.

Skills:
- Languages: JavaScript, HTML/CSS, Python (proficient), C++/Assembly (improving)
- ML/AI: Neural Network design, LLM optimization, deployment
- Quantum: Qiskit, Cirq, Braket, Quantum ML
- Frontend: Vanilla JS, React/Next.js
- Backend: Node.js/Express, REST/FastAPI, PostgreSQL, Docker, CI/CD
- Tools: Git, GitHub Actions, VS Code, Linux CLI

If asked something unrelated to the portfolio or owner, briefly redirect.`;

exports.aiAsk = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

    // ── Billing kill-switch ──────────────────────────────────
    if (process.env.HF_DISABLED === 'true')
      return res.status(402).json({ error: "Sorry, we ran out of tokens :( Come back later!" });

    const { question: rawQ, token } = req.body || {};
    const question = (rawQ || '').toString().trim().slice(0, 500);
    if (!question) return res.status(400).json({ error: 'question is required' });

    // ── Tiered rate limit ────────────────────────────────────
    // Owner (valid session token) → no rate limit
    // Guest → 10 req / hour / IP
    const isOwner = token ? (await validateSessionToken(token)).valid : false;
    if (!isOwner) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
      if (await isRateLimited('aiAsk', ip, 10, 60 * 60 * 1000))
        return res.status(429).json({ error: 'Rate limit reached — try again in an hour.' });
    }

    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return res.status(500).json({ error: 'HF_API_KEY not configured' });

    const HF_MODEL = 'meta-llama/Llama-3.2-1B-Instruct';
    const HF_URL   = 'https://router.huggingface.co/v1/chat/completions';

    try {
      const hfRes = await fetch(HF_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: HF_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: question },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      if (!hfRes.ok) {
        const errBody = await hfRes.text();
        console.error(`aiAsk: HF error ${hfRes.status} — ${errBody.slice(0, 300)}`);
        return res.status(502).json({ error: 'Oracle is offline. Try again later.' });
      }
      const data   = await hfRes.json();
      const answer = (data.choices?.[0]?.message?.content || '').trim();
      if (!answer) return res.status(502).json({ error: 'Oracle returned an empty response.' });
      return res.status(200).json({ answer });
    } catch (e) {
      console.error(`aiAsk: ${e.message}`);
      return res.status(500).json({ error: 'Oracle is offline. Try again later.' });
    }
  });

// ══════════════════════════════════════════════════════════
// 16. fileUpload
//     Authenticated: upload a binary file (image/pdf) to
//     GitHub content/ directory.
//     Accepts: { token, filename, dataBase64, mimeType }
//     PDFs  → content/<filename>.pdf
//     Images → content/images/<filename>
//     Also maintains content/images/manifest.json for images.
//     Max size: 5 MB.  Allowed: jpg|jpeg|png|gif|webp|svg|pdf
// ══════════════════════════════════════════════════════════
const UPLOAD_FILENAME_RE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i;
const UPLOAD_MAX_BYTES   = 5 * 1024 * 1024; // 5 MB

async function updateImagesManifest(filename, mimeType, pat, owner, repo) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content/images/manifest.json`;
  const headers = makeGitHubHeaders(pat);

  let entries = [];
  let sha     = null;

  const getRes = await fetch(apiUrl, { headers });
  if (getRes.ok) {
    const ghData = await getRes.json();
    sha = ghData.sha || null;
    try {
      const raw = Buffer.from(ghData.content, 'base64').toString('utf8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch (_) { entries = []; }
  }

  // Upsert entry
  const idx = entries.findIndex(e => e.name === filename);
  if (idx >= 0) {
    entries[idx].mimeType = mimeType;
  } else {
    entries.push({ name: filename, mimeType });
  }

  const newContent = Buffer.from(JSON.stringify(entries, null, 2) + '\n', 'utf8').toString('base64');
  await fetch(apiUrl, {
    method:  'PUT',
    headers,
    body: JSON.stringify({
      message: `content: update images/manifest.json (add ${filename})`,
      content: newContent,
      ...(sha ? { sha } : {}),
    }),
  });
}

exports.fileUpload = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {

    setCors(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { token, filename, dataBase64, mimeType } = req.body || {};

    // Auth
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    // Validate filename
    if (!filename || typeof filename !== 'string' ||
        !UPLOAD_FILENAME_RE.test(filename) || filename.length > 128) {
      return res.status(400).json({
        error: 'invalid filename — only letters, numbers, hyphens, underscores + allowed extension (max 128 chars)',
      });
    }

    // Validate base64 payload
    if (!dataBase64 || typeof dataBase64 !== 'string') {
      return res.status(400).json({ error: 'dataBase64 is required' });
    }

    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length > UPLOAD_MAX_BYTES) {
      return res.status(400).json({ error: `file too large — max ${UPLOAD_MAX_BYTES / 1024 / 1024} MB` });
    }
    if (buf.length === 0) {
      return res.status(400).json({ error: 'empty file' });
    }

    const pat   = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    if (!pat || !owner || !repo) {
      return res.status(500).json({ error: 'GitHub not configured' });
    }

    const ext      = filename.split('.').pop().toLowerCase();
    const isPdf    = ext === 'pdf';
    const gitPath  = isPdf
      ? `content/${filename}`
      : `content/images/${filename}`;
    const apiUrl   = `https://api.github.com/repos/${owner}/${repo}/contents/${gitPath}`;
    const ghHeaders = makeGitHubHeaders(pat);

    try {
      // GET existing SHA (for update)
      let sha = null;
      const getRes = await fetch(apiUrl, { headers: ghHeaders });
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha || null;
      }

      // PUT file to GitHub (raw base64, no obfuscation)
      const putRes = await fetch(apiUrl, {
        method:  'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `content: upload ${filename}`,
          content: dataBase64,
          ...(sha ? { sha } : {}),
        }),
      });

      if (!putRes.ok) {
        const errBody = await putRes.text();
        return res.status(500).json({ error: `GitHub PUT failed: ${putRes.status} — ${errBody.slice(0, 200)}` });
      }

      // Update images manifest fire-and-forget — don't block the client response
      if (!isPdf) {
        const safeMime = (typeof mimeType === 'string' && mimeType.length < 64) ? mimeType : `image/${ext}`;
        updateImagesManifest(filename, safeMime, pat, owner, repo).catch(e => {
          console.error(`fileUpload: manifest update failed — ${e.message}`);
        });
      }

      const url = `/${gitPath}`;
      return res.status(200).json({ ok: true, url });

    } catch (e) {
      console.error(`fileUpload: ${e.message}`);
      return res.status(500).json({ error: e.message });
    }
  });
