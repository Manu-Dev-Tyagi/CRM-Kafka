const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pLimit = require('p-limit');
const EventEmitter = require('events');

class WhatsAppConnectionManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.authFolder = path.resolve(__dirname, '../../../whatsapp_sessions/baileys_auth');
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.reconnectDelay = options.reconnectDelay || 5000;
        this.messageQueue = [];
        this.sendLimit = pLimit(options.concurrency || 5); // Max 5 concurrent messages
        this.isShuttingDown = false;

        // Circuit breaker for connection failures
        this.circuitBreaker = {
            failures: 0,
            maxFailures: 5,
            resetTimeout: 30000,
            isOpen: false,
            lastFailureTime: null
        };

        // Setup heartbeat
        this.heartbeatInterval = null;
        this.lastHeartbeat = Date.now();
        this.heartbeatTimeout = 60000; // 1 minute

        this.setupDirectories();
    }

    setupDirectories() {
        if (!fs.existsSync(this.authFolder)) {
            fs.mkdirSync(this.authFolder, { recursive: true });
            console.log(`📁 Created auth directory: ${this.authFolder}`);
        }
    }

    async connect() {
        if (this.connecting || this.connected) {
            console.log('⚠️ Connection already in progress or established');
            return;
        }

        if (this.circuitBreaker.isOpen) {
            const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
            if (timeSinceFailure < this.circuitBreaker.resetTimeout) {
                console.log(`🚧 Circuit breaker is open. Waiting ${Math.ceil((this.circuitBreaker.resetTimeout - timeSinceFailure) / 1000)}s`);
                return;
            } else {
                // Reset circuit breaker
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failures = 0;
                console.log('✅ Circuit breaker reset');
            }
        }

        this.connecting = true;
        console.log(`🔄 Connecting to WhatsApp... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                logger: this.createLogger(),
                options: {
                    keepAliveIntervalMs: 30000
                }
            });

            this.setupEventListeners(saveCreds);
            this.startHeartbeat();

        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp connection:', error);
            this.handleConnectionFailure(error);
        } finally {
            this.connecting = false;
        }
    }

    setupEventListeners(saveCreds) {
        this.socket.ev.on('creds.update', saveCreds);

        this.socket.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        this.socket.ev.on('messages.upsert', (m) => {
            // Handle incoming messages if needed
            this.lastHeartbeat = Date.now();
        });

        // Handle socket close
        this.socket.ev.on('close', () => {
            console.log('🔌 WhatsApp socket closed');
            this.connected = false;
            this.emit('disconnected');
        });
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr) {
            console.log('\n📱 WhatsApp QR Code:');
            console.log('━'.repeat(50));
            qrcode.generate(qr, { small: true });
            console.log('━'.repeat(50));
            console.log('📌 Scan this QR code with your WhatsApp app');
            this.emit('qr', qr);
        }

        if (connection === 'open') {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.circuitBreaker.failures = 0;
            this.circuitBreaker.isOpen = false;

            console.log('✅ WhatsApp connected successfully!');
            console.log(`📱 Device: ${this.socket.user?.name || 'Unknown'}`);

            this.emit('connected', this.socket);
            this.processMessageQueue();
        }

        if (connection === 'close') {
            this.connected = false;
            const shouldReconnect = this.handleDisconnection(lastDisconnect);

            if (shouldReconnect && !this.isShuttingDown) {
                setTimeout(() => {
                    this.reconnect();
                }, this.getReconnectDelay());
            }
        }

        if (connection === 'connecting') {
            console.log('🔄 Connecting to WhatsApp...');
        }
    }

    handleDisconnection(lastDisconnect) {
        const reason = lastDisconnect?.error?.output?.statusCode;
        let shouldReconnect = true;
        let message = 'Unknown reason';

        switch (reason) {
            case DisconnectReason.badSession:
                message = 'Bad session file, delete and scan again';
                this.clearSession();
                break;
            case DisconnectReason.connectionClosed:
                message = 'Connection closed, reconnecting...';
                break;
            case DisconnectReason.connectionLost:
                message = 'Connection lost, reconnecting...';
                break;
            case DisconnectReason.connectionReplaced:
                message = 'Connection replaced, another web session opened';
                shouldReconnect = false;
                break;
            case DisconnectReason.loggedOut:
                message = 'Device logged out, scan QR again';
                this.clearSession();
                break;
            case DisconnectReason.restartRequired:
                message = 'Restart required, reconnecting...';
                break;
            case DisconnectReason.timedOut:
                message = 'Connection timed out, reconnecting...';
                break;
            case DisconnectReason.multideviceMismatch:
                message = 'Multi-device mismatch, clear session';
                this.clearSession();
                break;
            default:
                message = `Disconnected: ${reason || 'Unknown'}`;
                break;
        }

        console.log(`⚠️ WhatsApp disconnected: ${message}`);
        this.emit('disconnected', reason, message);

        return shouldReconnect;
    }

    handleConnectionFailure(error) {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
            this.circuitBreaker.isOpen = true;
            console.log(`🚧 Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
        }

        this.connecting = false;
        this.emit('error', error);
    }

    async reconnect() {
        if (this.isShuttingDown) return;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        await this.connect();
    }

    getReconnectDelay() {
        // Exponential backoff with jitter
        const baseDelay = this.reconnectDelay;
        const exponentialDelay = baseDelay * Math.pow(2, Math.min(this.reconnectAttempts, 5));
        const jitter = Math.random() * 1000; // Add up to 1s jitter
        return Math.min(exponentialDelay + jitter, 60000); // Max 60s delay
    }

    clearSession() {
        try {
            if (fs.existsSync(this.authFolder)) {
                fs.rmSync(this.authFolder, { recursive: true, force: true });
                console.log('🗑️ Cleared WhatsApp session');
            }
            this.setupDirectories();
        } catch (error) {
            console.error('❌ Failed to clear session:', error.message);
        }
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

            if (timeSinceLastHeartbeat > this.heartbeatTimeout && this.connected) {
                console.log('💔 Heartbeat timeout detected, connection may be stale');
                this.connected = false;
                this.emit('heartbeatTimeout');

                if (!this.isShuttingDown) {
                    this.reconnect();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async sendMessage(to, message, options = {}) {
        return new Promise((resolve, reject) => {
            const task = { to, message, options, resolve, reject };

            if (this.connected) {
                this.executeSendMessage(task);
            } else {
                console.log(`📥 Queuing message for ${to} (WhatsApp not connected)`);
                this.messageQueue.push(task);
            }
        });
    }

    async executeSendMessage({ to, message, options, resolve, reject }) {
        try {
            const result = await this.sendLimit(() => this._sendMessage(to, message, options));
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    async _sendMessage(to, message, options = {}) {
        if (!this.connected || !this.socket) {
            throw new Error('WhatsApp not connected');
        }

        try {
            // Ensure phone number has proper format
            const jid = to.includes('@') ? to : `${to.replace(/[^\d]/g, '')}@s.whatsapp.net`;

            let messageContent;
            if (typeof message === 'string') {
                messageContent = { text: message };
            } else {
                messageContent = message;
            }

            const result = await this.socket.sendMessage(jid, messageContent, options);
            this.lastHeartbeat = Date.now();

            console.log(`✅ Message sent to ${to}`);
            return result;

        } catch (error) {
            console.error(`❌ Failed to send message to ${to}:`, error.message);

            // Check if it's a connection-related error
            if (error.message.includes('Connection') || error.message.includes('Socket')) {
                this.connected = false;
                this.emit('disconnected');
            }

            throw error;
        }
    }

    async processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

        const queueCopy = [...this.messageQueue];
        this.messageQueue = [];

        for (const task of queueCopy) {
            try {
                await this.executeSendMessage(task);
            } catch (error) {
                // If failed, put back in queue or handle based on error type
                if (this.connected) {
                    task.reject(error);
                } else {
                    this.messageQueue.push(task);
                }
            }
        }
    }

    isConnected() {
        return this.connected && this.socket;
    }

    getConnectionInfo() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            circuitBreakerOpen: this.circuitBreaker.isOpen,
            circuitBreakerFailures: this.circuitBreaker.failures,
            lastHeartbeat: this.lastHeartbeat
        };
    }

    createLogger() {
        const createLoggerInstance = (metadata = {}) => {
            return {
                level: 'error',
                // Implement all logging methods that Baileys expects
                trace: (...args) => {}, // Silent trace
                debug: (...args) => {}, // Silent debug
                info: (...args) => {},  // Silent info
                warn: (message, ...args) => {
                    console.warn('[Baileys]', metadata, message, ...args);
                },
                error: (message, ...args) => {
                    console.error('[Baileys]', metadata, message, ...args);
                },
                fatal: (message, ...args) => {
                    console.error('[Baileys Fatal]', metadata, message, ...args);
                },
                // Generic log method for compatibility
                log: (level, message, ...args) => {
                    if (level === 'error' || level === 50) {
                        console.error('[Baileys]', metadata, message, ...args);
                    } else if (level === 'warn' || level === 40) {
                        console.warn('[Baileys]', metadata, message, ...args);
                    }
                    // Ignore other log levels (info, debug, trace)
                },
                // Child logger creation
                child: (childMeta) => {
                    const combinedMeta = { ...metadata, ...childMeta };
                    return createLoggerInstance(combinedMeta);
                }
            };
        };

        return createLoggerInstance();
    }

    async disconnect() {
        this.isShuttingDown = true;
        this.stopHeartbeat();

        // Reject all queued messages
        for (const task of this.messageQueue) {
            task.reject(new Error('WhatsApp connection shutting down'));
        }
        this.messageQueue = [];

        if (this.socket) {
            try {
                await this.socket.logout();
            } catch (error) {
                console.warn('⚠️ Error during logout:', error.message);
            }

            try {
                this.socket.end();
            } catch (error) {
                console.warn('⚠️ Error closing socket:', error.message);
            }
        }

        this.connected = false;
        this.socket = null;
        console.log('📴 WhatsApp disconnected gracefully');
    }
}

module.exports = WhatsAppConnectionManager;