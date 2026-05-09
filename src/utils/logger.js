const levels = new Set(['error', 'warn', 'info', 'debug']);

export function createLogger(level = 'info') {
  return {
    log(logLevel, message, meta = undefined) {
      if (!levels.has(logLevel)) {
        return;
      }
      if (meta === undefined) {
        console.error(`[${logLevel}] ${message}`);
        return;
      }
      console.error(`[${logLevel}] ${message}`, meta);
    },
    error(message, meta) {
      this.log('error', message, meta);
    },
    warn(message, meta) {
      this.log('warn', message, meta);
    },
    info(message, meta) {
      if (level !== 'debug' && level !== 'info') {
        return;
      }
      this.log('info', message, meta);
    },
    debug(message, meta) {
      if (level !== 'debug') {
        return;
      }
      this.log('debug', message, meta);
    }
  };
}
