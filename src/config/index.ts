import { ConfigSchema, type Config } from './schema';
import { getEnvString, getEnvNumber, getEnvArray, getEnvBoolean, resolvePath } from './env';

export function loadConfig(): Config {
  const rawConfig = {
    openai: {
      apiKey: getEnvString('OPENAI_API_KEY'),
      model: getEnvString('OPENAI_MODEL', 'gpt-4o'),
      maxTokens: getEnvNumber('OPENAI_MAX_TOKENS', 1000),
      temperature: getEnvNumber('OPENAI_TEMPERATURE', 0.7),
    },
    whatsapp: {
      sessionName: getEnvString('WHATSAPP_SESSION_NAME', 'guardian'),
      authDir: resolvePath(getEnvString('WHATSAPP_AUTH_DIR', './data/auth')),
    },
    paths: {
      inbox: resolvePath(getEnvString('INBOX_DIR', './data/inbox')),
      outbox: resolvePath(getEnvString('OUTBOX_DIR', './data/outbox')),
      config: resolvePath(getEnvString('CONFIG_DIR', './config')),
    },
    logging: {
      level: getEnvString('LOG_LEVEL', 'info') as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    },
    security: {
      messageMaxLength: getEnvNumber('MESSAGE_MAX_LENGTH', 4000),
      blockedSenders: getEnvArray('BLOCKED_SENDERS', []),
    },
    memory: {
      retentionDays: getEnvNumber('MEMORY_RETENTION_DAYS', 30),
      maxMessages: getEnvNumber('MEMORY_MAX_MESSAGES', 15),
      maxTokens: getEnvNumber('MEMORY_MAX_TOKENS', 50000),
    },
    webhook: {
      enabled: getEnvBoolean('WEBHOOK_ENABLED', false),
      url: process.env.WEBHOOK_URL,
      timeout: getEnvNumber('WEBHOOK_TIMEOUT', 5000),
      maxRetries: getEnvNumber('WEBHOOK_MAX_RETRIES', 3),
    },
  };

  return ConfigSchema.parse(rawConfig);
}

export { Config, ConfigSchema };
