/**
 * Workflow automation engine.
 * PRD sections 18, 37.
 *
 * A workflow pairs a trigger (a query over tenant data) with a list of actions.
 * Running one evaluates the trigger, then applies each action to every match
 * and records what happened on `workflow_executions.actions_taken`, so the
 * admin screen can show real results instead of an empty "completed" row.
 */

const { getAppPool } = require('../db/pool');
const notificationService = require('./notificationService');

const pool = getAppPool();

/**
 * Trigger evaluators. Each returns `{ subject, detail }` rows — `subject` is a
 * human label and `detail` carries the ids actions need.
 */
const TRIGGERS = {
  async attendance_below(institutionId, config) {
    const threshold = Number(config.threshold) || 75;
    const days = Number(config.days) || 30;
    const { rows } = await pool.query(
      `SELECT s.id AS student_id, u.full_name, u.id AS student_user_id, c.teacher_id,
              round(100.0 * count(*) FILTER (WHERE a.status = 'present') / count(*), 1) AS attendance_pct,
              count(*)::int AS marked_days
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE u.institution_id = $1 AND a.date >= CURRENT_DATE - $2::int
        GROUP BY s.id, u.full_name, u.id, c.teacher_id
       HAVING count(*) > 0
          AND round(100.0 * count(*) FILTER (WHERE a.status = 'present') / count(*), 1) < $3
        ORDER BY attendance_pct ASC`,
      [institutionId, days, threshold]
    );
    return rows.map((r) => ({
      subject: r.full_name,
      detail: {
        student_id: r.student_id,
        student_user_id: r.student_user_id,
        teacher_id: r.teacher_id,
        attendance_pct: Number(r.attendance_pct),
        marked_days: r.marked_days,
        threshold,
      },
    }));
  },

  async fee_overdue(institutionId, config) {
    const daysOverdue = Number(config.days_overdue) || 7;
    const { rows } = await pool.query(
      `SELECT f.id AS fee_id, f.amount, f.paid_amount, f.due_date, f.invoice_number,
              s.id AS student_id, u.full_name, u.id AS student_user_id,
              (CURRENT_DATE - f.due_date)::int AS days_late
         FROM fees f
         JOIN students s ON s.id = f.student_id
         JOIN users u ON u.id = s.user_id
        WHERE f.institution_id = $1
          AND f.status <> 'paid'
          AND f.due_date < CURRENT_DATE - $2::int
        ORDER BY f.due_date ASC`,
      [institutionId, daysOverdue]
    );
    return rows.map((r) => ({
      subject: `${r.full_name} — ${r.invoice_number || 'invoice'}`,
      detail: {
        fee_id: r.fee_id,
        student_id: r.student_id,
        student_user_id: r.student_user_id,
        amount: Number(r.amount) - Number(r.paid_amount || 0),
        days_late: r.days_late,
      },
    }));
  },

  async new_admission(institutionId, config) {
    const days = Number(config.days) || 30;
    const statuses = Array.isArray(config.statuses) && config.statuses.length > 0
      ? config.statuses
      : ['selected', 'fee_pending', 'enrolled'];
    const { rows } = await pool.query(
      `SELECT a.id AS application_id, a.applicant_name, a.status, a.applied_at,
              a.guardian_email, a.converted_student_id
         FROM admissions a
        WHERE a.institution_id = $1
          AND a.status = ANY($3::text[])
          AND a.applied_at >= NOW() - ($2 || ' days')::interval
        ORDER BY a.applied_at DESC`,
      [institutionId, String(days), statuses]
    );
    return rows.map((r) => ({
      subject: r.applicant_name,
      detail: {
        application_id: r.application_id,
        status: r.status,
        student_id: r.converted_student_id,
        guardian_email: r.guardian_email,
      },
    }));
  },

  async assignment_overdue(institutionId) {
    const { rows } = await pool.query(
      `SELECT a.id AS assignment_id, a.title, a.due_date, a.teacher_id,
              s.id AS student_id, u.full_name, u.id AS student_user_id
         FROM assignments a
         JOIN students s ON s.class_id = a.class_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN assignment_submissions sub
                ON sub.assignment_id = a.id AND sub.student_id = s.id
        WHERE a.institution_id = $1
          AND a.due_date < CURRENT_DATE
          AND sub.id IS NULL
        ORDER BY a.due_date ASC`,
      [institutionId]
    );
    return rows.map((r) => ({
      subject: `${r.full_name} — ${r.title}`,
      detail: {
        assignment_id: r.assignment_id,
        student_id: r.student_id,
        student_user_id: r.student_user_id,
        teacher_id: r.teacher_id,
        title: r.title,
      },
    }));
  },

  async absent_consecutive(institutionId, config) {
    const streak = Number(config.days) || 3;
    const { rows } = await pool.query(
      `WITH recent AS (
         SELECT a.student_id, a.date, a.status,
                row_number() OVER (PARTITION BY a.student_id ORDER BY a.date DESC) AS rn
           FROM attendance a
           JOIN students s ON s.id = a.student_id
           JOIN users u ON u.id = s.user_id
          WHERE u.institution_id = $1
       )
       SELECT r.student_id, u.full_name, u.id AS student_user_id, c.teacher_id
         FROM recent r
         JOIN students s ON s.id = r.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE r.rn <= $2
        GROUP BY r.student_id, u.full_name, u.id, c.teacher_id
       HAVING count(*) = $2 AND count(*) FILTER (WHERE r.status = 'absent') = $2`,
      [institutionId, streak]
    );
    return rows.map((r) => ({
      subject: r.full_name,
      detail: {
        student_id: r.student_id,
        student_user_id: r.student_user_id,
        teacher_id: r.teacher_id,
        consecutive_absences: streak,
      },
    }));
  },

  async document_expired(institutionId, config) {
    const withinDays = Number(config.within_days) || 30;
    const { rows } = await pool.query(
      `SELECT d.id AS document_id, d.title, d.expires_at, d.owner_type, d.owner_id
         FROM documents d
        WHERE d.institution_id = $1
          AND d.expires_at IS NOT NULL
          AND d.expires_at <= CURRENT_DATE + $2::int
        ORDER BY d.expires_at ASC`,
      [institutionId, withinDays]
    );
    return rows.map((r) => ({
      subject: r.title,
      detail: { document_id: r.document_id, expires_at: r.expires_at },
    }));
  },

  async result_published(institutionId, config) {
    const days = Number(config.days) || 7;
    const { rows } = await pool.query(
      `SELECT e.id AS exam_id, e.title, e.subject, e.exam_date, c.name AS class_name,
              count(r.id)::int AS result_count
         FROM exams e
         JOIN classes c ON c.id = e.class_id
         LEFT JOIN results r ON r.exam_id = e.id
        WHERE c.institution_id = $1
          AND e.exam_date >= CURRENT_DATE - $2::int
        GROUP BY e.id, e.title, e.subject, e.exam_date, c.name
       HAVING count(r.id) > 0
        ORDER BY e.exam_date DESC`,
      [institutionId, days]
    );
    return rows.map((r) => ({
      subject: `${r.title} (${r.class_name})`,
      detail: { exam_id: r.exam_id, result_count: r.result_count },
    }));
  },

  async new_teacher(institutionId, config) {
    const days = Number(config.days) || 30;
    const { rows } = await pool.query(
      `SELECT t.id AS teacher_id, u.id AS teacher_user_id, u.full_name, t.joining_date
         FROM teachers t
         JOIN users u ON u.id = t.user_id
        WHERE u.institution_id = $1 AND t.joining_date >= CURRENT_DATE - $2::int
        ORDER BY t.joining_date DESC`,
      [institutionId, days]
    );
    return rows.map((r) => ({
      subject: r.full_name,
      detail: { teacher_id: r.teacher_id, teacher_user_id: r.teacher_user_id },
    }));
  },

  /** Guardians who have never signed in — users has no last_login column, so
   *  "never had a session" is the signal. */
  async parent_invite_pending(institutionId) {
    const { rows } = await pool.query(
      `SELECT g.id AS guardian_id, u.id AS parent_user_id, u.full_name
         FROM guardians g
         JOIN users u ON u.id = g.user_id
        WHERE g.institution_id = $1
          AND NOT EXISTS (SELECT 1 FROM user_sessions s WHERE s.user_id = u.id)
        ORDER BY u.full_name`,
      [institutionId]
    );
    return rows.map((r) => ({
      subject: r.full_name,
      detail: { guardian_id: r.guardian_id, parent_user_id: r.parent_user_id },
    }));
  },

  /** `custom` has no query — it fires once on whatever payload was passed in. */
  async custom(_institutionId, _config, triggerData) {
    return [{ subject: 'Manual run', detail: triggerData || {} }];
  },
};

