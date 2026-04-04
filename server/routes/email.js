const express = require('express');
const router = express.Router();
const { sendMail } = require('../lib/mailer');

router.post('/send', async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ error: 'to and subject required' });
  }

  const safeSubject = String(subject);
  const safeText = text != null ? String(text) : '';

  const result = await sendMail({
    from: process.env.SMTP_FROM || '"mAI-school" <noreply@maischool.com>',
    to,
    subject: safeSubject,
    text: safeText,
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${safeSubject.replace(/</g, '')}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f6f5; font-family: Inter, Segoe UI, sans-serif;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 20px 0 30px 0;">
                            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                <tr>
                                    <td align="center" style="padding: 36px 0 28px; background: linear-gradient(135deg, #6FA371 0%, #4d7c78 100%);">
                                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">mAI-school</h1>
                                        <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.9);">School management</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <h2 style="margin: 0 0 20px; color: #111827; font-size: 18px;">${safeSubject.replace(/</g, '')}</h2>
                                        <p style="margin: 0; color: #374151; line-height: 1.6;">${safeText.replace(/</g, '&lt;')}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                                        © ${new Date().getFullYear()} mAI-school
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `,
  });

  if (!result.ok) {
    return res.status(500).json({ error: result.error || 'Failed to send email' });
  }

  res.json({
    success: true,
    messageId: result.messageId,
    previewUrl: result.previewUrl,
  });
});

module.exports = router;
