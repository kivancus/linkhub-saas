import { createLogger, format, transports } from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = format;

// Create logger instance
const logger = createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'linkhub-saas' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      colorize(),
      simple()
    )
  }));
}

export default logger;