/** Who an action should reach, resolved to user ids inside the tenant. */
async function resolveRecipients(institutionId, target, detail) {
  switch (target) {
    case 'student':
      return detail.student_user_id ? [detail.student_user_id] : [];
    case 'teacher':
      return detail.teacher_id ? [detail.teacher_id] : [];
    case 'parent': {
      if (!detail.student_id) return [];
      const { rows } = await pool.query(
        `SELECT g.user_id FROM student_guardian sg
           JOIN guardians g ON g.id = sg.guardian_id
          WHERE sg.student_id = $1 AND g.institution_id = $2`,
        [detail.student_id, institutionId]
      );
      return rows.map((r) => r.user_id);
    }
    case 'admin':
    case 'principal': {
      const { rows } = await pool.query(
        `SELECT id FROM users WHERE institution_id = $1 AND role = $2 AND login_enabled`,
        [institutionId, target]
      );
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}

function renderMessage(workflow, match) {
  const bits = Object.entries(match.detail)
    .filter(([k, v]) => !k.endsWith('_id') && v !== null && v !== undefined)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  return `${match.subject}${bits.length ? ` — ${bits.join(', ')}` : ''}`;
}

/**
 * Apply one action to one match. Only side effects the app can actually carry
 * out are performed; anything else is recorded as skipped rather than silently
 * reported as done.
 */
async function applyAction(workflow, action, match) {
  const institutionId = workflow.institution_id;
  const type = action.type;

  if (type === 'notify' || type === 'email') {
    const recipients = await resolveRecipients(institutionId, action.target || 'admin', match.detail);
    if (recipients.length === 0) {
      return { type, target: action.target, status: 'skipped', reason: 'no recipient resolved' };
    }
    const title = action.title || workflow.name;
    const body = action.body || renderMessage(workflow, match);
    for (const recipientId of recipients) {
      await notificationService.createNotification({
        tenantId: institutionId,
        recipientId,
        type: `workflow.${workflow.trigger_type}`,
        title,
        body,
        entityType: 'workflow',
        entityId: workflow.id,
      });
    }
    return { type, target: action.target, status: 'done', recipients: recipients.length, subject: match.subject };
  }

  if (type === 'create_intervention' && match.detail.student_id) {
    const { rows } = await pool.query(
      `INSERT INTO interventions
         (institution_id, student_id, concern_type, title, description, status, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
       RETURNING id`,
      [
        institutionId,
        match.detail.student_id,
        action.concern_type || 'attendance',
        action.title || `${workflow.name}: ${match.subject}`,
        renderMessage(workflow, match),
        action.priority || 'medium',
        workflow.created_by,
      ]
    );
    return { type, status: 'done', intervention_id: rows[0].id, subject: match.subject };
  }

  if (type === 'flag_signal' && match.detail.student_id) {
    const { rows } = await pool.query(
      `INSERT INTO support_signals (institution_id, student_id, signal_type, severity, data)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        institutionId,
        match.detail.student_id,
        action.signal_type || 'teacher_flagged',
        action.severity || 'medium',
        JSON.stringify(match.detail),
      ]
    );
    return { type, status: 'done', signal_id: rows[0].id, subject: match.subject };
  }

  return { type, status: 'skipped', reason: `unsupported action type "${type}"`, subject: match.subject };
}

/**
 * Run a workflow once. `limit` caps how many matches are acted on so a manual
 * run on a large tenant cannot flood the notification table.
 */
async function runWorkflow({ workflow_id, institution_id, trigger_data = {}, limit = 50 }) {
  const wfRes = await pool.query(
    'SELECT * FROM workflows WHERE id = $1 AND institution_id = $2',
    [workflow_id, institution_id]
  );
  const workflow = wfRes.rows[0];
  if (!workflow) throw new Error(`Workflow ${workflow_id} not found`);

  const execRes = await pool.query(
    `INSERT INTO workflow_executions (workflow_id, trigger_data, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [workflow_id, JSON.stringify(trigger_data)]
  );
  const executionId = execRes.rows[0].id;

  try {
    const evaluate = TRIGGERS[workflow.trigger_type];
    if (!evaluate) throw new Error(`No evaluator for trigger "${workflow.trigger_type}"`);

    const config = workflow.trigger_config || {};
    const matches = (await evaluate(institution_id, config, trigger_data)).slice(0, limit);
    const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
    const actionsTaken = [];

    for (const match of matches) {
      for (const action of actions) {
        try {
          actionsTaken.push(await applyAction(workflow, action, match));
        } catch (err) {
          actionsTaken.push({
            type: action.type,
            status: 'failed',
            subject: match.subject,
            reason: String(err.message || err).slice(0, 200),
          });
        }
      }
    }

    const status = matches.length === 0 ? 'skipped' : 'completed';
    await pool.query(
      `UPDATE workflow_executions
          SET status = $2, actions_taken = $3, completed_at = NOW()
        WHERE id = $1`,
      [executionId, status, JSON.stringify({ matched: matches.length, actions: actionsTaken.slice(0, 200) })]
    );
    await pool.query('UPDATE workflows SET last_run_at = NOW() WHERE id = $1', [workflow_id]);

    return { execution_id: executionId, status, matched: matches.length, actions: actionsTaken };
  } catch (err) {
    await pool.query(
      `UPDATE workflow_executions SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1`,
      [executionId, String(err.message || err).slice(0, 2000)]
    );
    throw err;
  }
}

module.exports = { runWorkflow, TRIGGERS: Object.keys(TRIGGERS) };
