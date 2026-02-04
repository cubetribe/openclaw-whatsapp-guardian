import { z } from 'zod';

export const ConfigSchema = z.object({
  openai: z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4o'),
    maxTokens: z.number().int().min(100).max(4000).default(1000),
    temperature: z.number().min(0).max(1).default(0.7),
  }),
  whatsapp: z.object({
    sessionName: z.string().default('guardian'),
    authDir: z.string().default('./data/auth'),
  }),
  paths: z.object({
    inbox: z.string().default('./data/inbox'),
    outbox: z.string().default('./data/outbox'),
    config: z.string().default('./config'),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),
  security: z.object({
    messageMaxLength: z.number().int().default(4000),
    blockedSenders: z.array(z.string()).default([]),
  }),
  memory: z.object({
    retentionDays: z.number().default(30),
    maxMessages: z.number().default(15),
    maxTokens: z.number().default(50000),
  }).default({}),
  webhook: z.object({
    enabled: z.boolean().default(false),
    url: z.string().url().optional(),
    timeout: z.number().default(5000),
    maxRetries: z.number().default(3),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
