/**
 * Insert an audit_log row from a REST handler (which runs as the superuser
 * pool, so JWT-claim-based log_audit() won't work here — we pass values
 * explicitly from req.auth).
 */
async function logAudit(pool, auth, { action, entityType = null, entityId = null, metadata = null }) {
  if (!auth?.institution_id) return;
  try {
    await pool.query(
      `INSERT INTO audit_log (institution_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [auth.institution_id, auth.user_id || null, action, entityType, entityId, metadata]
    );
  } catch (err) {
    // Audit failures must never break the primary action.
    console.error('[audit] failed to write log:', err.message);
  }
}

module.exports = { logAudit };
