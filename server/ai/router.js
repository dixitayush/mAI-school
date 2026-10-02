/**
 * AI Model Router — routes requests to the appropriate model tier.
 * PRD sections 19.2, 48, 94
 *
 * Tiers:
 * - FAST: summaries, classification, extraction, simple drafts
 * - STANDARD: teacher copilot, student tutor, general drafting
 * - REASONING: complex reports, difficult academic reasoning
 */

const { OpenAIProvider } = require('./provider');
const { getAppPool } = require('../db/pool');

const provider = new OpenAIProvider();

const MODELS = {
  fast: process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  standard: process.env.OPENAI_MODEL || 'gpt-4o',
  reasoning: process.env.OPENAI_REASONING_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
};

const FEATURE_TIERS = {
  'classification': 'fast',
  'summary': 'fast',
  'extraction': 'fast',
  'email.draft': 'fast',
  'announcement.draft': 'fast',
  'lesson.plan': 'standard',
  'worksheet.generate': 'standard',
  'question.generate': 'standard',
  'rubric.generate': 'standard',
  'tutor.chat': 'standard',
  'chatbot': 'standard',
  'feedback.draft': 'standard',
  'rubric.generate': 'standard',
  'attendance.ocr': 'standard',
  'study.plan': 'standard',
  'flashcard.generate': 'fast',
  'learning.plan': 'standard',
  'parent.digest': 'fast',
  'principal.brief': 'reasoning',
  'principal.report': 'reasoning',
  'weekly.report': 'reasoning',
  'report.analysis': 'reasoning',
  'intervention.plan': 'reasoning',
};

/**
 * USD per 1M tokens, keyed by model prefix (longest match wins).
 * Used only to populate ai_requests.estimated_cost so the governance screen
 * can show spend; keep in sync with the provider's price list.
 */
const MODEL_PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'o4-mini': { input: 1.10, output: 4.40 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
};
const DEFAULT_PRICING = { input: 2.50, output: 10.00 };

