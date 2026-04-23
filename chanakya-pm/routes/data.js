/**
 * Data routes (all require a valid JWT)
 *
 *   GET  /api/data       — load full project state
 *   PUT  /api/backup     — save full project state
 *   GET  /api/export     — download project state as JSON file
 *
 * Data source: SQLite app_data table (via db/db.js)
 *
 * Hardening (v2):
 *   - Permission checks on every route (view / edit / manage)
 *   - Shape validation on /api/backup so malformed clients can't corrupt
 *     the singleton row
 *   - Optimistic locking (client sends updated_at, 409 on mismatch)
 *   - /api/export writes an audit entry so exports are traceable
 */

const express                    = require('express');
const { requireAuth }            = require('../middleware/auth');
const { loadAppData, saveAppData, stmts } = require('../db/db');

const router = express.Router();

// Every authenticated user has at least 'view'; this is a belt-and-braces
// check in case the token was issued without any permissions.
function requirePerm(...needed) {
  return (req, res, next) => {
    const perms = new Set(String(req.user?.permissions || '').split(',').map(s => s.trim()).filter(Boolean));
    // Admin role has every permission implicitly
    if (req.user?.role === 'Administrator') return next();
    // 'view' is granted to any authenticated user so simple reads work
    if (needed.length === 1 && needed[0] === 'view') return next();
    for (const p of needed) if (perms.has(p)) return next();
    return res.status(403).json({ error: `Requires one of: ${needed.join(', ')} permission` });
  };
}

// Validate the shape of the /api/backup payload. Each top-level data key must
// be either absent or a plain object — not a string, array, or null. This
// stops a malformed client write (or a malicious one) from storing garbage
// in the singleton row and breaking every subsequent load for all users.
const EXPECTED_KEYS = ['projs', 'resources', 'meta', 'tasks', 'baselines', 'planner'];
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function validateBackupPayload(body) {
  if (!isPlainObject(body)) return 'Body must be a JSON object';
  for (const k of EXPECTED_KEYS) {
    if (k in body && body[k] !== null && body[k] !== undefined && !isPlainObject(body[k])) {
      return `Field "${k}" must be an object (got ${Array.isArray(body[k]) ? 'array' : typeof body[k]})`;
    }
  }
  // Reject unknown top-level fields except the reserved _updated_at marker
  for (const k of Object.keys(body)) {
    if (k === '_updated_at') continue;
    if (!EXPECTED_KEYS.includes(k)) return `Unexpected field "${k}"`;
  }
  return null;
}

// ─── GET /api/data ────────────────────────────────────────────────────────────
router.get('/data', requireAuth, requirePerm('view'), (_req, res) => {
  try {
    const data = loadAppData();
    return res.json(data);
  } catch (e) {
    console.error('[GET /api/data]', e.message);
    return res.status(500).json({ error: 'Could not read project data' });
  }
});

// ─── PUT /api/backup ─────────────────────────────────────────────────────────
router.put('/backup', requireAuth, requirePerm('edit', 'manage'), (req, res) => {
  const body = req.body;

  const schemaError = validateBackupPayload(body);
  if (schemaError) return res.status(400).json({ error: `Invalid backup payload — ${schemaError}` });

  // Optimistic lock — client sends the updated_at it last read; if the DB has
  // a newer value, reject with 409 so the client can re-sync before retrying.
  const expectedUpdatedAt = typeof body._updated_at === 'string' ? body._updated_at : null;

  try {
    const merged = saveAppData(body, expectedUpdatedAt);
    return res.json({ ok: true, ts: new Date().toISOString(), updated_at: merged.updated_at });
  } catch (e) {
    if (e.code === 'STALE_STATE') {
      return res.status(409).json({
        error: 'Conflict: another user saved changes after your last sync. Reload to see the latest, then retry your edit.',
        currentUpdatedAt: e.currentUpdatedAt,
      });
    }
    console.error('[PUT /api/backup]', e.message);
    return res.status(500).json({ error: 'Could not write backup data' });
  }
});

// ─── GET /api/export ─────────────────────────────────────────────────────────
// Restricted to manage permission — a full dump of every villa's state is
// sensitive enough to gate behind an admin-style role. Every export is
// recorded in the audit log for traceability.
router.get('/export', requireAuth, requirePerm('manage'), (req, res) => {
  try {
    const data     = loadAppData();
    const filename = `chanakya-export-${new Date().toISOString().slice(0, 10)}.json`;

    // Audit the export. Best-effort — don't fail the export if logging fails.
    try {
      stmts.insertAudit.run({
        userId     : req.user.id   || '',
        userName   : req.user.name || req.user.email || '',
        action     : 'export',
        entityType : 'data',
        entityId   : '',
        entityName : filename,
      });
    } catch (auditErr) {
      console.warn('[GET /api/export] audit write failed:', auditErr.message);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[GET /api/export]', e.message);
    return res.status(500).json({ error: 'Could not generate export' });
  }
});

module.exports = router;
