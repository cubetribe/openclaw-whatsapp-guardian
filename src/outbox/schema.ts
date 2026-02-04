import { z } from 'zod';

export const OutboxMetadataSchema = z.object({
  version: z.string().default('1.1'),
  timestamp: z.string(),
  recipient_phone: z.string(),
  recipient_name: z.string(),
  reply_to_inbox: z.string().optional(),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  conversation_id: z.string().optional(),
});

export type OutboxMetadata = z.infer<typeof OutboxMetadataSchema>;
