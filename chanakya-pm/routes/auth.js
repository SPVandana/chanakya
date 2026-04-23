/**
 * Auth routes
 *
 *   POST /api/auth/login         — email + password → JWT
 *   POST /api/auth/google        — Google access_token → JWT
 *
 * Data source: SQLite users table (via db/db.js)
 * Previously used: data/users.json
 */

const express        = require('express');
const bcrypt         = require('bcryptjs');
const fetch          = require('node-fetch');
const { stmts }      = require('../db/db');
const { signToken }  = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Two-layer rate limit on login to blunt brute-force without locking out real
// users. IP-based catches attackers who spray many emails from one source;
// email-based catches attackers who rotate IPs against one account.
const loginLimitByIp    = createRateLimit({ windowMs: 15 * 60_000, max: 30, keyBy: 'ip',
  message: 'Too many login attempts from this network. Try again in a few minutes.' });
const loginLimitByEmail = createRateLimit({ windowMs: 15 * 60_000, max: 10, keyBy: 'email',
  message: 'Too many failed attempts for this account. Try again in a few minutes.' });

const googleLimitByIp   = createRateLimit({ windowMs: 15 * 60_000, max: 30, keyBy: 'ip',
  message: 'Too many Google sign-in attempts. Try again in a few minutes.' });

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginLimitByIp, loginLimitByEmail, async (req, res) => {
  const body = req.body || {};
  const email    = typeof body.email === 'string'    ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  // Reject absurdly large inputs as cheap DoS defense (bcrypt is expensive)
  if (email.length > 254 || password.length > 200) {
    return res.status(400).json({ error: 'Email or password exceeds allowed length' });
  }

  // Look up user by email (COLLATE NOCASE in schema handles case insensitivity)
  const user = stmts.getUserByEmail.get(email);

  if (!user) {
    // Timing-safe: hash something even when user not found to prevent user enumeration
    await bcrypt.compare(password, '$2a$12$invalidhashforfakeuserXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  if (!user.password_hash) {
    // Account exists but has no password (Google-only account)
    return res.status(401).json({ error: 'This account uses Google Sign-In. Please use the Google button.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions || 'view' },
  });
});

// ─── POST /api/auth/google ────────────────────────────────────────────────────
router.post('/google', googleLimitByIp, async (req, res) => {
  const body = req.body || {};
  const access_token = typeof body.access_token === 'string' ? body.access_token : '';

  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
  }
  if (access_token.length > 4096) {
    return res.status(400).json({ error: 'access_token is too long' });
  }

  // Verify the Google access token via Google's tokeninfo endpoint
  let googleInfo;
  try {
    const r = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(access_token)}`,
      { timeout: 5000 }
    );
    if (!r.ok) {
      const errBody = await r.text();
      console.warn('[auth/google] tokeninfo error:', errBody);
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }
    googleInfo = await r.json();
  } catch (e) {
    console.error('[auth/google] fetch error:', e.message);
    return res.status(502).json({ error: 'Could not reach Google auth service' });
  }

  // Confirm the token was issued for our app. Must match the env-configured
  // client ID exactly — no hardcoded fallback, which would allow Google login
  // to silently succeed even on a misconfigured environment.
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  if (!expectedClientId) {
    console.error('[auth/google] GOOGLE_CLIENT_ID env var is not set — refusing login');
    return res.status(503).json({ error: 'Google Sign-In is not configured on this server' });
  }
  if (googleInfo.issued_to !== expectedClientId) {
    console.warn('[auth/google] token issued_to mismatch:', googleInfo.issued_to);
    return res.status(401).json({ error: 'Google token was not issued for this application' });
  }

  const googleEmail = (googleInfo.email || '').toLowerCase();
  if (!googleEmail) {
    return res.status(401).json({ error: 'Google account has no email address' });
  }

  // Look up user in the SQLite users table
  const user = stmts.getUserByEmail.get(googleEmail);
  if (!user) {
    return res.status(403).json({
      error: `No account found for ${googleEmail}. Contact your administrator.`,
    });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions || 'view' },
  });
});

module.exports = router;
