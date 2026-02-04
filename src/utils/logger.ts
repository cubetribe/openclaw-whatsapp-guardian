import pino from 'pino';

const PHONE_PATTERN = /\+?\d{10,15}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function redactPII(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(PHONE_PATTERN, '[PHONE_REDACTED]')
      .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map(redactPII);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = redactPII(val);
    }
    return result;
  }
  return value;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

const enhancedLogger = new Proxy(logger, {
  get(target, prop) {
    if (prop === 'info' || prop === 'error' || prop === 'warn' || prop === 'debug') {
      return function(...args: unknown[]) {
        // If no arguments, return
        if (args.length === 0) return;

        // Redact PII
        const redactedArgs = args.map(redactPII);

        // If first argument is an object without a string, prepend an empty string
        if (typeof redactedArgs[0] === 'object' && !redactedArgs.some(arg => typeof arg === 'string')) {
          redactedArgs.unshift('');
        }

        // Call the logger with properly typed arguments
        return (target[prop] as (...args: any[]) => void)(...redactedArgs);
      };
    }
    // @ts-ignore
    return target[prop];
  }
});

export default enhancedLogger;
