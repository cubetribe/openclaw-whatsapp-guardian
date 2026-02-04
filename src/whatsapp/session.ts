import { mkdir } from 'fs/promises';
import type { Config } from '../config/schema';
import logger from '../utils/logger';

export class WhatsAppSession {
  private sessionPath: string;

  constructor(config: Config) {
    this.sessionPath = config.whatsapp.authDir;
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.sessionPath, { recursive: true });
      logger.info(`WhatsApp session directory initialized: ${this.sessionPath}`);
    } catch (error) {
      logger.error({ error }, 'Failed to create session directory');
      throw error;
    }
  }

  getSessionPath(): string {
    return this.sessionPath;
  }
}
