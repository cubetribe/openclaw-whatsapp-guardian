import { z } from 'zod';

export const WhatsAppMessageSchema = z.object({
  remoteJid: z.string(),
  fromMe: z.boolean(),
  id: z.string(),
  participant: z.string().optional(),
});

export type WhatsAppMessageKey = z.infer<typeof WhatsAppMessageSchema>;
