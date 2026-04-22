/**
 * server.js — Chanakya PM Express server
 *
 * To run:
 *   npm start          — production
 *   npm run dev        — development with auto-restart (nodemon)
 *
 * First-time setup:
 *   npm install
 *   npm run seed       — migrate users.json → SQLite
 *   npm run migrate    — migrate chanakya-data.json → SQLite
 *   npm start
 */

require('dotenv').config();

// Initialise DB early — creates data/chanakya.db and schema on first run
require('./db/db');

// Auto-seed users on every startup (INSERT OR IGNORE — safe to run repeatedly)
require('./scripts/seed-users-auto');

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes  = require('./routes/auth');
const dataRoutes  = require('./routes/data');
const auditRoutes = require('./routes/audit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// CORS — only needed if frontend and API are on different origins.
// In production (same-origin serving via public/), this is a no-op.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));

// ─── Health check ─────────────────────────────────────────────────────────────
// The HTML pings GET /health to decide server-mode vs. local-mode.
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api',       dataRoutes);   // /api/data, /api/backup, /api/export
app.use('/api/audit', auditRoutes);  // /api/audit — audit log

// ─── Runtime config (Google Client ID, etc.) ─────────────────────────────────
// Serves /config.js so the frontend can read GOOGLE_CLIENT_ID without it being
// hardcoded in the HTML. Safe to expose — it's a public OAuth client ID.
app.get('/config.js', (_req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  res.type('application/javascript');
  res.send(`window.CKY_CONFIG = ${JSON.stringify({ googleClientId })};`);
});

// ─── Static frontend (public/) ────────────────────────────────────────────────
// Serves public/index.html and any other assets in public/.
// Because the HTML is served from the same origin as the API,
// CKY_API = window.location.origin and all fetch() calls resolve automatically.
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — any unmatched route returns index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✦ Chanakya PM  →  http://localhost:${PORT}`);
  console.log(`  ✦ Database      →  data/chanakya.db (SQLite + WAL)`);
  console.log(`  ✦ Environment   →  ${process.env.NODE_ENV || 'development'}\n`);
});
