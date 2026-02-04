import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import logger from "../utils/logger";
import type { MessageContext } from "../types";

export type MessageHandler = (context: MessageContext) => Promise<void>;

export class WhatsAppHandlers {
  private messageHandler?: MessageHandler;
  private blockedSenders: Set<string>;

  constructor(private socket: WASocket) {
    // Parse BLOCKED_SENDERS from environment (comma-separated phone numbers)
    const blockedSendersEnv = process.env.BLOCKED_SENDERS || "";
    this.blockedSenders = new Set(
      blockedSendersEnv
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    );

    if (this.blockedSenders.size > 0) {
      logger.info(
        { count: this.blockedSenders.size },
        "Blocked senders blacklist active"
      );
    } else {
      logger.info("No blocked senders - accepting messages from all senders");
    }
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async setupHandlers(): Promise<void> {
    this.socket.ev.on("messages.upsert", async ({ messages }) => {
      for (const message of messages) {
        if (!message.message || message.key.fromMe) {
          continue;
        }

        await this.handleIncomingMessage(message);
      }
    });

    logger.info("WhatsApp message handlers registered");
  }

  private async handleIncomingMessage(message: WAMessage): Promise<void> {
    try {
      const phoneNumber = message.key.remoteJid?.replace("@s.whatsapp.net", "");
      if (!phoneNumber) {
        logger.warn("Message without valid phone number");
        return;
      }

      // Security: Check blocked senders blacklist
      if (this.blockedSenders.has(phoneNumber)) {
        logger.warn(
          { phoneNumber: this.redactPhone(phoneNumber) },
          "Sender is blacklisted - message ignored"
        );
        return;
      }

      const messageText = this.extractMessageText(message);
      if (!messageText) {
        logger.debug({ phoneNumber }, "Received non-text message - ignoring");
        return;
      }

      const senderName = message.pushName || "Unknown";
      const timestamp = message.messageTimestamp
        ? new Date(Number(message.messageTimestamp) * 1000)
        : new Date();

      const context: MessageContext = {
        phoneNumber,
        senderName,
        message: messageText,
        timestamp,
      };

      logger.info(
        { phoneNumber: this.redactPhone(phoneNumber), senderName, messageLength: messageText.length },
        "Received message"
      );

      if (this.messageHandler) {
        await this.messageHandler(context);
      } else {
        logger.warn("No message handler registered - message ignored");
      }
    } catch (error) {
      logger.error({ error }, "Error handling incoming message");
    }
  }

  private extractMessageText(message: WAMessage): string | null {
    const msg = message.message;
    if (!msg) return null;

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;

    return null;
  }

  private redactPhone(phone: string): string {
    if (phone.length < 4) return "***";
    return phone.slice(0, -4) + "****";
  }
}
