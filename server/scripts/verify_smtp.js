require('dotenv').config();
const nodemailer = require('nodemailer');

async function verify() {
    console.log('Testing SMTP Connection...');
    console.log('User:', process.env.SMTP_USER);
    console.log('Pass length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        await transporter.verify();
        console.log('SUCCESS: SMTP Connection Verified!');
    } catch (error) {
        console.error('FAILURE: SMTP Connection Failed');
        console.error(error);
    }
}

verify();
