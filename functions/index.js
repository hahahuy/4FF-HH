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
        filename:  child.key,
        createdAt: d.createdAt || 0,
        updatedAt: d.updatedAt || 0,
        preview:   typeof d.content === 'string' ? d.content.slice(0, 80) : '',
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

    const snap = await db.ref(`notes/${filename}`).once('value');
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

    const { token, action, filename, content } = req.body || {};
    const session = await validateSessionToken(token);
    if (!session.valid) return res.status(403).json({ error: 'unauthorized' });

    if (!isValidFilename(filename)) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    if (!['create', 'update', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be create, update, or delete' });
    }

    const noteRef = db.ref(`notes/${filename}`);
    const now     = Date.now();

    if (action === 'create') {
      const existing = await noteRef.once('value');
      if (existing.exists()) {
        return res.status(409).json({ error: `${filename}: already exists` });
      }
      const body = typeof content === 'string' ? content : '';
      await noteRef.set({ content: body, createdAt: now, updatedAt: now });
      return res.status(200).json({ ok: true });
    }

    if (action === 'update') {
      const existing = await noteRef.once('value');
      if (!existing.exists()) {
        return res.status(404).json({ error: `${filename}: not found` });
      }
      const body = typeof content === 'string' ? content : '';
      await noteRef.update({ content: body, updatedAt: now });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const existing = await noteRef.once('value');
      if (!existing.exists()) {
        return res.status(404).json({ error: `${filename}: not found` });
      }
      await noteRef.remove();
      return res.status(200).json({ ok: true });
    }
  });
