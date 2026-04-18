/**
 * scripts/reset-passwords.js — Reset user passwords in SQLite.
 * Run once: node scripts/reset-passwords.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../db/db');

async function run() {
  const updates = [
    { email: 'admin@chanakya.in',             password: 'admin123' },
    { email: 'pavan@whitelotusgroup.in',       password: 'wlg123' },
    { email: 'chetan@whitelotusgroup.in',      password: 'wlg123' },
    { email: 'praveer.c@whitelotusgroup.in',   password: 'wlg123' },
    { email: 'shraddha.b@whitelotusgroup.in',  password: 'wlg123' },
    { email: 'stanly.john@whitelotusgroup.in', password: 'wlg123' },
    { email: 'vandana.p@whitelotusgroup.in',   password: 'wlg123' },
    { email: 'productanalyst.wl@gmail.com',    password: 'wlg123' },
  ];

  const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE email = ? COLLATE NOCASE');

  for (const u of updates) {
    const hash = await bcrypt.hash(u.password, 12);
    const result = stmt.run(hash, u.email);
    console.log(result.changes > 0 ? `✓  ${u.email}` : `⚠  not found: ${u.email} — run npm run seed first`);
  }
  console.log('\n✓ Passwords reset. Restart the server: npm start');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
