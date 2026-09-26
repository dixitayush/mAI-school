/**
 * Billing / subscription management primitives.
 * PRD section 61
 */

const express = require('express');
const { requireAuth, requireRole, requireTenant } = require('../middleware/auth');
const { getAppPool } = require('../db/pool');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const pool = getAppPool();

// GET /api/billing — get tenant billing status
router.get('/', requireAuth, requireRole('admin', 'mai_admin'), requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tb.*, i.name AS tenant_name,
              (SELECT count(*)::int FROM students s JOIN users u ON u.id = s.user_id WHERE u.institution_id = tb.tenant_id) AS active_students
       FROM tenant_billing tb
       JOIN institutions i ON i.id = tb.tenant_id
       WHERE tb.tenant_id = $1`,
      [req.auth.institution_id]
    );
    if (rows.length === 0) {
      return res.json({
        plan: 'trial', billing_status: 'trial', student_limit: 100,
        active_students: 0, subscription_start: null, subscription_end: null,
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ error: 'Failed to load billing info' });
  }
});

// PATCH /api/billing — update plan (platform admin only)
router.patch('/', requireAuth, requireRole('mai_admin'), async (req, res) => {
  const { tenant_id, plan, billing_status, student_limit, billing_cycle, subscription_end } = req.body;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' });

  try {
    await pool.query(
      `INSERT INTO tenant_billing (tenant_id, plan, billing_status, student_limit, billing_cycle, subscription_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan = COALESCE($2, tenant_billing.plan),
         billing_status = COALESCE($3, tenant_billing.billing_status),
         student_limit = COALESCE($4, tenant_billing.student_limit),
         billing_cycle = COALESCE($5, tenant_billing.billing_cycle),
         subscription_end = COALESCE($6, tenant_billing.subscription_end),
         updated_at = NOW()`,
      [tenant_id, plan || 'trial', billing_status || 'trial', student_limit || 100, billing_cycle || 'monthly', subscription_end || null]
    );

    await logAudit(pool, req.auth, {
      action: 'billing.update',
      entityType: 'tenant_billing',
      entityId: tenant_id,
      metadata: { plan, billing_status, student_limit },
      req,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ error: 'Failed to update billing' });
  }
});

// GET /api/billing/invoices — list invoices
router.get('/invoices', requireAuth, requireRole('admin', 'mai_admin'), requireTenant, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      `SELECT id, invoice_number, amount, currency, status, due_date, paid_at, description, created_at
       FROM invoices WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.auth.institution_id, limit, offset]
    );
    res.json({ invoices: rows });
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

// POST /api/billing/invoices — create invoice (platform admin)
router.post('/invoices', requireAuth, requireRole('mai_admin'), async (req, res) => {
  const { tenant_id, amount, currency, description, due_date, line_items } = req.body;
  if (!tenant_id || !amount) return res.status(400).json({ error: 'tenant_id and amount are required' });

  try {
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const { rows } = await pool.query(
      `INSERT INTO invoices (tenant_id, invoice_number, amount, currency, description, due_date, line_items, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'issued')
       RETURNING id, invoice_number, created_at`,
      [tenant_id, invoiceNumber, amount, currency || 'INR', description || null, due_date || null, JSON.stringify(line_items || [])]
    );
    res.json({ success: true, invoice: rows[0] });
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PATCH /api/billing/invoices/:id — update invoice status
router.patch('/invoices/:id', requireAuth, requireRole('admin', 'mai_admin'), requireTenant, async (req, res) => {
  const { status } = req.body;
  if (!['paid', 'cancelled', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'status must be paid, cancelled, or refunded' });
  }
  try {
    const paidAt = status === 'paid' ? 'NOW()' : 'NULL';
    await pool.query(
      `UPDATE invoices SET status = $2, paid_at = ${paidAt}
       WHERE id = $1 AND tenant_id = $3`,
      [req.params.id, status, req.auth.institution_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[billing]', err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

module.exports = router;
