const { sendMail } = require('./mailer');
const { buildWelcomeAdminEmail } = require('./onboardingEmailTemplate');

function defaultFrom() {
  return process.env.SMTP_FROM || '"mAI-school" <noreply@maischool.com>';
}

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
  return sendMail({
    from: defaultFrom(),
    to: opts.to,
    subject,
    text,
    html,
  });
}

module.exports = { sendWelcomeAdminEmail };
