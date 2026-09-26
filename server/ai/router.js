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

async function logRequest({ tenantId, userId, feature, tier, model, result, startMs, error }) {
  const pool = getAppPool();
  const latencyMs = Date.now() - startMs;

  try {
    await pool.query(
      `INSERT INTO ai_requests
         (tenant_id, user_id, feature, model, tier, input_tokens, output_tokens, latency_ms, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId,
        userId,
        feature,
        model,
        tier,
        result?.inputTokens || 0,
        result?.outputTokens || 0,
        latencyMs,
        error ? 'error' : 'success',
        error ? String(error).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error('[ai-router] Failed to log request:', err.message);
  }
}

async function generate({ feature, messages, tenantId, userId, temperature, maxTokens, tierOverride }) {
  const tier = tierOverride || getTier(feature);
  const model = getModel(tier);
  const startMs = Date.now();

  const quota = await checkQuota(tenantId, userId);
  if (!quota.allowed) {
    throw Object.assign(new Error(quota.reason), { code: 'AI_QUOTA_EXCEEDED' });
  }

  try {
    const result = await provider.generateText({ model, messages, temperature, maxTokens });
    await logRequest({ tenantId, userId, feature, tier, model, result, startMs });
    return { ...result, tier, model };
  } catch (err) {
    await logRequest({ tenantId, userId, feature, tier, model, result: null, startMs, error: err.message });
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

async function getUsageStats(tenantId, days = 30) {
  const pool = getAppPool();
  const { rows } = await pool.query(
    `SELECT
       count(*)::int AS total_requests,
       sum(input_tokens)::int AS total_input_tokens,
       sum(output_tokens)::int AS total_output_tokens,
       count(*) FILTER (WHERE status = 'error')::int AS errors,
       feature,
       tier
     FROM ai_requests
     WHERE tenant_id = $1
       AND created_at >= CURRENT_DATE - ($2 || ' days')::interval
     GROUP BY feature, tier
     ORDER BY total_requests DESC`,
    [tenantId, String(days)]
  );
  return rows;
}

module.exports = {
  generate,
  generateStructured,
  stream,
  isConfigured,
  checkQuota,
  getUsageStats,
  getTier,
  getModel,
  MODELS,
};
