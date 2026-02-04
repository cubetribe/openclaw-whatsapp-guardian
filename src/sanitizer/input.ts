import logger from '../utils/logger';
import { detectSuspiciousPatterns } from './patterns';
import type { Config } from '../config/schema';

export interface SanitizationResult {
  sanitized: string;
  warnings: string[];
  blocked: boolean;
}

export class InputSanitizer {
  constructor(private config: Config) {}

  sanitize(input: string): SanitizationResult {
    const warnings: string[] = [];

    if (input.length > this.config.security.messageMaxLength) {
      logger.warn(
        { length: input.length, max: this.config.security.messageMaxLength },
        'Message exceeds maximum length - truncating'
      );
      warnings.push('Message truncated due to length');
      input = input.substring(0, this.config.security.messageMaxLength);
    }

    const suspiciousPatterns = detectSuspiciousPatterns(input);
    if (suspiciousPatterns.length > 0) {
      logger.warn({ patterns: suspiciousPatterns }, 'Suspicious patterns detected in message');
      warnings.push(...suspiciousPatterns);

      if (this.shouldBlock(suspiciousPatterns)) {
        return {
          sanitized: '',
          warnings: [...warnings, 'Message blocked due to security concerns'],
          blocked: true,
        };
      }
    }

    const sanitized = this.cleanInput(input);

    return {
      sanitized,
      warnings,
      blocked: false,
    };
  }

  private cleanInput(input: string): string {
    return input
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .trim();
  }

  private shouldBlock(patterns: string[]): boolean {
    const blockKeywords = ['injection', 'override', 'jailbreak'];
    return patterns.some(pattern =>
      blockKeywords.some(keyword => pattern.toLowerCase().includes(keyword))
    );
  }
}
