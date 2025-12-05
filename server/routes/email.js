const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Create a test account for Ethereal
// Email Configuration
let transporter;

const setupEmail = async () => {
    if (process.env.SMTP_HOST) {
        // Use Real SMTP - Strict Mode
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log('General Email Service Configured (Real SMTP)');

        // Verify connection
        try {
            await transporter.verify();
            console.log('SMTP Connection Verified');
        } catch (error) {
            console.error('SMTP Connection Failed:', error);
            transporter = null;
        }
    } else {
        // Fallback to Ethereal only if NO real config is provided
        try {
            const account = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: account.smtp.host,
                port: account.smtp.port,
                secure: account.smtp.secure,
                auth: {
                    user: account.user,
                    pass: account.pass,
                },
            });
            console.log('General Email Service Configured (Ethereal Mock)');
        } catch (err) {
            console.error('Failed to create Ethereal account', err);
        }
    }
};

setupEmail();

router.post('/send', async (req, res) => {
    const { to, subject, text } = req.body;

    if (!transporter) {
        return res.status(500).json({ error: 'Email service not ready' });
    }

    try {
        const info = await transporter.sendMail({
            from: '"mAI-school System" <system@maischool.com>',
            to: to,
            subject: subject,
            text: text,
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 20px 0 30px 0;">
                            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                                <!-- Header -->
                                <tr>
                                    <td align="center" style="padding: 40px 0 30px 0; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);">
                                        <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">EduFlow</h1>
                                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #e0e7ff;">School Management System</p>
                                    </td>
                                </tr>
                                
                                <!-- Body -->
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="color: #1f2937; font-size: 16px; line-height: 24px;">
                                                    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">${subject}</h2>
                                                    <p style="margin: 0;">${text}</p>
                                                </td>
                                            </tr>
                                            
                                            <tr>
                                                <td style="padding-top: 30px; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                                                    <p style="margin: 0;">Please contact the school administration if you have any queries.</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                                                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} mAI-school System. All rights reserved.</p>
                                                    <p style="margin: 10px 0 0 0;">This is an automated message, please do not reply directly to this email.</p>
                                                </td>
                                            </tr>
                                        </table>
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

        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

        res.json({
            success: true,
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

module.exports = router;
