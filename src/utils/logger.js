const levels = new Set(['error', 'warn', 'info', 'debug']);
const priority = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export function createLogger(level = 'info') {
  const configured = priority[level] ?? priority.info;
  return {
    log(logLevel, message, meta = undefined) {
      if (!levels.has(logLevel)) {
        return;
      }
      if ((priority[logLevel] ?? priority.info) > configured) {
        return;
      }
      const writer = logLevel === 'error' || logLevel === 'warn' ? console.error : console.log;
      if (meta === undefined) {
        writer(`[${logLevel}] ${message}`);
        return;
      }
      writer(`[${logLevel}] ${message}`, meta);
    },
    error(message, meta) {
      this.log('error', message, meta);
    },
    warn(message, meta) {
      this.log('warn', message, meta);
    },
    info(message, meta) {
      this.log('info', message, meta);
    },
    debug(message, meta) {
      this.log('debug', message, meta);
    }
  };
}
