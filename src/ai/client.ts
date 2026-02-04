import OpenAI from 'openai';
import logger from '../utils/logger';
import type { Config } from '../config/schema';
import type { StoredMessage } from '../types/memory';

export class OpenAIClient {
  private client: OpenAI;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateResponse(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      logger.info({ tokensUsed: response.usage?.total_tokens }, 'OpenAI response generated');
      return content;
    } catch (error) {
      logger.error({ error }, 'Failed to generate OpenAI response');
      throw error;
    }
  }

  async generateResponseWithHistory(
    systemPrompt: string,
    history: StoredMessage[],
    currentMessage: string
  ): Promise<string> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        { role: 'user' as const, content: currentMessage },
      ];

      const response = await this.client.chat.completions.create({
        model: this.config.openai.model,
        messages,
        max_completion_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      logger.info(
        { tokensUsed: response.usage?.total_tokens, historyLength: history.length },
        'OpenAI response with history generated'
      );
      return content;
    } catch (error) {
      logger.error({ error, historyLength: history.length }, 'Failed to generate OpenAI response with history');
      throw error;
    }
  }

  async classify(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: 200,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No classification response from OpenAI');
      }

      logger.debug({ classification: content }, 'Message classified');
      return content;
    } catch (error) {
      logger.error({ error }, 'Failed to classify message');
      throw error;
    }
  }
}
