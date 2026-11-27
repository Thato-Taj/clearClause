import { config } from '../config.js';
import { db } from '../firebase.js';
import { log } from '../logger.js';
import { LANGUAGES } from '../engine/analyze.js';
import { extractInput, runScan, allowanceFor } from '../engine/pipeline.js';
import { peek } from '../services/quota.js';
import { getOrCreateUser, planInfo } from '../services/users.js';
import { getLinkedUid, redeemLinkCode, unlinkFromChat, getChatPrefs, setChatPrefs } from '../services/links.js';
import { pseudonym, usageText } from '../services/util.js';
import { formatReport } from './format.js';

/**
 * Channel-agnostic conversation logic shared by Telegram and WhatsApp.
 *
 * @typedef {object} Incoming
 * @property {'telegram'|'whatsapp'} channel
 * @property {string} userId                 chat id / phone number (never stored raw)
 * @property {string} text                   message text or caption
 * @property {() => Promise<{buffer: Buffer, mimetype: string, originalname: string}>} [getFile]
 * @property {(text: string) => Promise<void>} reply
 * @property {() => Promise<void>} [typing]
 */

async function principalFor(channel, userId) {
  const uid = await getLinkedUid(channel, userId);
  if (uid) {
    const user = await getOrCreateUser(uid);
    return { kind: 'user', ...user, quotaKey: `uid:${uid}` };
  }
  return { kind: 'chat', plan: 'free', quotaKey: `${channel}:${pseudonym(`${channel}:${userId}`)}` };
}

const languageList = LANGUAGES.join(', ');

function helpText(channel, principal, usage) {
  const b = (s) => (channel === 'telegram' ? `<b>${s}</b>` : `*${s}*`);
  const linked = principal.kind === 'user';
  return [
    `👋 ${b('Welcome to ClearClause')}`,
    'I check contracts, terms and conditions and privacy policies against South African law (POPIA, the Consumer Protection Act and more) and explain the problems in plain language.',
    '',
    b('How to use me'),
    '• Send a PDF or Word document',
    '• Send a photo of the contract',
    '• Paste the text, or send a link to the terms page',
    '',
    b('Commands'),
    '• LANGUAGE isiZulu — get answers in another language',
    `• LINK 123456 — connect to your account (get the code at ${config.webAppUrl}/account)`,
    '• UNLINK — disconnect your account',
    '• STATUS — see how many checks you have left',
    '',
    `Plan: ${linked ? planInfo(principal.plan).label + ' (linked account)' : 'Free'} · ${usageText(usage)}`,
  ].join('\n');
}

/** @param {Incoming} msg */
export async function handleIncoming(msg) {
  const { channel, userId, reply } = msg;
  const text = (msg.text || '').trim();
  const lower = text.toLowerCase();

  try {
    const principal = await principalFor(channel, userId);
    const prefs = await getChatPrefs(channel, userId);

    // ---- Commands ----------------------------------------------------------
    // "LINK 123456", "/link 123456", or a Telegram deep link "/start link_123456".
    const link = text.match(/^\/?link\s+(\d{6})$/i) || text.match(/^\/start\s+link_(\d{6})$/i);
    if (link) {
      if (!db) return reply('Account linking is not available right now.');
      const uid = await redeemLinkCode(link[1], channel, userId);
      return reply(uid
        ? '✅ Your ClearClause account is connected. Your plan now applies here and every report is saved to your account.'
        : '❌ That code is wrong or has expired. Get a new one on the website under Account.');
    }

    if (!msg.getFile && /^\/?(start|help|menu|hi|hello|hey|sawubona|molo|dumela|hallo|status)\b/.test(lower) && text.length < 40) {
      const usage = await peek(principal.quotaKey, allowanceFor(principal));
      return reply(helpText(channel, principal, usage));
    }

    if (/^\/?unlink$/i.test(text)) {
      const ok = await unlinkFromChat(channel, userId);
      return reply(ok ? 'Your account is disconnected from this chat.' : 'This chat is not connected to an account.');
    }

    if (/^\/?link$/i.test(text)) {
      return reply(`To connect your account, get a 6-digit code at ${config.webAppUrl}/account and send: LINK 123456`);
    }

    const lang = text.match(/^\/?(?:language|lang)(?:\s+(.+))?$/i);
    if (lang) {
      if (!lang[1]) return reply(`I can answer in: ${languageList}.\nSend for example: LANGUAGE isiZulu`);
      const wanted = LANGUAGES.find((l) => l.toLowerCase() === lang[1].trim().toLowerCase());
      if (!wanted) return reply(`I can answer in: ${languageList}.\nExample: LANGUAGE Sesotho`);
      await setChatPrefs(channel, userId, { language: wanted });
      return reply(`👍 I will answer in ${wanted} from now on.`);
    }

    // ---- Scan --------------------------------------------------------------
    const hasFile = Boolean(msg.getFile);
    const looksLikeUrl = /^https?:\/\/\S+$/i.test(text);
    if (!hasFile && !looksLikeUrl && text.replace(/\s/g, '').length < 200) {
      return reply('Send me the contract or terms as a PDF, Word document, photo or link — or paste the full text. Type HELP to see everything I can do.');
    }

    await reply('📄 Got it. Checking it against South African law — this usually takes under a minute…');
    msg.typing?.().catch(() => {});

    const file = hasFile ? await msg.getFile() : null;
    const extraction = await extractInput({ file, text: hasFile ? '' : text });
    const { result, scanId, quota } = await runScan({
      principal,
      extraction,
      language: prefs.language || 'English',
      channel,
      fileName: file?.originalname ?? null,
    });

    const reportUrl = scanId ? `${config.webAppUrl}/reports/${scanId}` : null;
    const style = channel === 'telegram' ? 'telegram' : 'whatsapp';
    for (const part of formatReport(result, { style, reportUrl, quota })) {
      await reply(part);
    }
    if (principal.kind !== 'user') {
      await reply(`Tip: link your free account to keep these reports — send LINK and the code from ${config.webAppUrl}/account`);
    }
  } catch (err) {
    if (err.expose) return reply(`⚠️ ${err.message}`);
    log.error('bot: failed to handle message', { channel, error: err.message });
    return reply('⚠️ Sorry, something went wrong on our side. Please try again in a minute.');
  }
}
