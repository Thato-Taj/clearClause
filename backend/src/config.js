import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.SKIP_DOTENV) dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

const list = (v, fallback = []) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

const int = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5001),

  /** Public URL of the website, used for links in bot messages. */
  webAppUrl: (process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  /** Public URL of this API (used to register the Telegram webhook). */
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),

  /** Browser origins allowed to call the API. Browser-extension origins are always allowed. */
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:3000']),

  /** Secret used to hash IPs / phone numbers so we never store them raw (POPIA minimisation). */
  hashSalt: process.env.HASH_SALT || 'dev-only-salt-change-me',

  ai: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    // On the free tier the newest models (gemini-3.7/3.8-flash) are often too busy to answer, so the default is
    // the newest one that reliably responds. On a paid key, try GEMINI_MODEL=gemini-3.8-flash.
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    /** Tried in order when the main model is busy, slow or out of free quota. Each model has its own capacity and quota. */
    fallbackModels: list(process.env.GEMINI_FALLBACK_MODELS, ['gemini-3.5-flash-lite', 'gemini-2.5-flash']),
    /** Hard cap on characters sent to the model, to bound cost per scan. */
    maxChars: int(process.env.MAX_DOCUMENT_CHARS, 200_000),
  },

  uploads: {
    maxBytes: int(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
  },

  /**
   * Checks allowed per plan, in a rolling window: each check counts for `periodDays` after it was used, then frees up.
   * scans: -1 = unlimited, 0 = must sign in. Guests and WhatsApp/Telegram users share the Free allowance.
   */
  plans: {
    anonymous: { label: 'Guest', scans: int(process.env.QUOTA_ANON, 3), periodDays: int(process.env.QUOTA_ANON_DAYS, 14) },
    free: { label: 'Free', scans: int(process.env.QUOTA_FREE, 3), periodDays: int(process.env.QUOTA_FREE_DAYS, 14) },
    pro: { label: 'Pro', scans: int(process.env.QUOTA_PRO, 50), periodDays: int(process.env.QUOTA_PRO_DAYS, 1) },
    business: { label: 'Business', scans: int(process.env.QUOTA_BUSINESS, -1), periodDays: 1 },
  },

  firebase: {
    /** Either a path to the service-account JSON or the JSON itself (handy on Render/Railway). */
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  },

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    /** Random string Telegram echoes back in X-Telegram-Bot-Api-Secret-Token. */
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    /** 'webhook' in production, 'polling' for local development without a public URL. */
    mode: process.env.TELEGRAM_MODE || (process.env.NODE_ENV === 'production' ? 'webhook' : 'polling'),
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'ClearClauseBot',
  },

  whatsapp: {
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v26.0',
    displayNumber: process.env.WHATSAPP_DISPLAY_NUMBER || '',
  },
};

export const isProd = config.env === 'production';
