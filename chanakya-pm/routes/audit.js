/**
 * routes/audit.js — Audit log endpoints
 *
 *   POST /api/audit        — record an action (any authenticated user)
 *   GET  /api/audit        — fetch recent audit entries (manage permission only)
 */

const express        = require('express');
const { requireAuth } = require('../middleware/auth');
const { stmts }      = require('../db/db');

const router = express.Router();

// Whitelists prevent a compromised client (or test code) from writing
// arbitrary values into the audit log — keeps the log meaningful and
// queryable. Extend these if you add a new action/entity type.
const ALLOWED_ACTIONS = new Set([
  'create', 'edit', 'delete', 'reschedule', 'copy-tasks',
  'import', 'export', 'login', 'logout',
  'approve', 'reject', 'restore', 'baseline-create', 'baseline-delete',
]);
const ALLOWED_ENTITY_TYPES = new Set([
  'task', 'project', 'development', 'resource', 'baseline',
  'approval', 'session', 'data',
]);

// ─── POST /api/audit ──────────────────────────────────────────────────────────
// Body: { action, entityType, entityId, entityName }
router.post('/', requireAuth, (req, res) => {
  const body = req.body || {};
  const action     = typeof body.action === 'string'     ? body.action.trim()     : '';
  const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : '';
  const entityId   = typeof body.entityId === 'string'   ? body.entityId   : '';
  const entityName = typeof body.entityName === 'string' ? body.entityName : '';

  if (!action || !entityType) {
    return res.status(400).json({ error: 'action and entityType are required' });
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: `action must be one of: ${[...ALLOWED_ACTIONS].join(', ')}` });
  }
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    return res.status(400).json({ error: `entityType must be one of: ${[...ALLOWED_ENTITY_TYPES].join(', ')}` });
  }

  try {
    stmts.insertAudit.run({
      userId     : req.user.id   || '',
      userName   : req.user.name || req.user.email || '',
      action,
      entityType,
      entityId   : String(entityId).slice(0, 64),
      entityName : String(entityName).slice(0, 200),
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/audit]', e.message);
    return res.status(500).json({ error: 'Failed to record audit entry' });
  }
});

// ─── GET /api/audit ───────────────────────────────────────────────────────────
// Returns the last 500 audit entries (most recent first).
// Restricted to users with 'manage' permission.
router.get('/', requireAuth, (req, res) => {
  const perms = (req.user.permissions || '').split(',').map(s => s.trim());
  if (!perms.includes('manage') && req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'manage permission required' });
  }
  try {
    const rows = stmts.listAudit.all();
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/audit]', e.message);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;
