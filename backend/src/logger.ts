import pino from 'pino';

// Create a logger instance with pretty-printing
const logger = pino({
  level: process.env.LOG_LEVEL || 'info', 
  transport: {
    target: 'pino-pretty', 
    options: {
      colorize: true, 
      translateTime: true, 
      ignore: 'pid,hostname' 
    },
  },
});

logger.info('Logger initialized');

export default logger;