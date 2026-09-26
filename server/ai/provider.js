/**
 * AI Provider abstraction — application depends on this interface,
 * not directly on OpenAI or Gemini calls.
 * PRD section 19.3
 */

const { getAppPool } = require('../db/pool');

class AIProvider {
  async generateText(_input) {
    throw new Error('generateText not implemented');
  }

  async *streamText(_input) {
    throw new Error('streamText not implemented');
  }

  async generateStructured(_input) {
    throw new Error('generateStructured not implemented');
  }
}

class OpenAIProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.timeout = Number(process.env.AI_TIMEOUT_MS) || 30000;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generateText({ model, messages, temperature = 0.3, maxTokens }) {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('OpenAI API key not configured'), { code: 'AI_NOT_CONFIGURED' });
    }

    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body = {
        model,
        messages,
        temperature,
      };
      if (maxTokens) body.max_tokens = maxTokens;

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = await res.json();
      const choice = json.choices?.[0];

      return {
        content: choice?.message?.content || '',
        inputTokens: json.usage?.prompt_tokens || 0,
        outputTokens: json.usage?.completion_tokens || 0,
        model: json.model,
        finishReason: choice?.finish_reason,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamText({ model, messages, temperature = 0.3, maxTokens }) {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('OpenAI API key not configured'), { code: 'AI_NOT_CONFIGURED' });
    }

    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const body = {
        model,
        messages,
        temperature,
        stream: true,
      };
      if (maxTokens) body.max_tokens = maxTokens;

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 500)}`);
      }

      const decoder = new TextDecoder();
      let buffer = '';

      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async generateStructured({ model, messages, schema, temperature = 0.1, maxTokens }) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const schemaInstruction = `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
    if (systemMsg) {
      systemMsg.content += schemaInstruction;
    } else {
      messages.unshift({ role: 'system', content: `You are a helpful assistant.${schemaInstruction}` });
    }

    const result = await this.generateText({
      model,
      messages,
      temperature,
      maxTokens,
    });

    const parsed = parseJsonLoose(result.content);
    return { data: parsed, ...result };
  }
}

function parseJsonLoose(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const startArr = t.indexOf('[');
  const begin = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (begin > 0) t = t.slice(begin);
  const lastObj = t.lastIndexOf('}');
  const lastArr = t.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end !== -1) t = t.slice(0, end + 1);
  return JSON.parse(t);
}

module.exports = { AIProvider, OpenAIProvider, parseJsonLoose };
