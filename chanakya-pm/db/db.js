/**
 * db/db.js — SQLite database connection and schema initialisation.
 *
 * Uses better-sqlite3 (synchronous driver, perfect for Express).
 * WAL mode is enabled for crash safety and concurrent reads.
 *
 * Tables:
 *   users     — authentication roster (replaces data/users.json)
 *   app_data  — project/task state as JSON columns (replaces data/chanakya-data.json)
 *               Stored as a single singleton row; API shape is identical to before.
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// DATA_DIR: use env var override (set to /data on Render for persistent disk),
// or fall back to the local data/ directory next to the project root.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'chanakya.db');

// Open (or create) the database file
const db = new Database(DB_PATH);

// WAL mode: allows concurrent reads while a write is in progress.
// Far safer than the default journal mode for a web server.
db.pragma('journal_mode = WAL');

// Enforce foreign keys (good practice even if not yet used)
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  -- Authentication roster
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'viewer',
    permissions  TEXT NOT NULL DEFAULT 'view',
    password_hash TEXT,          -- NULL for Google-only accounts
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Singleton row that holds all project state as JSON columns.
  -- id is constrained to 1 so there can only ever be one row.
  CREATE TABLE IF NOT EXISTS app_data (
    id        INTEGER PRIMARY KEY CHECK (id = 1),
    projs     TEXT NOT NULL DEFAULT '{}',
    resources TEXT NOT NULL DEFAULT '{}',
    meta      TEXT NOT NULL DEFAULT '{}',
    tasks     TEXT NOT NULL DEFAULT '{}',
    baselines TEXT NOT NULL DEFAULT '{}',
    planner   TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Seed the singleton row if it doesn't exist yet
  INSERT OR IGNORE INTO app_data (id) VALUES (1);

  -- Audit log: every create / edit / delete action
  CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT    NOT NULL DEFAULT (datetime('now')),
    user_id     TEXT    NOT NULL DEFAULT '',
    user_name   TEXT    NOT NULL DEFAULT '',
    action      TEXT    NOT NULL,   -- 'create' | 'edit' | 'delete' | 'copy-tasks' | 'reschedule' | …
    entity_type TEXT    NOT NULL,   -- 'task' | 'project' | …
    entity_id   TEXT    NOT NULL DEFAULT '',
    entity_name TEXT    NOT NULL DEFAULT ''
  );
`);

// ─── Migrations (safe to run on every start) ─────────────────────────────────
// Add permissions column if it doesn't exist yet (existing deployments)
try { db.exec("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT 'view'"); }
catch(_){/* column already exists */}

// audit_log table is created above via CREATE TABLE IF NOT EXISTS — no ALTER needed

// ─── Prepared statements ──────────────────────────────────────────────────────

/** Users */
const stmts = {
  getUserByEmail : db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  getUserById    : db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser     : db.prepare(`
    INSERT INTO users (id, email, name, role, permissions, password_hash)
    VALUES (@id, @email, @name, @role, @permissions, @passwordHash)
  `),
  upsertUser     : db.prepare(`
    INSERT INTO users (id, email, name, role, permissions, password_hash)
    VALUES (@id, @email, @name, @role, @permissions, @passwordHash)
    ON CONFLICT(email) DO UPDATE SET
      name          = excluded.name,
      role          = excluded.role,
      permissions   = excluded.permissions,
      password_hash = COALESCE(excluded.password_hash, users.password_hash)
  `),
  listUsers      : db.prepare('SELECT id, email, name, role, permissions, created_at FROM users ORDER BY name'),

  /** Audit log */
  insertAudit    : db.prepare(`
    INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_name)
    VALUES (@userId, @userName, @action, @entityType, @entityId, @entityName)
  `),
  listAudit      : db.prepare(`
    SELECT id, ts, user_id, user_name, action, entity_type, entity_id, entity_name
    FROM audit_log ORDER BY id DESC LIMIT 500
  `),

  /** App data */
  getAppData     : db.prepare('SELECT projs, resources, meta, tasks, baselines, planner FROM app_data WHERE id = 1'),
  updateAppData  : db.prepare(`
    UPDATE app_data SET
      projs      = @projs,
      resources  = @resources,
      meta       = @meta,
      tasks      = @tasks,
      baselines  = @baselines,
      planner    = @planner,
      updated_at = datetime('now')
    WHERE id = 1
  `),
};

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * loadAppData() — returns parsed JS objects for each data section.
 * Always returns a valid object even if a column is empty/corrupt.
 */
function loadAppData() {
  const row = stmts.getAppData.get();
  const safe = (col) => {
    try { return JSON.parse(row[col] || '{}'); }
    catch { return {}; }
  };
  return {
    projs     : safe('projs'),
    resources : safe('resources'),
    meta      : safe('meta'),
    tasks     : safe('tasks'),
    baselines : safe('baselines'),
    planner   : safe('planner'),
  };
}

/**
 * saveAppData(data) — merges the supplied keys into the singleton row.
 * Only the keys present in `data` are updated; omitted keys are preserved.
 */
function saveAppData(data) {
  const existing = loadAppData();
  const allowed  = ['projs', 'resources', 'meta', 'tasks', 'baselines', 'planner'];

  const merged = { ...existing };
  for (const key of allowed) {
    if (key in data && data[key] !== null && typeof data[key] === 'object') {
      merged[key] = data[key];
    }
  }

  stmts.updateAppData.run({
    projs     : JSON.stringify(merged.projs),
    resources : JSON.stringify(merged.resources),
    meta      : JSON.stringify(merged.meta),
    tasks     : JSON.stringify(merged.tasks),
    baselines : JSON.stringify(merged.baselines),
    planner   : JSON.stringify(merged.planner),
  });

  return merged;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { db, stmts, loadAppData, saveAppData };
