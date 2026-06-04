/**
 * Google Gemini integration (Vision + chat) used by the AI attendance OCR
 * (Feature 1) and the school chatbot (Feature 8).
 *
 * Requires GEMINI_API_KEY in the environment. All functions throw a clear
 * error if the key is missing so callers can return a friendly 503.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function ensureKey() {
  if (!GEMINI_API_KEY) {
    const e = new Error('GEMINI_API_KEY is not configured on the server');
    e.code = 'GEMINI_NOT_CONFIGURED';
    throw e;
  }
}

function isConfigured() {
  return Boolean(GEMINI_API_KEY);
}

async function callGemini(body) {
  ensureKey();
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${BASE_URL}/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

/** Strip ```json fences and parse, tolerating extra prose around the JSON. */
function parseJsonLoose(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const startArr = t.indexOf('[');
  const begin =
    start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (begin > 0) t = t.slice(begin);
  const lastObj = t.lastIndexOf('}');
  const lastArr = t.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end !== -1) t = t.slice(0, end + 1);
  return JSON.parse(t);
}

/**
 * Extract attendance rows from a handwritten register image/PDF.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType  image/jpeg | image/png | application/pdf
 * @param {Array<{roll_number?:string,name:string}>} roster optional class roster to aid matching
 * @returns {Promise<{date:string|null, rows:Array}>}
 */
async function extractAttendanceFromImage(fileBuffer, mimeType, roster = []) {
  const rosterHint =
    roster && roster.length
      ? `\nKnown class roster (match extracted names/rolls to these where possible):\n${roster
          .map((r) => `- ${r.roll_number ? r.roll_number + ': ' : ''}${r.name}`)
          .join('\n')}`
      : '';

  const prompt = `You are an OCR assistant for a school attendance register.
Read the handwritten/printed attendance sheet in the image and return STRICT JSON only.

Output schema:
{
  "date": "YYYY-MM-DD or null if not visible",
  "rows": [
    {
      "roll_number": "string or null",
      "name": "student full name as written",
      "status": "present | absent | late",
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Map ticks/P/✓/present to "present"; A/absent/cross to "absent"; L/late to "late".
- confidence reflects how sure you are of that row's reading (handwriting clarity).
- Do not invent students. Only include rows you can read.${rosterHint}`;

  const text = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: fileBuffer.toString('base64') } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  const parsed = parseJsonLoose(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || [];
  return {
    date: Array.isArray(parsed) ? null : parsed.date || null,
    rows: rows.map((r) => ({
      roll_number: r.roll_number ? String(r.roll_number).trim() : null,
      name: (r.name || '').trim(),
      status: ['present', 'absent', 'late'].includes((r.status || '').toLowerCase())
        ? r.status.toLowerCase()
        : 'present',
      confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
    })),
  };
}

/**
 * Role- and tenant-aware chat. The caller assembles `contextData` (already
 * scoped to the tenant + role) and we feed it as grounding to Gemini.
 * @param {string} role
 * @param {object} contextData JSON-serialisable grounding facts
 * @param {Array<{role:'user'|'assistant',content:string}>} history
 * @param {string} userMessage
 */
async function chat(role, contextData, history, userMessage) {
  const system = `You are the assistant for a school management system.
The current user's role is "${role}". Answer ONLY using the CONTEXT DATA below.
If the answer is not in the context, say you don't have that information.
Be concise and friendly. Never reveal data about other schools or students outside the context.

CONTEXT DATA (JSON):
${JSON.stringify(contextData).slice(0, 12000)}`;

  const contents = [
    { role: 'user', parts: [{ text: system }] },
    { role: 'model', parts: [{ text: 'Understood. How can I help?' }] },
    ...(history || []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  return callGemini({ contents, generationConfig: { temperature: 0.3 } });
}

module.exports = { isConfigured, extractAttendanceFromImage, chat };
