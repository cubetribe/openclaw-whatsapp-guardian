import { writeFile } from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import type { Config } from '../config/schema';
import type { MessageContext, IntentType } from '../types';
import type { StoredMessage } from '../types/memory';
import { InboxMetadataSchema, type InboxMetadata } from './schema';
import { WebhookNotifier, type WebhookPayload } from '../webhook';

export class InboxWriter {
  private readonly webhookNotifier: WebhookNotifier;

  constructor(private config: Config) {
    this.webhookNotifier = new WebhookNotifier(config);
  }

  async writeEscalation(
    context: MessageContext,
    intent: IntentType,
    aiAssessment: string,
    confidence?: number,
    conversationId?: string,
    conversationState?: 'active' | 'escalated' | 'resolved',
    conversationHistory?: StoredMessage[]
  ): Promise<string> {
    try {
      const timestamp = context.timestamp.toISOString();
      const filename = this.generateFilename(context.timestamp);
      const filePath = path.join(this.config.paths.inbox, filename);

      const metadata: InboxMetadata = {
        version: '1.2',
        timestamp,
        source: 'whatsapp-guardian',
        sender_phone: context.phoneNumber,
        sender_name: context.senderName || 'Unknown',
        sender_known: false,
        type: this.mapIntentToType(intent),
        priority: this.determinePriority(context.message, intent),
        ...(confidence !== undefined && { guardian_confidence: confidence }),
        guardian_reason: aiAssessment,
        ...(conversationId && { conversation_id: conversationId }),
        ...(conversationState && { conversation_state: conversationState }),
      };

      InboxMetadataSchema.parse(metadata);

      const content = this.buildContent(context, aiAssessment, conversationHistory);
      const fileContent = matter.stringify(content, metadata);

      await writeFile(filePath, fileContent, 'utf-8');

      logger.info({ filename, intent, sender: context.phoneNumber }, 'Escalation file created');

      // Send webhook notification (fire-and-forget with error logging)
      if (conversationId) {
        this.sendWebhookNotification({
          conversation_id: conversationId,
          sender_name: context.senderName || 'Unknown',
          sender_phone: context.phoneNumber,
          summary: aiAssessment,
          priority: metadata.priority,
          timestamp,
          inbox_file: filename,
        }).catch(error => {
          // Log error but do not fail the escalation
          logger.error(
            { error, filename, conversationId },
            'Webhook notification failed (escalation file was created successfully)'
          );
        });
      }

      return filename;
    } catch (error) {
      logger.error({ error, context }, 'Failed to write escalation file');
      throw error;
    }
  }

  private generateFilename(timestamp: Date): string {
    const isoDate = timestamp.toISOString().replace(/[:.]/g, '-');
    const shortUuid = uuidv4().split('-')[0];
    return `msg-${isoDate}-${shortUuid}.md`;
  }

  private mapIntentToType(
    intent: IntentType
  ): 'appointment' | 'price_quote' | 'complaint' | 'complex_query' | 'callback_request' | 'uncertainty' {
    switch (intent) {
      case 'APPOINTMENT':
        return 'appointment';
      case 'PRICE_QUOTE':
        return 'price_quote';
      case 'CALLBACK_REQUEST':
        return 'callback_request';
      case 'COMPLAINT':
        return 'complaint';
      case 'UNCERTAINTY':
        return 'uncertainty';
      default:
        return 'complex_query';
    }
  }

  private determinePriority(message: string, intent: IntentType): 'normal' | 'urgent' {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'immediately', 'dringend', 'sofort'];
    const lowerMessage = message.toLowerCase();

    if (intent === 'COMPLAINT' || urgentKeywords.some(kw => lowerMessage.includes(kw))) {
      return 'urgent';
    }

    return 'normal';
  }

  private buildContent(
    context: MessageContext,
    aiAssessment: string,
    conversationHistory?: StoredMessage[]
  ): string {
    let content = `# Summary
${aiAssessment}

## Original Message
> ${context.message}`;

    if (conversationHistory && conversationHistory.length > 0) {
      content += `\n\n## Conversation History\n`;
      conversationHistory.forEach((msg) => {
        const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
        const time = msg.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const source = msg.source === 'agent' ? ' [Agent]' : '';
        content += `- [${role}${source} ${time}]: ${msg.content}\n`;
      });
    }

    content += `

## Guardian Assessment
Intent detected: Requires escalation to your AI agent for proper handling.

## Suggested Action
Please review and respond to this customer inquiry.

---
*This file was automatically generated by WhatsApp Guardian*
*Customer: ${context.senderName || 'Unknown'} (${context.phoneNumber})*
*Received: ${context.timestamp.toLocaleString()}*
`;

    return content;
  }

  private async sendWebhookNotification(payload: WebhookPayload): Promise<void> {
    await this.webhookNotifier.notify(payload);
  }
}
