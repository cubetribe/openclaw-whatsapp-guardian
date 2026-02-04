import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import logger from '../utils/logger';
import { WhatsAppSession } from './session';
import type { Config } from '../config/schema';

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private session: WhatsAppSession;

  constructor(session: WhatsAppSession, _config: Config) {
    this.session = session;
  }

  async connect(): Promise<WASocket> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.session.getSessionPath());
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger.child({ module: 'baileys' })),
        },
        logger: logger.child({ module: 'baileys' }),
        generateHighQualityLinkPreview: true,
      });

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Request pairing code instead of QR if phone number is set
          if (this.socket && process.env.WHATSAPP_PHONE_NUMBER) {
            const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER.replace(/[^0-9]/g, '');
            const code = await this.socket.requestPairingCode(phoneNumber);
            logger.info({ pairingCode: code }, '📱 PAIRING CODE - Enter this in WhatsApp:');
            console.log('\n========================================');
            console.log('   PAIRING CODE: ' + code);
            console.log('========================================\n');
            console.log('Go to WhatsApp > Linked Devices > Link a Device');
            console.log('Then tap "Link with phone number instead"\n');
          } else {
            logger.info('QR Code received - scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          logger.warn({ statusCode, shouldReconnect }, 'Connection closed');

          if (shouldReconnect) {
            logger.info('Attempting to reconnect...');
            await this.connect();
          } else {
            logger.error('Logged out - restart required');
          }
        } else if (connection === 'open') {
          logger.info('WhatsApp connection established successfully');
        }
      });

      this.socket.ev.on('creds.update', saveCreds);

      return this.socket;
    } catch (error) {
      logger.error({ error }, 'Failed to connect to WhatsApp');
      throw error;
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text: message });
      logger.info({ phoneNumber }, 'Message sent successfully');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Failed to send message');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(new Error('Manual disconnect'));
      this.socket = null;
      logger.info('WhatsApp client disconnected');
    }
  }

  getSocket(): WASocket | null {
    return this.socket;
  }
}
