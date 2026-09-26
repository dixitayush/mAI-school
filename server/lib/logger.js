/**
 * Structured JSON logger.
 * PRD section 64
 *
 * In production: JSON lines to stdout.
 * In development: human-readable format.
 */

const isProd = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return (LEVELS[level] ?? 0) >= currentLevel;
}

function formatEntry(level, service, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: service || 'maischool',
    message,
    ...fields,
  };

  // Never log secrets
  delete entry.password;
  delete entry.jwt;
  delete entry.token;
  delete entry.api_key;

  return entry;
}

function logJson(entry) {
  const str = JSON.stringify(entry);
  if (entry.level === 'error') {
    process.stderr.write(str + '\n');
  } else {
    process.stdout.write(str + '\n');
  }
}

function logHuman(entry) {
  const { timestamp, level, service, message, ...rest } = entry;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  const line = `[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}${extra}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function log(level, service, message, fields) {
  if (!shouldLog(level)) return;
  const entry = formatEntry(level, service, message, fields);
  if (isProd) {
    logJson(entry);
  } else {
    logHuman(entry);
  }
}

const logger = {
  debug: (service, message, fields) => log('debug', service, message, fields),
  info: (service, message, fields) => log('info', service, message, fields),
  warn: (service, message, fields) => log('warn', service, message, fields),
  error: (service, message, fields) => log('error', service, message, fields),
};

function requestLogger() {
  return (req, res, next) => {
    if (req.path === '/health' || req.path === '/ready' || req.path === '/api/health') {
      return next();
    }

    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const origEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;
      logger.info('http', `${req.method} ${req.path} ${res.statusCode}`, {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        tenant_id: req.auth?.institution_id || null,
        user_id: req.auth?.user_id || null,
        ip: req.ip,
      });
      origEnd.apply(this, args);
    };

    next();
  };
}

module.exports = { logger, requestLogger };
