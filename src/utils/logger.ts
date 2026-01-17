import { createLogger, format, transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const { combine, timestamp, errors, json, colorize, simple } = format;

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
try {
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.warn('Could not create logs directory, using console logging only:', error);
}

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
    // Always add console transport
    new transports.Console({
      format: combine(
        colorize(),
        simple()
      )
    })
  ],
});

// Add file transports only if logs directory is writable
try {
  if (existsSync(logsDir)) {
    logger.add(new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }));
    logger.add(new transports.File({ filename: path.join(logsDir, 'combined.log') }));
  }
} catch (error) {
  console.warn('Could not add file transports, using console logging only:', error);
}

export default logger;