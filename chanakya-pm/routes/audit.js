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

// ─── POST /api/audit ──────────────────────────────────────────────────────────
// Body: { action, entityType, entityId, entityName }
router.post('/', requireAuth, (req, res) => {
  const { action, entityType, entityId, entityName } = req.body || {};
  if (!action || !entityType) {
    return res.status(400).json({ error: 'action and entityType are required' });
  }
  try {
    stmts.insertAudit.run({
      userId     : req.user.id   || '',
      userName   : req.user.name || req.user.email || '',
      action     : String(action).slice(0, 64),
      entityType : String(entityType).slice(0, 32),
      entityId   : String(entityId   || '').slice(0, 64),
      entityName : String(entityName || '').slice(0, 200),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/audit]', e.message);
    res.status(500).json({ error: 'Failed to record audit entry' });
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
