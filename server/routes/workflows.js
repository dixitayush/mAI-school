const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');
const { getAppPool } = require('../db/pool');

const router = express.Router();
const pool = getAppPool();

// Create workflow
router.post('/', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const { name, description, trigger_type, trigger_config, actions } = req.body;
  if (!name || !trigger_type) return res.status(400).json({ error: 'name and trigger_type are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO workflows (institution_id, name, description, trigger_type, trigger_config, actions, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.auth.institution_id, name, description || null, trigger_type, JSON.stringify(trigger_config || {}), JSON.stringify(actions || []), req.auth.user_id]
    );
    await logAudit(pool, req.auth, { action: 'workflow.create', entityType: 'workflow', entityId: rows[0].id });
    res.json({ success: true, workflow: rows[0] });
  } catch (err) {
    console.error('[workflows] create failed:', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// List workflows
router.get('/', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, u.full_name AS created_by_name,
              (SELECT count(*) FROM workflow_executions we WHERE we.workflow_id = w.id)::int AS execution_count
         FROM workflows w
         LEFT JOIN users u ON u.id = w.created_by
        WHERE w.institution_id = $1
        ORDER BY w.created_at DESC`,
      [req.auth.institution_id]
    );
    res.json({ workflows: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load workflows' }); }
});

// Get workflow with executions
router.get('/:id', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM workflows WHERE id = $1 AND institution_id = $2`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const execs = await pool.query(
      `SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ workflow: rows[0], executions: execs.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load workflow' }); }
});

// Update workflow
router.patch('/:id', requireAuth, requireRole('admin', 'principal'), requireTenant, async (req, res) => {
  const allowed = ['name', 'description', 'trigger_type', 'trigger_config', 'actions', 'is_active'];
  const updates = [];
  const params = [req.params.id, req.auth.institution_id];
  let idx = 3;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const val = ['trigger_config', 'actions'].includes(key) ? JSON.stringify(req.body[key]) : req.body[key];
      updates.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('updated_at = NOW()');
  try {
    const { rows } = await pool.query(
      `UPDATE workflows SET ${updates.join(', ')} WHERE id = $1 AND institution_id = $2 RETURNING *`, params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ success: true, workflow: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// Delete workflow
router.delete('/:id', requireAuth, requireRole('admin'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM workflows WHERE id = $1 AND institution_id = $2 RETURNING id`,
      [req.params.id, req.auth.institution_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Manually trigger a workflow (for testing)
router.post('/:id/trigger', requireAuth, requireRole('admin'), requireTenant, async (req, res) => {
  try {
    const wf = await pool.query(
      `SELECT * FROM workflows WHERE id = $1 AND institution_id = $2 AND is_active = true`,
      [req.params.id, req.auth.institution_id]
    );
    if (wf.rows.length === 0) return res.status(404).json({ error: 'Workflow not found or inactive' });

    const { rows } = await pool.query(
      `INSERT INTO workflow_executions (workflow_id, trigger_data, status)
       VALUES ($1, $2, 'completed') RETURNING *`,
      [req.params.id, JSON.stringify(req.body.trigger_data || {})]
    );

    await pool.query(
      `UPDATE workflows SET last_run_at = NOW() WHERE id = $1`, [req.params.id]
    );

    res.json({ success: true, execution: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Trigger failed' }); }
});

module.exports = router;
