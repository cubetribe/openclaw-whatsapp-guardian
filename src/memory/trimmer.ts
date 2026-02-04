import logger from '../utils/logger';
import type { StoredMessage } from '../types/memory';
import { countTokens } from './tokenizer';

export function trimToTokenLimit(messages: StoredMessage[], maxTokens: number = 50000): StoredMessage[] {
  if (messages.length === 0) {
    return [];
  }

  let totalTokens = messages.reduce((sum, msg) => sum + (msg.tokenCount || countTokens(msg.content)), 0);

  if (totalTokens <= maxTokens) {
    return messages;
  }

  logger.info({ totalTokens, maxTokens, messageCount: messages.length }, 'Trimming conversation history');

  const trimmedMessages: StoredMessage[] = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = msg.tokenCount || countTokens(msg.content);

    if (currentTokens + msgTokens <= maxTokens) {
      trimmedMessages.unshift(msg);
      currentTokens += msgTokens;
    } else {
      break;
    }
  }

  logger.info(
    {
      originalCount: messages.length,
      trimmedCount: trimmedMessages.length,
      originalTokens: totalTokens,
      trimmedTokens: currentTokens,
    },
    'Conversation history trimmed'
  );

  return trimmedMessages;
}
