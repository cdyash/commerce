import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-admin-key"]',
      'headers.authorization',
      'headers["x-admin-key"]',
      'authorization',
      'adminKey',
      'token',
      'secret',
      'paymentSessionToken',
      '*.token',
      '*.secret',
      '*.paymentSessionToken',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

