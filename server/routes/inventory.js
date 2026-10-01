const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create asset
router.post('/', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { asset_code, name, category, description, status, purchase_date, purchase_cost, warranty_expiry, location, metadata } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO assets (institution_id, asset_code, name, category, description, status, purchase_date, purchase_cost, warranty_expiry, location, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.auth.institution_id, asset_code || null, name, category, description || null, status || 'available', purchase_date || null, purchase_cost || null, warranty_expiry || null, location || null, metadata || '{}']
    );
    await logAudit(pool, req.auth, { action: 'asset.create', entityType: 'asset', entityId: rows[0].id });
    res.json({ success: true, asset: rows[0] });
  } catch (err) {
    console.error('[inventory] create failed:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// List assets
router.get('/', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  const { category, status, search, page } = req.query;
  const limit = 50;
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;
  try {
    let query = `SELECT a.*, u.full_name AS assigned_to_name FROM assets a LEFT JOIN users u ON u.id = a.assigned_to WHERE a.institution_id = $1`;
    const params = [req.auth.institution_id];
    let idx = 2;
    if (category) { query += ` AND a.category = $${idx++}`; params.push(category); }
    if (status) { query += ` AND a.status = $${idx++}`; params.push(status); }
    if (search) { query += ` AND (a.name ILIKE $${idx} OR a.asset_code ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    query += ` ORDER BY a.name LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const { rows } = await pool.query(query, params);
    res.json({ assets: rows });
  } catch (err) {
    console.error('[inventory] list failed:', err);
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

// Update asset
router.patch('/:id', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const allowed = ['name', 'category', 'description', 'status', 'location', 'assigned_to', 'metadata'];
  const updates = [];
  const params = [req.params.id, req.auth.institution_id];
  let idx = 3;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${idx++}`); params.push(req.body[key]); }
  }
  if (req.body.assigned_to) { updates.push(`assigned_at = NOW()`); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = NOW()');
  try {
    const { rows } = await pool.query(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = $1 AND institution_id = $2 RETURNING *`, params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ success: true, asset: rows[0] });
  } catch (err) {
    console.error('[inventory] update failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Add maintenance record
router.post('/:id/maintenance', requireAuth, requireRole('admin', 'opsadmin'), requireTenant, async (req, res) => {
  const { type, description, cost, performed_by, performed_at, next_due } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  try {
    const owned = await pool.query('SELECT id FROM assets WHERE id = $1 AND institution_id = $2', [
      req.params.id,
      req.auth.institution_id,
    ]);
    if (owned.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });

    const { rows } = await pool.query(
      `INSERT INTO asset_maintenance (asset_id, type, description, cost, performed_by, performed_at, next_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, type, description || null, cost || null, performed_by || null, performed_at || null, next_due || null]
    );
    // An open repair should show on the asset row, not just in its history.
    if (type === 'repair') {
      await pool.query(
        `UPDATE assets SET status = 'under_repair', updated_at = NOW()
          WHERE id = $1 AND institution_id = $2 AND status <> 'disposed'`,
        [req.params.id, req.auth.institution_id]
      );
    }
    await logAudit(pool, req.auth, {
      action: 'asset.maintenance',
      entityType: 'asset',
      entityId: req.params.id,
      metadata: { type },
    });
    res.json({ success: true, maintenance: rows[0] });
  } catch (err) {
    console.error('[inventory] maintenance failed:', err);
    res.status(500).json({ error: 'Failed to add maintenance record' });
  }
});

// Asset stats — headline counters plus the category/status breakdown.
router.get('/stats', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  try {
    const [totals, breakdown] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'available')::int AS available,
                count(*) FILTER (WHERE status = 'assigned')::int AS assigned,
                count(*) FILTER (WHERE status = 'under_repair')::int AS under_repair,
                count(*) FILTER (WHERE status = 'disposed')::int AS disposed,
                COALESCE(sum(purchase_cost), 0)::float AS total_value
           FROM assets WHERE institution_id = $1`,
        [req.auth.institution_id]
      ),
      pool.query(
        `SELECT category, status, count(*)::int AS count
           FROM assets WHERE institution_id = $1
           GROUP BY category, status ORDER BY category, status`,
        [req.auth.institution_id]
      ),
    ]);
    res.json({ stats: { ...totals.rows[0], breakdown: breakdown.rows } });
  } catch (err) {
    console.error('[inventory] stats failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Maintenance history for an asset
router.get('/:id/maintenance', requireAuth, requireRole('admin', 'opsadmin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.* FROM asset_maintenance m
         JOIN assets a ON a.id = m.asset_id
        WHERE m.asset_id = $1 AND a.institution_id = $2
        ORDER BY COALESCE(m.performed_at, m.created_at::date) DESC`,
      [req.params.id, req.auth.institution_id]
    );
    res.json({ maintenance: rows });
  } catch (err) {
    console.error('[inventory] maintenance list failed:', err);
    res.status(500).json({ error: 'Failed to load maintenance history' });
  }
});

module.exports = router;
