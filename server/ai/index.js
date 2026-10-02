/**
 * AI module entry point.
 * Re-exports provider, router, prompts, and safety for convenient imports.
 */

const router = require('./router');
const { buildPrompt, getPrompt } = require('./prompts');
const safety = require('./safety');
const { OpenAIProvider } = require('./provider');
const studentQuota = require('./studentQuota');

module.exports = {
  ...router,
  buildPrompt,
  getPrompt,
  safety,
  OpenAIProvider,
  studentQuota,
};
