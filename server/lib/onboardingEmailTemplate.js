/**
 * mAI-school branded welcome email for new institute administrators.
 * All dynamic values are escaped for HTML; loginUrl is validated by caller.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BRAND = {
  green: '#6FA371',
  greenDark: '#4d7c78',
  greenLight: '#88B38A',
  mint: '#E8F5E9',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  white: '#ffffff',
};

/**
 * @param {{ fullName: string; instituteName: string; loginUrl: string; username: string; plainPassword: string }} p
 */
function buildWelcomeAdminEmail(p) {
  const fullName = escapeHtml(p.fullName);
  const instituteName = escapeHtml(p.instituteName);
  const loginUrl = escapeHtml(p.loginUrl);
  const username = escapeHtml(p.username);
  const plainPassword = escapeHtml(p.plainPassword);

  const subject = `Welcome to mAI-school — ${p.instituteName} is ready`;
  const subjectEsc = escapeHtml(subject);

  const text = [
    `Hi ${p.fullName},`,
    '',
    `Your institute "${p.instituteName}" has been created on mAI-school.`,
    '',
    'Sign in here:',
    p.loginUrl,
    '',
    `Username: ${p.username}`,
    `Password: ${p.plainPassword}`,
    '',
    'For security, change your password after your first sign-in.',
    '',
    '— mAI-school',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectEsc}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:Inter,Segoe UI,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse;background:${BRAND.white};border-radius:20px;overflow:hidden;box-shadow:0 20px 50px -12px rgba(17,24,39,0.12);">
          <tr>
            <td style="padding:36px 32px 28px;background:linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenDark} 100%);text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:14px;background:rgba(255,255,255,0.2);font-size:22px;margin-bottom:12px;">🎓</div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:${BRAND.white};letter-spacing:-0.02em;">mAI-school</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.88);font-weight:500;">School management for modern institutes</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${BRAND.text};">Hi <strong>${fullName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                <strong style="color:${BRAND.text};">${instituteName}</strong> is ready. Use the link below to sign in as the first administrator—then invite teachers and students from your dashboard.
              </p>
              <table role="presentation" width="100%" style="margin:24px 0;border-collapse:separate;border-radius:14px;background:${BRAND.mint};border:1px solid rgba(111,163,113,0.25);">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.greenDark};">Your sign-in link</p>
                    <a href="${loginUrl}" style="word-break:break-all;font-size:14px;font-weight:600;color:${BRAND.greenDark};text-decoration:underline;">${loginUrl}</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" style="margin:0 0 20px;border-collapse:collapse;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.muted};">Username</td>
                  <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};text-align:right;font-family:ui-monospace,monospace;font-size:14px;font-weight:600;color:${BRAND.text};">${username}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;font-size:14px;color:${BRAND.muted};">Password</td>
                  <td style="padding:12px 0;text-align:right;font-family:ui-monospace,monospace;font-size:14px;font-weight:600;color:${BRAND.text};">${plainPassword}</td>
                </tr>
              </table>
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenDark} 100%);color:${BRAND.white};font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 10px 25px -8px rgba(77,124,120,0.55);">Open sign in</a>
              </div>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
                Always use this institute link to sign in—not the main marketing site. Change your password after first login.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;background:#f9fafb;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                © ${new Date().getFullYear()} mAI-school · Automated message
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = { buildWelcomeAdminEmail, escapeHtml };
