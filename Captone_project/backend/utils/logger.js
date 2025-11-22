const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const fileTransport = new transports.File({
  filename: path.join(logsDir, 'app.log'),
  maxsize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 5,
});

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} - ${level.toUpperCase()} - ${message}${metaString}`;
    })
  ),
  transports: [
    fileTransport,
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} - ${level} - ${message}${metaString}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
