/* ============================================================
   functions/index.js — Firebase Cloud Functions
   Telegram relay for the `message` terminal command
   ============================================================ */

'use strict';

const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const https     = require('https');

admin.initializeApp();
const db = admin.database();

// ── Helper: POST a JSON payload to the Telegram Bot API ────
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
