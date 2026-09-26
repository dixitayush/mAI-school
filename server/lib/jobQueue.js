/**
 * PostgreSQL-backed background job queue.
 * Uses SELECT FOR UPDATE SKIP LOCKED for reliable, concurrent job processing.
 */

const { getAppPool } = require('../db/pool');

const handlers = new Map();
let running = false;
let pollTimer = null;
const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS) || 5000;
const CONCURRENCY = Number(process.env.JOB_CONCURRENCY) || 3;
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

function registerHandler(type, fn) {
  handlers.set(type, fn);
}

async function enqueue(type, payload = {}, options = {}) {
  const pool = getAppPool();
  const {
    tenantId = null,
    priority = 0,
    maxAttempts = 3,
    runAt = new Date(),
  } = options;

  const { rows } = await pool.query(
    `INSERT INTO jobs (tenant_id, type, payload, priority, max_attempts, run_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [tenantId, type, JSON.stringify(payload), priority, maxAttempts, runAt]
  );
  return rows[0].id;
}

async function dequeue(limit = 1) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `UPDATE jobs
     SET status = 'running', locked_at = NOW(), locked_by = $1, attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM jobs
       WHERE status = 'pending' AND run_at <= NOW()
       ORDER BY priority DESC, run_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [WORKER_ID, limit]
  );
  return rows;
}

async function completeJob(jobId, result = null) {
  const pool = getAppPool();
  await pool.query(
    `UPDATE jobs SET status = 'completed', completed_at = NOW(), result = $2
     WHERE id = $1`,
    [jobId, result ? JSON.stringify(result) : null]
  );
}

async function failJob(jobId, error) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `SELECT attempts, max_attempts FROM jobs WHERE id = $1`,
    [jobId]
  );
  const job = rows[0];
  if (!job) return;

  if (job.attempts >= job.max_attempts) {
    await pool.query(
      `UPDATE jobs SET status = 'dead', last_error = $2, completed_at = NOW()
       WHERE id = $1`,
      [jobId, String(error).slice(0, 2000)]
    );
  } else {
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, job.attempts));
    await pool.query(
      `UPDATE jobs SET status = 'pending', locked_at = NULL, locked_by = NULL,
         last_error = $2, run_at = NOW() + ($3 || ' milliseconds')::interval
       WHERE id = $1`,
      [jobId, String(error).slice(0, 2000), String(backoffMs)]
    );
  }
}

async function processJobs() {
  const jobs = await dequeue(CONCURRENCY);
  if (jobs.length === 0) return;

  await Promise.all(jobs.map(async (job) => {
    const handler = handlers.get(job.type);
    if (!handler) {
      console.error(`[jobs] No handler for type: ${job.type}`);
      await failJob(job.id, `No handler registered for type: ${job.type}`);
      return;
    }
    try {
      const result = await handler(job.payload, job);
      await completeJob(job.id, result);
    } catch (err) {
      console.error(`[jobs] Job ${job.id} (${job.type}) failed:`, err.message);
      await failJob(job.id, err.message);
    }
  }));
}

function start() {
  if (running) return;
  running = true;
  console.log(`[jobs] Worker ${WORKER_ID} started (concurrency=${CONCURRENCY}, poll=${POLL_INTERVAL_MS}ms)`);

  async function tick() {
    if (!running) return;
    try {
      await processJobs();
    } catch (err) {
      console.error('[jobs] Poll error:', err.message);
    }
    pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
  }
  tick();
}

function stop() {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log('[jobs] Worker stopped');
}

async function getJobStats(tenantId) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `SELECT status, count(*)::int AS count
     FROM jobs
     WHERE ($1::uuid IS NULL OR tenant_id = $1)
     GROUP BY status`,
    [tenantId || null]
  );
  return rows;
}

module.exports = {
  registerHandler,
  enqueue,
  start,
  stop,
  getJobStats,
};
