const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const authFolder = path.resolve(__dirname, '../../../whatsapp_sessions/baileys_auth');

let whatsappSocket = null;
let connected = false;

async function connectWhatsApp(onReady) {
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    whatsappSocket = makeWASocket({ auth: state });

    whatsappSocket.ev.on('creds.update', saveCreds);

    whatsappSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📌 Scan QR to connect WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            connected = true;
            console.log('✅ WhatsApp connected!');
            if (onReady) onReady(); // Notify ready
        }

        if (connection === 'close') {
            connected = false;
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.message;
            console.log('⚠️ WhatsApp disconnected:', reason);

            if (reason === 401) {
                console.log('❌ Unauthorized. Deleting session...');
                fs.rmSync(authFolder, { recursive: true, force: true });
            }

            setTimeout(() => connectWhatsApp(onReady), 5000); // Reconnect
        }
    });

    return { whatsappSocket, get connected() { return connected; } };
}

module.exports = { connectWhatsApp };
