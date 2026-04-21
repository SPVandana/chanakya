/**
 * scripts/seed-users-auto.js — Synchronous startup seed.
 *
 * Called automatically by server.js on every boot.
 * Uses INSERT OR IGNORE so existing rows are never overwritten.
 * Plain-text "password" fields are hashed with bcrypt synchronously.
 *
 * Does NOT call process.exit() — safe to require() from server.js.
 */

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const { stmts } = require('../db/db');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

if (!fs.existsSync(USERS_FILE)) {
  console.warn('[seed-auto] data/users.json not found — skipping user seed.');
  return;
}

let users;
try {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
} catch (e) {
  console.error('[seed-auto] Failed to parse users.json:', e.message);
  return;
}

let seeded = 0;
for (const u of users) {
  let passwordHash = u.passwordHash || null;
  if (!passwordHash && u.password) {
    passwordHash = bcrypt.hashSync(u.password, 12);
  }
  try {
    stmts.upsertUser.run({
      id          : u.id,
      email       : u.email,
      name        : u.name,
      role        : u.role,
      permissions : u.permissions || 'view',
      passwordHash,
    });
    seeded++;
  } catch (e) {
    console.error('[seed-auto] Could not seed user', u.email, '—', e.message);
  }
}

console.log(`[seed-auto] ${seeded} user(s) seeded/verified in DB.`);
