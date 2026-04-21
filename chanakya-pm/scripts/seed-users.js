/**
 * scripts/seed-users.js — Migrate users from data/users.json → SQLite users table.
 *
 * Usage:  npm run seed
 *
 * Safe to run multiple times (INSERT OR IGNORE — existing rows are never overwritten).
 * Preserves all existing bcrypt hashes — no passwords are re-hashed or changed.
 *
 * To add a new user after initial migration: add an entry to data/users.json
 * with a plain-text "password" field (instead of "passwordHash"), then re-run.
 * Or use a DB browser to INSERT directly into the users table.
 */

require('dotenv').config();

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');

// Load db — this also creates the schema if it doesn't exist yet
const { stmts } = require('../db/db');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

async function seed() {
  if (!fs.existsSync(USERS_FILE)) {
    console.error('✗  data/users.json not found — nothing to migrate.');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  console.log(`\n  Migrating ${users.length} user(s) from users.json → SQLite...\n`);

  let ok = 0, skipped = 0;

  for (const u of users) {
    // Support both "passwordHash" (existing hashed) and "password" (plain-text for new users)
    let passwordHash = u.passwordHash || null;
    if (!passwordHash && u.password) {
      passwordHash = await bcrypt.hash(u.password, 12);
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
      console.log(`  ✓  ${u.email.padEnd(42)} (${u.role})`);
      ok++;
    } catch (e) {
      console.error(`  ✗  ${u.email} — ${e.message}`);
      skipped++;
    }
  }

  const total = stmts.listUsers.all().length;
  console.log(`\n  Done — ${ok} migrated, ${skipped} skipped.`);
  console.log(`  Total users in database: ${total}\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
