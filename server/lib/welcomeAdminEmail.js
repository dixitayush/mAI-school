const { sendMail } = require('./mailer');
const { buildWelcomeAdminEmail } = require('./onboardingEmailTemplate');

/**
 * @param {{ to: string; fullName: string; instituteName: string; loginUrl: string; username: string; plainPassword: string }} opts
 */
async function sendWelcomeAdminEmail(opts) {
  const { subject, text, html } = buildWelcomeAdminEmail({
    fullName: opts.fullName,
    instituteName: opts.instituteName,
    loginUrl: opts.loginUrl,
    username: opts.username,
    plainPassword: opts.plainPassword,
  });
  // Sender comes from RESEND_FROM (see services/emailService).
  return sendMail({
    to: opts.to,
    subject,
    text,
    html,
  });
}

module.exports = { sendWelcomeAdminEmail };
