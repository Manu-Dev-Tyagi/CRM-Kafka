// workers/config/twilio.js

const twilio = require('twilio');

let client = null;

function getTwilioClient() {
  if (!client) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('⚠️ Twilio credentials not set in env');
    }
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return client;
}

/**
 * Sends a WhatsApp message using Twilio's API.
 * @param {string} to - The recipient's phone number, including the country code (e.g., '+1234567890').
 * @param {string} body - The message content.
 * @returns {Promise<object>} - The Twilio message response object.
 */
async function sendWhatsAppMessage(to, body) {
  if (!process.env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error('⚠️ TWILIO_WHATSAPP_NUMBER not set in env');
  }

  const client = getTwilioClient();

  return await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${to}`,
    body
  });
}

module.exports = {
  sendWhatsAppMessage
};