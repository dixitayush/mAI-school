/**
 * Check the Resend setup: API key, sender domain, and (optionally) send a test.
 *   node scripts/verify_resend.js                 # key + domain check only
 *   node scripts/verify_resend.js you@example.com # also sends a test email
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Resend } = require('resend');

async function main() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  if (!from) throw new Error('RESEND_FROM is not set');

  const resend = new Resend(key);
  const domain = (from.match(/@([^>\s]+)/) || [])[1];
  const { data, error } = await resend.domains.list();
  if (error) throw new Error(`API key rejected: ${error.message}`);
  const match = (data?.data || []).find((d) => d.name === domain);
  console.log(`Sender: ${from}`);
  console.log(match ? `Domain ${domain}: ${match.status}` : `Domain ${domain} is not on this Resend account`);
  console.log(`Webhook secret: ${process.env.RESEND_WEBHOOK_SECRET ? 'set' : 'NOT set'}`);

  const to = process.argv[2];
  if (to) {
    const sent = await resend.emails.send({ from, to, subject: 'mAI-school email test', text: 'Resend is configured correctly.' });
    if (sent.error) throw new Error(sent.error.message);
    console.log(`Test email sent to ${to} (id ${sent.data.id})`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
