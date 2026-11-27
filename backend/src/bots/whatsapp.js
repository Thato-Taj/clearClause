import express from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { log } from '../logger.js';
import { handleIncoming } from './core.js';

const graph = (path) => `https://graph.facebook.com/${config.whatsapp.graphVersion}/${path}`;
const authHeader = () => ({ Authorization: `Bearer ${config.whatsapp.token}` });
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function sendText(to, body) {
  const res = await fetch(graph(`${config.whatsapp.phoneNumberId}/messages`), {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `WhatsApp send failed (${res.status})`);
  }
}

/** Marks the message as read and shows "typing…" while we work. */
async function markReadAndTyping(messageId) {
  await fetch(graph(`${config.whatsapp.phoneNumberId}/messages`), {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }),
    signal: AbortSignal.timeout(10_000),
  });
}

async function downloadMedia(mediaId, fallbackName) {
  const metaRes = await fetch(graph(mediaId), { headers: authHeader(), signal: AbortSignal.timeout(15_000) });
  const meta = await metaRes.json();
  if (!metaRes.ok || !meta.url) throw new Error('Could not look up WhatsApp media');
  if (meta.file_size && meta.file_size > MAX_FILE_BYTES) {
    const e = new Error('That file is too large. Please send a file under 10 MB.');
    e.expose = true;
    throw e;
  }
  const fileRes = await fetch(meta.url, { headers: authHeader(), signal: AbortSignal.timeout(30_000) });
  if (!fileRes.ok) throw new Error('Could not download WhatsApp media');
  return { buffer: Buffer.from(await fileRes.arrayBuffer()), mimetype: meta.mime_type || '', originalname: fallbackName };
}

const seen = new Set();
function firstTime(id) {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 2000) seen.delete(seen.values().next().value);
  return true;
}

async function processMessage(message) {
  if (!firstTime(message.id)) return;
  const from = message.from; // E.164 without "+"

  let text = '';
  let getFile;
  switch (message.type) {
    case 'text':
      text = message.text?.body || '';
      break;
    case 'document':
      text = message.document.caption || '';
      getFile = () => downloadMedia(message.document.id, message.document.filename || 'document');
      break;
    case 'image':
      text = message.image.caption || '';
      getFile = () => downloadMedia(message.image.id, 'photo.jpg');
      break;
    default:
      await sendText(from, 'I can read PDFs, Word documents, photos, links and pasted text. Voice notes and videos are not supported yet.');
      return;
  }

  await handleIncoming({
    channel: 'whatsapp',
    userId: from,
    text,
    getFile,
    reply: (body) => sendText(from, body),
    typing: () => markReadAndTyping(message.id),
  });
}

export const whatsappRouter = express.Router();

// Meta calls this once when you configure the webhook in the App Dashboard.
whatsappRouter.get('/', (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe' && config.whatsapp.verifyToken && req.query['hub.verify_token'] === config.whatsapp.verifyToken;
  if (!ok) return res.sendStatus(403);
  res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
});

whatsappRouter.post(
  '/',
  // Keep the raw bytes: the signature is computed over them.
  express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }),
  (req, res) => {
    const signature = req.get('x-hub-signature-256') || '';
    const expected = `sha256=${crypto.createHmac('sha256', config.whatsapp.appSecret).update(req.rawBody || '').digest('hex')}`;
    if (!config.whatsapp.appSecret || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.sendStatus(401);
    }
    res.sendStatus(200); // acknowledge fast; Meta retries slow webhooks

    for (const entry of req.body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        for (const message of change.value?.messages ?? []) {
          processMessage(message).catch((err) => log.error('whatsapp: message failed', { error: err.message }));
        }
      }
    }
  },
);
