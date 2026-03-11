/* ============================================================
   auth.js — Auth singleton
   Two-factor owner authentication:
     1. auth <passphrase>  →  POST /authRequest  →  Telegram OTP
     2. Enter OTP          →  POST /validateOTP   →  session token (4h)
   Session token is stored in localStorage and restored on page load.
   ============================================================ */

'use strict';

const Auth = (() => {

  // ── Cloud Functions base URL ───────────────────────────
  const CF_BASE     = 'https://asia-southeast1-hahuy-portfolio-f7f16.cloudfunctions.net';
  const SESSION_KEY = 'owner_session';  // localStorage key

  // ── State ─────────────────────────────────────────────
  let _pendingOTP     = false;
  let _sessionToken   = null;
  let _sessionExpires = 0;

  // ── Helper: check & restore session from localStorage ──
  function isAuthenticated() {
    // 1. Check in-memory first (fastest path)
    if (_sessionToken && _sessionExpires > Date.now()) return true;

    // 2. Try restoring from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (stored && stored.token && typeof stored.expires === 'number' &&
          stored.expires > Date.now()) {
        _sessionToken   = stored.token;
        _sessionExpires = stored.expires;
        return true;
      }
    } catch (e) { /* storage unavailable — fall through */ }

    // 3. Stale — clear
    _sessionToken   = null;
    _sessionExpires = 0;
    return false;
  }

  // ── hasPendingOTP ──────────────────────────────────────
  function hasPendingOTP() {
    return _pendingOTP;
  }

  // ── getToken — for passing to note Cloud Functions ─────
  function getToken() {
    if (!isAuthenticated()) return null;
    return _sessionToken;
  }

  // ── clearSession ───────────────────────────────────────
  function clearSession() {
    _sessionToken   = null;
    _sessionExpires = 0;
    _pendingOTP     = false;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ── startAuth(passphrase, ctx) ─────────────────────────
  // Calls /authRequest. On success sets _pendingOTP so the
  // terminal intercept route kicks in for the next input.
  async function startAuth(passphrase, ctx) {
    if (!passphrase || !passphrase.trim()) {
      return { error: 'auth: passphrase cannot be empty' };
    }

    let res, data;
    try {
      res  = await fetch(`${CF_BASE}/authRequest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ passphrase: passphrase.trim() }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      return { error: `auth: network error — ${e.message}` };
    }

    if (res.status === 429) {
      return { error: 'auth: too many attempts — try again in 10 minutes' };
    }
    if (res.status === 403) {
      return { error: 'auth: invalid passphrase' };
    }
    if (!res.ok) {
      return { error: `auth: server error (${res.status})${data.error ? ' — ' + data.error : ''}` };
    }

    _pendingOTP = true;
    return {
      lines: [{
        html: `<span style="color:var(--color-green)">✓</span> OTP sent to Telegram. ` +
              `Enter the 6-digit code:`,
        classes: ['output-line'],
      }],
    };
  }

  // ── resolveOTP(otp, ctx) ───────────────────────────────
  // Called by the terminal intercept when _pendingOTP is true.
  async function resolveOTP(otp, ctx) {
    const clean = String(otp || '').trim();

    if (!/^\d{6}$/.test(clean)) {
      // Keep _pendingOTP = true — let them try again
      return { error: 'auth: OTP must be exactly 6 digits' };
    }

    let res, data;
    try {
      res  = await fetch(`${CF_BASE}/validateOTP`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp: clean }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      // Keep _pendingOTP = true on network error
      return { error: `auth: network error — ${e.message}` };
    }

    _pendingOTP = false;  // Clear regardless of outcome

    if (!res.ok || !data.ok) {
      return { error: `auth: ${data.error || 'invalid OTP'}` };
    }

    // Store session
    _sessionToken   = data.token;
    _sessionExpires = data.expires;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token:   data.token,
        expires: data.expires,
      }));
    } catch (e) { /* storage unavailable */ }

    const minutesLeft = Math.floor((data.expires - Date.now()) / 60000);
    return {
      lines: [{
        html: `<span style="color:var(--color-green)">✓</span> Authenticated. ` +
              `Session valid for <span style="color:var(--color-blue)">${minutesLeft} minutes</span>. ` +
              `<span style="color:var(--text-muted)">Run <strong>auth --logout</strong> to end it early.</span>`,
        classes: ['output-line'],
      }],
    };
  }

  return {
    isAuthenticated,
    hasPendingOTP,
    getToken,
    clearSession,
    startAuth,
    resolveOTP,
  };

})();
