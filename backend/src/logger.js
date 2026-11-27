// Tiny structured logger. Never pass document text, phone numbers or keys in `meta`.
const write = (level, msg, meta) => {
  const line = { t: new Date().toISOString(), level, msg, ...(meta || {}) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
};

export const log = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
