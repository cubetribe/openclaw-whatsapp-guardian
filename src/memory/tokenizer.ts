import { Tiktoken, encodingForModel } from 'js-tiktoken';
import logger from '../utils/logger';

let tokenizer: Tiktoken | null = null;

export function getTokenizer(): Tiktoken {
  if (!tokenizer) {
    try {
      tokenizer = encodingForModel('gpt-4o');
      logger.debug('Tokenizer initialized for gpt-4o');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize tokenizer');
      throw error;
    }
  }
  return tokenizer;
}

export function countTokens(text: string): number {
  try {
    const encoder = getTokenizer();
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    logger.warn({ error, textLength: text.length }, 'Failed to count tokens, estimating');
    return Math.ceil(text.length / 4);
  }
}
