/**
 * scripts/migrate-data.js — Migrate chanakya-data.json → SQLite app_data table.
 *
 * Usage:  npm run migrate
 *
 * Run this ONCE after the initial npm install to move your existing 5MB of
 * project/task data into SQLite. After migration the JSON file is kept as a
 * backup — the server will read from SQLite going forward.
 *
 * Safe to re-run: it overwrites the SQLite row with the JSON file contents,
 * so you can use it to restore from the JSON backup if needed.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { saveAppData } = require('../db/db');

const DATA_FILE = path.join(__dirname, '..', 'data', 'chanakya-data.json');

function migrate() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('\n  No chanakya-data.json found — starting with empty database.\n');
    process.exit(0);
  }

  console.log('\n  Reading chanakya-data.json...');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('  ✗  Could not parse chanakya-data.json:', e.message);
    process.exit(1);
  }

  const keys = ['projs', 'resources', 'meta', 'tasks', 'baselines', 'planner'];
  for (const k of keys) {
    const count = data[k] ? Object.keys(data[k]).length : 0;
    console.log(`  •  ${k.padEnd(12)} ${count} entries`);
  }

  console.log('\n  Writing to SQLite app_data table...');
  try {
    saveAppData(data);
    console.log('  ✓  Migration complete.\n');

    // Rename the original file as a backup (keeps it safe, server won't read it again)
    const backup = DATA_FILE + '.pre-sqlite.bak';
    fs.renameSync(DATA_FILE, backup);
    console.log(`  ✦  Original file moved to: data/chanakya-data.json.pre-sqlite.bak`);
    console.log(`     (Keep it as a backup — delete when you're confident.)\n`);
  } catch (e) {
    console.error('  ✗  Migration failed:', e.message);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
