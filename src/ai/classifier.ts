import logger from '../utils/logger';
import type { IntentType, ClassificationResult } from '../types';
import { OpenAIClient } from './client';
import { PromptBuilder } from './prompt';

// Extended intent types for Guardian
const ESCALATION_INTENTS: IntentType[] = [
  'APPOINTMENT',
  'PRICE_QUOTE',
  'COMPLAINT',
  'COMPLEX_QUERY',
  'CALLBACK_REQUEST',
  'UNCERTAINTY',
];

export function shouldEscalate(intent: IntentType): boolean {
  return ESCALATION_INTENTS.includes(intent);
}

export class MessageClassifier {
  constructor(
    private aiClient: OpenAIClient,
    private promptBuilder: PromptBuilder
  ) {}

  async classify(message: string): Promise<ClassificationResult> {
    try {
      const classificationPrompt = this.promptBuilder.buildClassificationPrompt();
      const response = await this.aiClient.classify(classificationPrompt, message);

      const parsed = this.parseClassification(response);

      logger.info({ intent: parsed.intent, confidence: parsed.confidence }, 'Message classified');

      return parsed;
    } catch (error) {
      logger.error({ error }, 'Classification failed - defaulting to UNCERTAINTY');
      return {
        intent: 'UNCERTAINTY',
        confidence: 0,
        requiresEscalation: true,
        reasoning: 'Classification error - escalating for safety',
      };
    }
  }

  private parseClassification(response: string): ClassificationResult {
    const parts = response.split('|').map(s => s.trim());
    const intent = (parts[0] || 'UNCERTAINTY') as IntentType;
    const reasoning = parts[1] || '';

    const requiresEscalation = shouldEscalate(intent);

    return {
      intent,
      confidence: 0.8,
      requiresEscalation,
      reasoning,
    };
  }
}
