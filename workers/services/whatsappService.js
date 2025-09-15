//workers/src/services/whatsappServic.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "whatsapp-client" })
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
});

client.initialize();

const sendMessage = async (number, message) => {
    try {
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(formattedNumber, message);
        console.log(`✅ Message sent to ${number}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${number}:`, err.message);
    }
};

module.exports = { sendMessage, client };
