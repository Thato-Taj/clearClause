import { config } from '../config.js';
import { analyseDocument } from './analyze.js';
import { extractFromFile, extractFromText } from './extract.js';
import { extractFromUrl, parseUserUrl } from './fetchUrl.js';
import { consume, refund } from '../services/quota.js';
import { saveScan } from '../services/scans.js';
import { canUseBusinessMode } from '../services/users.js';
import { HttpError } from '../services/util.js';

/**
 * @typedef {{kind: 'user'|'anonymous'|'chat', uid?: string, plan: string, quotaKey: string}} Principal
 */

export const dailyLimit = (principal) => (config.plans[principal.plan] ?? config.plans.free).dailyScans;

/** Turn whatever the user gave us into an extraction, before any quota is charged. */
export async function extractInput({ file, text, url }) {
  if (file) return extractFromFile(file.buffer, file.mimetype, file.originalname);
  if (url) return extractFromUrl(url);
  const trimmed = (text || '').trim();
  // A message that is only a link: fetch the page.
  if (trimmed && !/\s/.test(trimmed) && parseUserUrl(trimmed)) return extractFromUrl(trimmed);
  return extractFromText(text);
}

/**
 * The one scan path used by the website, the extension, the API and both bots.
 * @param {{principal: Principal, extraction: object, language?: string, mode?: string, hint?: string,
 *          save?: boolean, channel?: string, fileName?: string|null}} args
 */
export async function runScan({ principal, extraction, language, mode, hint, save = true, channel = 'web', fileName = null }) {
  if (mode === 'business' && !canUseBusinessMode(principal.plan)) {
    throw new HttpError(403, 'Compliance mode (fix suggestions for your own documents) is part of the Business plan.', { code: 'plan_required' });
  }

  const limit = dailyLimit(principal);
  const quota = await consume(principal.quotaKey, limit);
  if (!quota.allowed) {
    const signInHint = principal.kind === 'anonymous' ? ' Sign in for history, or upgrade for more scans.' : ' Upgrade your plan for more scans.';
    throw new HttpError(429, `You have used all ${limit} free scans for today. They reset at midnight.${signInHint}`, {
      code: 'quota_exceeded',
      quota,
    });
  }

  let result;
  try {
    result = await analyseDocument(extraction, { language, mode, hint });
  } catch (err) {
    await refund(principal.quotaKey).catch(() => {});
    throw err;
  }

  if (extraction.url) result.source.url = extraction.url;

  let scanId = null;
  if (save && principal.kind === 'user' && result.isLegalDocument) {
    scanId = await saveScan(principal.uid, result, { channel, fileName });
  }

  return { result, scanId, quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining } };
}
