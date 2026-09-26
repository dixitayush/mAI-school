/**
 * Insert an audit_log row from a REST handler.
 * Enhanced with IP address and user agent tracking (PRD sections 9-10).
 */
async function logAudit(pool, auth, {
  action,
  entityType = null,
  entityId = null,
  metadata = null,
  severity = 'info',
  req = null,
}) {
  if (!auth?.institution_id && auth?.role !== 'mai_admin') return;
  try {
    await pool.query(
      `INSERT INTO audit_log
         (institution_id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        auth.institution_id || null,
        auth.user_id || null,
        action,
        entityType,
        entityId,
        metadata ? JSON.stringify(metadata) : null,
        req?.ip || null,
        req?.get?.('user-agent') || null,
        severity,
      ]
    );
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

function auditMiddleware(action, { entityType, severity = 'info' } = {}) {
  return (req, _res, next) => {
    req._auditAction = action;
    req._auditEntityType = entityType;
    req._auditSeverity = severity;
    next();
  };
}

module.exports = { logAudit, auditMiddleware };
