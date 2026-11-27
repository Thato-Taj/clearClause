import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { config, isProd } from './config.js';
import { log } from './logger.js';
import { db } from './firebase.js';
import { api } from './routes/api.js';
import { telegramRouter, registerTelegramWebhook, startTelegramPolling } from './bots/telegram.js';
import { whatsappRouter } from './bots/whatsapp.js';

const app = express();

app.set('trust proxy', 1); // behind Render/Railway/Cloud Run load balancer — makes req.ip the real client
app.disable('x-powered-by');
app.use(helmet());

const extensionOrigin = /^(chrome|moz|safari-web)-extension:\/\//;
app.use(
  '/api',
  cors({
    origin(origin, cb) {
      // No Origin = server-to-server / curl; extension pages have their own scheme.
      if (!origin || config.corsOrigins.includes(origin) || extensionOrigin.test(origin)) return cb(null, true);
      cb(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    methods: ['GET', 'POST', 'DELETE'],
    maxAge: 86400,
  }),
);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    accounts: Boolean(db),
    ai: Boolean(config.ai.apiKey),
    telegram: Boolean(config.telegram.token),
    whatsapp: Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId),
  });
});

app.use('/api/webhooks/telegram', telegramRouter);
app.use('/api/webhooks/whatsapp', whatsappRouter);
app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `That file is too large. The limit is ${Math.round(config.uploads.maxBytes / 1048576)} MB.`
      : 'That upload could not be read.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That text is too long.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });

  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500 && !err.expose) log.error('http: unhandled error', { path: req.path, error: err.message, stack: isProd ? undefined : err.stack });
  res.status(status).json({
    error: err.expose ? err.message : 'Something went wrong on our side. Please try again.',
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
    ...(err.quota ? { quota: err.quota } : {}),
  });
});

app.listen(config.port, (err) => {
  if (err) {
    log.error('server: could not start', { port: config.port, error: err.message });
    process.exit(1);
  }
  log.info('server: listening', { port: config.port, env: config.env, model: config.ai.model });

  if (config.telegram.token) {
    if (config.telegram.mode === 'webhook') {
      if (!config.publicApiUrl || !config.telegram.webhookSecret) {
        log.warn('telegram: set PUBLIC_API_URL and TELEGRAM_WEBHOOK_SECRET to register the webhook');
      } else {
        registerTelegramWebhook(config.publicApiUrl).catch((err) => log.error('telegram: webhook registration failed', { error: err.message }));
      }
    } else {
      startTelegramPolling().catch((err) => log.error('telegram: polling failed to start', { error: err.message }));
    }
  }
  if (!config.ai.apiKey) log.warn('ai: GEMINI_API_KEY is not set — scans will fail');
});
