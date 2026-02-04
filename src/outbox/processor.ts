import { readFile, rename, mkdir } from "fs/promises";
import path from "path";
import matter from "gray-matter";
import logger from "../utils/logger";
import type { Config } from "../config/schema";
import { WhatsAppClient } from "../whatsapp/client";
import { OutboxMetadataSchema } from "./schema";
import type { ConversationStore } from "../memory/store";

export class MessageProcessor {
  private whatsappClient: WhatsAppClient;
  private config: Config;
  private retryAttempts = 3;
  private memoryStore?: ConversationStore;

  constructor(whatsappClient: WhatsAppClient, config: Config, memoryStore?: ConversationStore) {
    this.whatsappClient = whatsappClient;
    this.config = config;
    this.memoryStore = memoryStore;
  }

  async processMessage(filePath: string): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.retryAttempts) {
      try {
        attempt++;
        await this.processSingleAttempt(filePath);
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn({ error, attempt, filePath }, "Message send attempt failed");

        if (attempt < this.retryAttempts) {
          await this.delay(1000 * attempt);
        }
      }
    }

    await this.moveToFailed(filePath);
    throw new Error(
      `Failed to send message after ${this.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  private async processSingleAttempt(filePath: string): Promise<void> {
    const fileContent = await readFile(filePath, "utf-8");
    const parsed = matter(fileContent);

    const metadata = OutboxMetadataSchema.parse(parsed.data);
    const messageContent = parsed.content.trim();

    if (!messageContent) {
      throw new Error("Message content is empty");
    }

    logger.info(
      { recipient: metadata.recipient_phone, priority: metadata.priority },
      "Sending outbox message"
    );

    await this.sendMessageWithValidation(metadata.recipient_phone, messageContent);

    if (this.memoryStore && metadata.conversation_id) {
      try {
        this.memoryStore.addMessage(
          metadata.conversation_id,
          'system',
          messageContent,
          'agent'
        );
        logger.info({ conversationId: metadata.conversation_id }, 'Agent message added to conversation history');
      } catch (error) {
        logger.warn({ error, conversationId: metadata.conversation_id }, 'Failed to add agent message to history');
      }
    }

    await this.moveToSent(filePath);
  }

  private async sendMessageWithValidation(phone: string, message: string): Promise<void> {
    const jid = phone.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    
    logger.info({ jid, phoneOriginal: phone }, "Attempting to send message...");

    const socket = this.whatsappClient["socket"];
    if (!socket?.user) {
      throw new Error("WhatsApp not connected, cannot send message");
    }

    try {
      logger.debug({ jid }, "Checking if number exists on WhatsApp...");
      
      const existsResult = await socket.onWhatsApp(jid);
      
      if (!existsResult || existsResult.length === 0 || !existsResult[0]?.exists) {
        throw new Error(`Number ${phone} not registered on WhatsApp`);
      }
      
      logger.info({ jid }, "Number verified, sending message...");

      const result = await Promise.race([
        socket.sendMessage(jid, { text: message }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Send timeout after 30s")), 30000)
        ),
      ]);

      logger.info({ result, jid }, "Message sent successfully");
    } catch (error) {
      logger.error({ error, jid, phone }, "Failed to send message");
      throw error;
    }
  }

  private async moveToSent(filePath: string): Promise<void> {
    const sentDir = path.join(this.config.paths.outbox, "sent");
    await mkdir(sentDir, { recursive: true });

    const filename = path.basename(filePath);
    const sentPath = path.join(sentDir, filename);

    await rename(filePath, sentPath);
    logger.info({ sentPath }, "Message sent and archived");
  }

  private async moveToFailed(filePath: string): Promise<void> {
    const failedDir = path.join(this.config.paths.outbox, "failed");
    await mkdir(failedDir, { recursive: true });

    const filename = path.basename(filePath);
    const failedPath = path.join(failedDir, filename);

    await rename(filePath, failedPath);
    logger.error({ failedPath }, "Message failed and moved to failed directory");
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
