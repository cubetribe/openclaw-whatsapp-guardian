import { z } from 'zod';

export const InboxMetadataSchema = z.object({
  version: z.literal('1.2'),
  timestamp: z.string(),
  source: z.literal('whatsapp-guardian'),
  sender_phone: z.string(),
  sender_name: z.string(),
  sender_known: z.boolean().default(false),
  type: z.enum(['appointment', 'price_quote', 'complaint', 'complex_query', 'callback_request', 'uncertainty']),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  guardian_confidence: z.number().min(0).max(1).optional(),
  guardian_reason: z.string().optional(),
  conversation_id: z.string().optional(),
  conversation_state: z.enum(['active', 'escalated', 'resolved']).optional(),
});

export type InboxMetadata = z.infer<typeof InboxMetadataSchema>;