function priceFor(model) {
  if (!model) return DEFAULT_PRICING;
  const name = String(model).toLowerCase();
  let best = null;
  for (const key of Object.keys(MODEL_PRICING)) {
    if (name.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  return best ? MODEL_PRICING[best] : DEFAULT_PRICING;
}

/** Cost in whole USD (not cents) for a request's token counts. */
function estimateCost(model, inputTokens = 0, outputTokens = 0) {
  const p = priceFor(model);
  const cost = ((inputTokens || 0) * p.input + (outputTokens || 0) * p.output) / 1e6;
  return Number(cost.toFixed(6));
}

function getTier(feature) {
  return FEATURE_TIERS[feature] || 'standard';
}

function getModel(tier) {
  return MODELS[tier] || MODELS.standard;
}

function isConfigured() {
  return provider.isConfigured();
}

async function checkQuota(tenantId, userId) {
  const pool = getAppPool();
  const dailyTenantLimit = Number(process.env.AI_DAILY_TENANT_LIMIT) || 1000;
  const dailyUserLimit = Number(process.env.AI_DAILY_USER_LIMIT) || 100;

  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE tenant_id = $1)::int AS tenant_count,
       count(*) FILTER (WHERE user_id = $2)::int AS user_count
     FROM ai_requests
     WHERE created_at >= CURRENT_DATE
       AND (tenant_id = $1 OR user_id = $2)`,
    [tenantId, userId]
  );

  const { tenant_count, user_count } = rows[0];

  if (tenant_count >= dailyTenantLimit) {
    return { allowed: false, reason: 'Daily AI limit reached for your school' };
  }
  if (user_count >= dailyUserLimit) {
    return { allowed: false, reason: 'Daily AI limit reached for your account' };
  }
  return { allowed: true };
}

async function logRequest({ tenantId, userId, feature, tier, model, result, startMs, error, reservationId }) {
  const pool = getAppPool();
  const latencyMs = Date.now() - startMs;
  const inputTokens = result?.inputTokens || 0;
  const outputTokens = result?.outputTokens || 0;

  try {
    // A reserved attempt (student allowance) already has its row: finalise it.
    if (reservationId) {
      await pool.query(
        `UPDATE ai_requests
            SET model = $2, tier = $3, input_tokens = $4, output_tokens = $5, latency_ms = $6,
                status = $7, estimated_cost = $8, error_message = $9
          WHERE id = $1`,
        [
          reservationId, model, tier, inputTokens, outputTokens, latencyMs,
          error ? 'error' : 'success',
          estimateCost(result?.model || model, inputTokens, outputTokens),
          error ? String(error).slice(0, 500) : null,
        ]
      );
      return;
    }
    await pool.query(
      `INSERT INTO ai_requests
         (tenant_id, user_id, feature, model, tier, input_tokens, output_tokens,
          latency_ms, status, estimated_cost, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        tenantId,
        userId,
        feature,
        model,
        tier,
        inputTokens,
        outputTokens,
        latencyMs,
        error ? 'error' : 'success',
        estimateCost(result?.model || model, inputTokens, outputTokens),
        error ? String(error).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error('[ai-router] Failed to log request:', err.message);
  }
}

/**
 * `reservationId` — an attempt already reserved against a student's daily
 * allowance (ai/studentQuota.js); its row is finalised instead of a new one
 * being logged, and any failure marks it as an error so it is not counted.
 */
async function generate({ feature, messages, tenantId, userId, temperature, maxTokens, tierOverride, reservationId }) {
  const tier = tierOverride || getTier(feature);
  const model = getModel(tier);
  const startMs = Date.now();

  const quota = await checkQuota(tenantId, userId);
  if (!quota.allowed) {
    if (reservationId) {
      await logRequest({ tenantId, userId, feature, tier, model, result: null, startMs, error: quota.reason, reservationId });
    }
    throw Object.assign(new Error(quota.reason), { code: 'AI_QUOTA_EXCEEDED' });
  }

  try {
    const result = await provider.generateText({ model, messages, temperature, maxTokens });
    await logRequest({ tenantId, userId, feature, tier, model, result, startMs, reservationId });
    return { ...result, tier, model };
  } catch (err) {
    await logRequest({ tenantId, userId, feature, tier, model, result: null, startMs, error: err.message, reservationId });
    throw err;
  }
}

async function generateStructured({ feature, messages, schema, tenantId, userId, temperature, maxTokens }) {
  const tier = getTier(feature);
  const model = getModel(tier);
  const startMs = Date.now();

  const quota = await checkQuota(tenantId, userId);
  if (!quota.allowed) {
    throw Object.assign(new Error(quota.reason), { code: 'AI_QUOTA_EXCEEDED' });
  }

  try {
    const result = await provider.generateStructured({ model, messages, schema, temperature, maxTokens });
    await logRequest({ tenantId, userId, feature, tier, model, result, startMs });
    return { ...result, tier, model };
  } catch (err) {
    await logRequest({ tenantId, userId, feature, tier, model, result: null, startMs, error: err.message });
    throw err;
  }
}

async function stream({ feature, messages, tenantId, userId, temperature, maxTokens }) {
  const tier = getTier(feature);
  const model = getModel(tier);

  const quota = await checkQuota(tenantId, userId);
  if (!quota.allowed) {
    throw Object.assign(new Error(quota.reason), { code: 'AI_QUOTA_EXCEEDED' });
  }

  return provider.streamText({ model, messages, temperature, maxTokens });
}

/**
 * Usage/cost rollup for the AI governance screen.
 *
 * The dashboard needs headline totals, a per-feature breakdown and a daily
 * series, so this returns one object rather than the raw GROUP BY rows the
 * earlier version handed back (which rendered as all-zero tiles).
 * `estimated_cost` is stored in whole currency units, so costs come back as
 * such — the caller must not divide by 100.
 */
async function getUsageStats(tenantId, days = 30) {
  const pool = getAppPool();
  const window = String(days);

  const [totalsRes, featureRes, tierRes, dailyRes] = await Promise.all([
    pool.query(
      `SELECT
         count(*)::int AS total_requests,
         COALESCE(sum(input_tokens), 0)::int AS total_input_tokens,
         COALESCE(sum(output_tokens), 0)::int AS total_output_tokens,
         COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)::int AS total_tokens,
         COALESCE(sum(estimated_cost), 0)::float AS total_cost,
         count(*) FILTER (WHERE status = 'error')::int AS errors,
         count(*) FILTER (WHERE status = 'timeout')::int AS timeouts,
         COALESCE(round(avg(latency_ms))::int, 0) AS avg_latency_ms
       FROM ai_requests
       WHERE tenant_id = $1
         AND created_at >= CURRENT_DATE - ($2 || ' days')::interval`,
      [tenantId, window]
    ),
    pool.query(
      `SELECT feature,
              count(*)::int AS count,
              COALESCE(sum(estimated_cost), 0)::float AS cost,
              COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)::int AS tokens,
              count(*) FILTER (WHERE status = 'error')::int AS errors
         FROM ai_requests
        WHERE tenant_id = $1
          AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
        GROUP BY feature
        ORDER BY count DESC`,
      [tenantId, window]
    ),
    pool.query(
      `SELECT COALESCE(tier, 'unknown') AS tier,
              count(*)::int AS count,
              COALESCE(sum(estimated_cost), 0)::float AS cost
         FROM ai_requests
        WHERE tenant_id = $1
          AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
        GROUP BY tier
        ORDER BY count DESC`,
      [tenantId, window]
    ),
    pool.query(
      `SELECT created_at::date AS date,
              count(*)::int AS requests,
              COALESCE(sum(estimated_cost), 0)::float AS cost,
              COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)::int AS tokens
         FROM ai_requests
        WHERE tenant_id = $1
          AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
        GROUP BY created_at::date
        ORDER BY date DESC`,
      [tenantId, window]
    ),
  ]);

  const totals = totalsRes.rows[0] || {};
  const by_feature = {};
  for (const r of featureRes.rows) {
    by_feature[r.feature] = {
      count: r.count,
      cost: r.cost,
      tokens: r.tokens,
      errors: r.errors,
    };
  }

  return {
    total_requests: totals.total_requests || 0,
    total_input_tokens: totals.total_input_tokens || 0,
    total_output_tokens: totals.total_output_tokens || 0,
    total_tokens: totals.total_tokens || 0,
    total_cost: totals.total_cost || 0,
    errors: totals.errors || 0,
    timeouts: totals.timeouts || 0,
    avg_latency_ms: totals.avg_latency_ms || 0,
    by_feature,
    by_tier: tierRes.rows,
    daily: dailyRes.rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      requests: r.requests,
      cost: r.cost,
      tokens: r.tokens,
    })),
    features: featureRes.rows,
  };
}

module.exports = {
  generate,
  generateStructured,
  stream,
  isConfigured,
  checkQuota,
  getUsageStats,
  estimateCost,
  MODEL_PRICING,
  getTier,
  getModel,
  MODELS,
};
