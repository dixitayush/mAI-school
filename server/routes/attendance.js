const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const pool = new Pool({ connectionString: DATABASE_URL });

// Create a test account for Ethereal (or use real config if available)
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
        console.log('Attendance Email Service Configured (Real SMTP)');

        // Verify connection
        try {
            await transporter.verify();
            console.log('SMTP Connection Verified');
        } catch (error) {
            console.error('SMTP Connection Failed:', error);
            // Do NOT fallback to Ethereal if SMTP_HOST is set. User wants real email.
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
            console.log('Attendance Email Service Configured (Ethereal Mock)');
        } catch (err) {
            console.error('Failed to create Ethereal account', err);
        }
    }
};

setupEmail();

// Helper to send email
async function sendAttendanceEmail(studentEmail, studentName, status, date, remarks) {
    if (!transporter || !studentEmail) return;

    const subject = `Attendance Update: ${status.toUpperCase()} - ${date}`;
    const color = status === 'present' ? '#4CAF50' : status === 'absent' ? '#F44336' : '#FF9800';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Attendance Update</title>
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
                                            <p style="margin: 0;">Dear Parent/Guardian,</p>
                                            <p style="margin: 20px 0 0 0;">This is an automated notification regarding the attendance status of your ward.</p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Status Card -->
                                    <tr>
                                        <td align="center" style="padding: 30px 0;">
                                            <div style="display: inline-block; padding: 15px 30px; border-radius: 50px; background-color: ${status === 'present' ? '#dcfce7' : status === 'absent' ? '#fee2e2' : '#fef3c7'};">
                                                <span style="font-size: 18px; font-weight: bold; color: ${status === 'present' ? '#166534' : status === 'absent' ? '#991b1b' : '#92400e'}; text-transform: uppercase; letter-spacing: 1px;">
                                                    ${status}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Details -->
                                    <tr>
                                        <td>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                                                <tr>
                                                    <td width="30%" style="padding: 15px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Student Name</td>
                                                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-weight: 600;">${studentName}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Date</td>
                                                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                                </tr>
                                                ${remarks ? `
                                                <tr>
                                                    <td style="padding: 15px; font-weight: bold; color: #4b5563;">Remarks</td>
                                                    <td style="padding: 15px; color: #1f2937; font-style: italic;">"${remarks}"</td>
                                                </tr>
                                                ` : ''}
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding-top: 30px; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                                            <p style="margin: 0;">Please contact the school administration if you believe this is an error.</p>
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
    `;

    try {
        const info = await transporter.sendMail({
            from: '"mAI-school Attendance" <attendance@maischool.com>',
            to: studentEmail,
            subject: subject,
            html: html,
        });
        console.log('Attendance Email sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

const { sendSMS, sendWhatsApp } = require('../services/smsService');

// ... (existing imports and setup)

// Mark Attendance Route
router.post('/mark', async (req, res) => {
    const { student_id, date, status, remarks, recorded_by } = req.body;

    if (!student_id || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Insert Attendance Record
        const insertQuery = `
            INSERT INTO attendance (student_id, date, status, remarks, recorded_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [student_id, date || new Date(), status, remarks, recorded_by]);
        const attendanceRecord = result.rows[0];

        // 2. Fetch Student & Parent Details for Notifications
        // We now join with parents table
        const studentQuery = `
            SELECT 
                s.id, 
                u.full_name as student_name, 
                p.email as parent_email,
                p.phone as parent_phone,
                p.full_name as parent_name
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN parents p ON s.parent_id = p.id
            WHERE s.id = $1;
        `;
        const studentResult = await pool.query(studentQuery, [student_id]);

        if (studentResult.rows.length > 0) {
            const student = studentResult.rows[0];

            // Send Email to Parent
            if (student.parent_email) {
                sendAttendanceEmail(student.parent_email, student.student_name, status, attendanceRecord.date, remarks);
            }

            // Send SMS & WhatsApp to Parent
            if (student.parent_phone) {
                const message = `Attendance Alert: ${student.student_name} is marked ${status.toUpperCase()} on ${new Date(attendanceRecord.date).toLocaleDateString()}. Remarks: ${remarks || 'None'}`;

                // Send SMS
                await sendSMS(student.parent_phone, message);

                // Send WhatsApp
                await sendWhatsApp(student.parent_phone, message);
            }
        }

        res.json({ success: true, data: attendanceRecord });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get Attendance Stats
router.get('/stats/:student_id', async (req, res) => {
    const { student_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT status, COUNT(*) as count FROM attendance WHERE student_id = $1 GROUP BY status`,
            [student_id]
        );

        const stats = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        if (stats.total > 0) {
            // Calculate percentage (Present + Late/2) / Total * 100 ? Or just Present/Total
            // Simple: Present / Total
            stats.percentage = Math.round((stats.present / stats.total) * 100);
        }

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get Attendance History (by Class and Date)
router.get('/history', async (req, res) => {
    const { class_id, date } = req.query;

    if (!class_id || !date) {
        return res.status(400).json({ error: 'Missing class_id or date' });
    }

    try {
        const query = `
            SELECT a.*, s.user_id 
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE s.class_id = $1 AND a.date = $2
        `;
        const result = await pool.query(query, [class_id, date]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

module.exports = router;
