/**
 * AI safety controls — content filtering, anti-cheating, prompt injection protection.
 * PRD sections 25, 50, 51, 113
 */

const SAFETY_KEYWORDS = [
  'kill myself', 'want to die', 'suicide', 'self-harm', 'self harm',
  'hurt myself', 'end my life', 'don\'t want to live',
];

const ESCALATION_RESPONSE = `I'm concerned about what you've shared. Please talk to a trusted adult — a teacher, counselor, or family member — right away.

If you need immediate help:
- Talk to your school counselor
- Call a helpline: iCall (9152987821) or Vandrevala Foundation (1860 2662 345)
- Reach out to someone you trust

You matter, and there are people who want to help.`;

function detectSafetyRisk(text) {
  const lower = (text || '').toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}

function sanitizeInput(text, maxLength = 4000) {
  if (!text) return '';
  let clean = String(text).slice(0, maxLength);
  // Strip potential prompt injection patterns
  clean = clean.replace(/\b(system|assistant|ignore previous|disregard|forget)(\s+)(instructions?|prompt|rules?|everything)/gi, '[filtered]');
  return clean;
}

function validateStructuredOutput(data, schema) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not a valid object' };
  }

  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
  }

  return { valid: true };
}

function isAntiCheatActive(examConfig) {
  if (!examConfig) return false;
  return examConfig.closedBook === true || examConfig.antiCheat === true;
}

function filterForRole(role, data) {
  const sensitive = ['password', 'password_hash', 'jwt', 'token', 'api_key', 'secret'];
  if (!data || typeof data !== 'object') return data;

  const filtered = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(filtered)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      delete filtered[key];
    }
  }
  return filtered;
}

module.exports = {
  detectSafetyRisk,
  sanitizeInput,
  validateStructuredOutput,
  isAntiCheatActive,
  filterForRole,
  ESCALATION_RESPONSE,
};
