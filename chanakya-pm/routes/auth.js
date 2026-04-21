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

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
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
router.post('/google', async (req, res) => {
  const { access_token } = req.body || {};

  if (!access_token) {
    return res.status(400).json({ error: 'access_token is required' });
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

  // Confirm the token was issued for our app
  const expectedClientId = process.env.GOOGLE_CLIENT_ID || '638036945919-lvvqs9lovnq9vfcponoiqud4lvn3dtbm.apps.googleusercontent.com';
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
