const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

let client;

if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log('Twilio Client Initialized');
} else {
    console.log('Twilio credentials missing. Using Mock Service.');
}

const sendSMS = async (to, message) => {
    if (client && fromNumber) {
        try {
            const result = await client.messages.create({
                body: message,
                from: fromNumber,
                to: to
            });
            console.log(`[Twilio SMS] Sent to ${to}: ${result.sid}`);
            return { success: true, messageId: result.sid };
        } catch (error) {
            console.error('[Twilio SMS] Failed:', error);
            return { success: false, error: error.message };
        }
    } else {
        console.log(`[Mock SMS] To: ${to}, Message: ${message}`);
        return { success: true, messageId: 'mock-sms-' + Date.now() };
    }
};

const sendWhatsApp = async (to, message) => {
    if (client && whatsappNumber) {
        try {
            // Ensure numbers have whatsapp: prefix
            const from = whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`;
            const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

            const result = await client.messages.create({
                body: message,
                from: from,
                to: toNum
            });
            console.log(`[Twilio WhatsApp] Sent to ${toNum}: ${result.sid}`);
            return { success: true, messageId: result.sid };
        } catch (error) {
            console.error('[Twilio WhatsApp] Failed:', error);
            return { success: false, error: error.message };
        }
    } else {
        // Mock WhatsApp
        console.log(`[Mock WhatsApp] To: ${to}, Message: ${message}`);
        return { success: true, messageId: 'mock-wa-' + Date.now() };
    }
};

module.exports = { sendSMS, sendWhatsApp };
