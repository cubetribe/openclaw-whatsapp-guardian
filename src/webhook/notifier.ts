import logger from '../utils/logger';
import type { Config } from '../config/schema';

export interface WebhookPayload {
  conversation_id: string;
  sender_name: string;
  sender_phone: string;
  summary: string;
  priority: 'normal' | 'urgent';
  timestamp: string;
  inbox_file: string;
}

export class WebhookNotifier {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async notify(payload: WebhookPayload): Promise<boolean> {
    if (!this.config.webhook.enabled) {
      logger.debug('Webhook notification skipped: webhook disabled');
      return false;
    }

    if (!this.config.webhook.url) {
      logger.warn('Webhook notification skipped: webhook URL not configured');
      return false;
    }

    const maxRetries = this.config.webhook.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug({ attempt, maxRetries, url: this.config.webhook.url }, 'Sending webhook notification');

        const response = await this.sendWebhook(payload);

        if (response.ok) {
          logger.info(
            {
              conversationId: payload.conversation_id,
              file: payload.inbox_file,
              statusCode: response.status
            },
            'Webhook notification sent successfully'
          );
          return true;
        }

        // HTTP 4xx: Client error - do not retry
        if (response.status >= 400 && response.status < 500) {
          logger.error(
            {
              statusCode: response.status,
              statusText: response.statusText,
              conversationId: payload.conversation_id
            },
            'Webhook notification failed: client error (will not retry)'
          );
          return false;
        }

        // HTTP 5xx: Server error - retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        logger.warn(
          {
            attempt,
            maxRetries,
            statusCode: response.status,
            conversationId: payload.conversation_id
          },
          'Webhook notification failed: server error (will retry)'
        );

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          {
            attempt,
            maxRetries,
            error: lastError.message,
            conversationId: payload.conversation_id
          },
          'Webhook notification failed: network error (will retry)'
        );
      }

      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    logger.error(
      {
        maxRetries,
        lastError: lastError?.message,
        conversationId: payload.conversation_id,
        file: payload.inbox_file
      },
      'Webhook notification failed after all retries'
    );
    return false;
  }

  private async sendWebhook(payload: WebhookPayload): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.webhook.timeout);

    try {
      const response = await fetch(this.config.webhook.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Guardian/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
