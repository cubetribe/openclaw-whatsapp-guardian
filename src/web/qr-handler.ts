import { Server } from 'socket.io';
import QRCode from 'qrcode';
import logger from '../utils/logger';

export class QRHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async onQRReceived(qr: string): Promise<void> {
    try {
      // Generate QR as data URL
      const qrDataUrl = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      
      logger.info('QR Code generated, broadcasting to clients');
      this.io.emit('qr', qrDataUrl);
    } catch (error) {
      logger.error({ error }, 'Failed to generate QR code');
      this.io.emit('error', 'QR generation failed');
    }
  }

  onConnectionUpdate(status: string, data?: any): void {
    logger.info({ status, data }, 'Connection status update');
    this.io.emit('status', { status, ...data });
  }

  onConnected(phoneNumber: string): void {
    logger.info({ phoneNumber }, 'WhatsApp connected successfully');
    this.io.emit('connected', { phoneNumber });
  }
}
