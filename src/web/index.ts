import { server, io } from './server';
import { QRHandler } from './qr-handler';
import { WhatsAppSession } from '../whatsapp/session';
import { WhatsAppClient } from '../whatsapp/client';
import { loadConfig } from '../config/index';
import logger from '../utils/logger';

export async function startWebMode(): Promise<void> {
  const config = loadConfig();
  const port = parseInt(process.env.WEB_PORT || '3333');
  
  logger.info({ port }, 'Starting QR Web Server...');
  
  // Initialize QR Handler
  const qrHandler = new QRHandler(io);
  
  // Initialize WhatsApp Session
  const session = new WhatsAppSession(config);
  await session.initialize();
  
  // Initialize WhatsApp Client
  const waClient = new WhatsAppClient(session, config);
  
  // Connect and hook into Baileys events
  const socket = await waClient.connect();
  
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection } = update;
    
    if (qr) {
      logger.info('QR code received from Baileys');
      await qrHandler.onQRReceived(qr);
    }
    
    if (connection === 'open') {
      const phoneNumber = socket.user?.id?.split(':')[0] || 'unknown';
      logger.info({ phoneNumber }, 'WhatsApp connected successfully');
      qrHandler.onConnected(phoneNumber);
    }
    
    if (connection === 'close') {
      logger.warn('WhatsApp connection closed');
      qrHandler.onConnectionUpdate('disconnected');
    }
    
    if (connection === 'connecting') {
      logger.info('WhatsApp connecting...');
      qrHandler.onConnectionUpdate('connecting');
    }
  });
  
  // Start HTTP server
  server.listen(port, '0.0.0.0', () => {
    logger.info(`QR Web Server running at http://localhost:${port}`);
    console.log(`\n========================================`);
    console.log(`  QR Web Server started!`);
    console.log(`  Open: http://localhost:${port}`);
    console.log(`========================================\n`);
  });
  
  // Socket.IO connection logging
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected to WebSocket');
    
    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected from WebSocket');
    });
  });
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await waClient.disconnect();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
