import express from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { log } from '../logger.js';
import { handleIncoming } from './core.js';

const API = () => `https://api.telegram.org/bot${config.telegram.token}`;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // Bot API download limit

async function call(method, body) {
  const res = await fetch(`${API()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 40_000 : 15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.description || `Telegram ${method} failed`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

async function sendMessage(chatId, text) {
  try {
    await call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  } catch (err) {
    // If our HTML was rejected (e.g. an odd character), fall back to plain text rather than staying silent.
    if (err.code === 400 && /parse/i.test(err.message)) {
      await call('sendMessage', { chat_id: chatId, text: text.replace(/<[^>]+>/g, '') });
    } else throw err;
  }
}

async function downloadFile(fileId, fallbackName, mimetype) {
  const meta = await call('getFile', { file_id: fileId });
  if (meta.file_size && meta.file_size > MAX_FILE_BYTES) {
    const e = new Error('That file is larger than 20 MB, which is the most Telegram lets bots download.');
    e.expose = true;
    throw e;
  }
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${meta.file_path}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error('Could not download the file from Telegram');
  return { buffer: Buffer.from(await res.arrayBuffer()), mimetype, originalname: fallbackName };
}

// Telegram may deliver the same update twice if we are slow; remember recent ids.
const seen = new Set();
function firstTime(updateId) {
  if (seen.has(updateId)) return false;
  seen.add(updateId);
  if (seen.size > 2000) seen.delete(seen.values().next().value);
  return true;
}

async function processUpdate(update) {
  if (!firstTime(update.update_id)) return;
  const message = update.message;
  if (!message || message.chat?.type !== 'private') return; // only 1:1 chats

  const chatId = message.chat.id;
  let getFile;
  if (message.document) {
    const d = message.document;
    getFile = () => downloadFile(d.file_id, d.file_name || 'document', d.mime_type || '');
  } else if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    getFile = () => downloadFile(largest.file_id, 'photo.jpg', 'image/jpeg');
  }

  await handleIncoming({
    channel: 'telegram',
    userId: String(chatId),
    text: message.text || message.caption || '',
    getFile,
    reply: (text) => sendMessage(chatId, text),
    typing: () => call('sendChatAction', { chat_id: chatId, action: 'typing' }),
  });
}

// ---------------------------------------------------------------------------
// Webhook (production)
// ---------------------------------------------------------------------------
export const telegramRouter = express.Router();

telegramRouter.post('/', express.json({ limit: '1mb' }), (req, res) => {
  const expected = config.telegram.webhookSecret;
  const got = req.get('x-telegram-bot-api-secret-token') || '';
  if (!expected || got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return res.sendStatus(401);
  }
  // Acknowledge immediately; analysis can take longer than Telegram's webhook timeout.
  res.sendStatus(200);
  processUpdate(req.body).catch((err) => log.error('telegram: update failed', { error: err.message }));
});

export async function registerTelegramWebhook(publicApiUrl) {
  await call('setWebhook', {
    url: `${publicApiUrl}/api/webhooks/telegram`,
    secret_token: config.telegram.webhookSecret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  });
  await setCommands();
  log.info('telegram: webhook registered');
}

async function setCommands() {
  await call('setMyCommands', {
    commands: [
      { command: 'help', description: 'How to use ClearClause' },
      { command: 'status', description: 'Checks you have left' },
      { command: 'language', description: 'Change answer language, e.g. /language isiZulu' },
      { command: 'link', description: 'Connect your account, e.g. /link 123456' },
      { command: 'unlink', description: 'Disconnect your account' },
    ],
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Long polling (local development — no public URL needed)
// ---------------------------------------------------------------------------
let polling = false;
export async function startTelegramPolling() {
  if (polling) return;
  polling = true;
  await call('deleteWebhook', { drop_pending_updates: false });
  await setCommands();
  log.info('telegram: polling for updates');
  let offset = 0;
  while (polling) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        processUpdate(u).catch((err) => log.error('telegram: update failed', { error: err.message }));
      }
    } catch (err) {
      log.warn('telegram: polling error, retrying', { error: err.message });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export function stopTelegramPolling() {
  polling = false;
}
