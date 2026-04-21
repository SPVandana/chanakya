/**
 * Data routes (all require a valid JWT)
 *
 *   GET  /api/data       — load full project state
 *   PUT  /api/backup     — save full project state
 *   GET  /api/export     — download project state as JSON file
 *
 * Data source: SQLite app_data table (via db/db.js)
 * Previously used: data/chanakya-data.json
 *
 * API response shape is identical to before — the HTML frontend is unchanged.
 */

const express                    = require('express');
const { requireAuth }            = require('../middleware/auth');
const { loadAppData, saveAppData } = require('../db/db');

const router = express.Router();

// ─── GET /api/data ────────────────────────────────────────────────────────────
router.get('/data', requireAuth, (_req, res) => {
  try {
    const data = loadAppData();
    res.json(data);
  } catch (e) {
    console.error('[GET /api/data]', e.message);
    res.status(500).json({ error: 'Could not read project data' });
  }
});

// ─── PUT /api/backup ─────────────────────────────────────────────────────────
router.put('/backup', requireAuth, (req, res) => {
  // Only users with edit or manage permission may write data
  const perms = (req.user.permissions || 'view').split(',');
  if (!perms.includes('edit') && !perms.includes('manage')) {
    return res.status(403).json({ error: 'You have view-only access. Contact your administrator to make changes.' });
  }
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid backup payload' });
  }

  try {
    // saveAppData merges only the known keys and stamps updated_at in SQLite
    const merged = saveAppData(body);
    const ts = new Date().toISOString();
    res.json({ ok: true, ts });
  } catch (e) {
    console.error('[PUT /api/backup]', e.message);
    res.status(500).json({ error: 'Could not write backup data' });
  }
});

// ─── GET /api/export ─────────────────────────────────────────────────────────
router.get('/export', requireAuth, (_req, res) => {
  try {
    const data     = loadAppData();
    const filename = `chanakya-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[GET /api/export]', e.message);
    res.status(500).json({ error: 'Could not generate export' });
  }
});

module.exports = router;
