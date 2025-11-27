const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Create a test account for Ethereal
let transporter;

nodemailer.createTestAccount().then((account) => {
    transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass,
        },
    });
    console.log('Ethereal Email Configured');
});

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
            html: `<b>${text}</b>`, // html body
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
