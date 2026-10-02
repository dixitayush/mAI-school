/**
 * Daily AI allowance for students.
 *
 * Each school sets how many AI answers a student may get per day (5–10,
 * institution_settings.student_ai_daily_limit). AI Tutor and Study Planner
 * draw from the same allowance, which resets at midnight in the school's time
 * zone. Only answers count: a failed generation does not use up an attempt.
 *
 * Concurrency: an attempt is reserved (a 'pending' ai_requests row) under a
 * per-student advisory lock before the model is called, so firing several
 * requests at once cannot overshoot the limit. A reservation that never
 * resolves stops counting after a few minutes.
 */

const { getAppPool } = require('../db/pool');

const STUDENT_AI_FEATURES = ['tutor.chat', 'study.plan'];
const LIMIT_MIN = 5;
const LIMIT_MAX = 10;
const DEFAULT_LIMIT = 5;
const DEFAULT_TZ = 'Asia/Kolkata';

// Counts an answer, or an in-flight attempt that is recent enough to still be running.
const COUNTED = `
  user_id = $1
  AND feature = ANY($2::text[])
  AND created_at >= $3
  AND (status = 'success' OR (status = 'pending' AND created_at > now() - interval '5 minutes'))`;

/** Limit, time zone and today's window (in the school's zone) for an institution. */
async function loadWindow(db, institutionId) {
  const { rows } = await db.query(
    `WITH cfg AS (
       SELECT COALESCE(s.student_ai_daily_limit, $2) AS daily_limit,
              CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = i.timezone)
                   THEN i.timezone ELSE $3 END AS tz
         FROM institutions i
         LEFT JOIN institution_settings s ON s.institution_id = i.id
        WHERE i.id = $1
     )
     SELECT daily_limit, tz,
            date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz AS day_start,
            (date_trunc('day', now() AT TIME ZONE tz) + interval '1 day') AT TIME ZONE tz AS resets_at
       FROM cfg`,
    [institutionId, DEFAULT_LIMIT, DEFAULT_TZ]
  );
  if (!rows[0]) throw new Error('Institution not found');
  return rows[0];
}

function shape(win, used) {
  const limit = Number(win.daily_limit);
  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.max(limit - used, 0),
    resets_at: new Date(win.resets_at).toISOString(),
    timezone: win.tz,
  };
}

/** Today's allowance for a student. */
async function getStudentUsage(institutionId, userId, db = getAppPool()) {
  const win = await loadWindow(db, institutionId);
  const { rows } = await db.query(
    `SELECT count(*)::int AS used FROM ai_requests WHERE ${COUNTED}`,
    [userId, STUDENT_AI_FEATURES, win.day_start]
  );
  return shape(win, rows[0].used);
}

/**
 * Reserve one attempt, or throw AI_QUOTA_EXCEEDED (with `usage`) when the day's
 * allowance is spent. Returns the reservation id to hand to ai.generate().
 */
async function reserveStudentAttempt({ institutionId, userId, feature }) {
  const client = await getAppPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`student-ai:${userId}`]);
    const usage = await getStudentUsage(institutionId, userId, client);
    if (usage.remaining <= 0) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error(`You have used all ${usage.limit} AI attempts for today. They reset at midnight.`),
        { code: 'AI_QUOTA_EXCEEDED', usage }
      );
    }
    const { rows } = await client.query(
      `INSERT INTO ai_requests (tenant_id, user_id, feature, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [institutionId, userId, feature]
    );
    await client.query('COMMIT');
    return rows[0].id;
  } catch (err) {
    if (err.code !== 'AI_QUOTA_EXCEEDED') await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** The school's configured limit, for the admin screen. */
async function getStudentLimit(institutionId) {
  const win = await loadWindow(getAppPool(), institutionId);
  return { limit: Number(win.daily_limit), min: LIMIT_MIN, max: LIMIT_MAX, timezone: win.tz };
}

async function setStudentLimit(institutionId, limit) {
  const n = Number(limit);
  if (!Number.isInteger(n) || n < LIMIT_MIN || n > LIMIT_MAX) {
    throw Object.assign(new Error(`Limit must be a whole number from ${LIMIT_MIN} to ${LIMIT_MAX}`), { status: 400 });
  }
  await getAppPool().query(
    `INSERT INTO institution_settings (institution_id, student_ai_daily_limit)
     VALUES ($1, $2)
     ON CONFLICT (institution_id) DO UPDATE SET student_ai_daily_limit = EXCLUDED.student_ai_daily_limit,
                                               updated_at = now()`,
    [institutionId, n]
  );
  return getStudentLimit(institutionId);
}

module.exports = {
  STUDENT_AI_FEATURES,
  LIMIT_MIN,
  LIMIT_MAX,
  getStudentUsage,
  reserveStudentAttempt,
  getStudentLimit,
  setStudentLimit,
};
