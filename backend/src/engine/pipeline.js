import { config } from '../config.js';
import { analyseDocument } from './analyze.js';
import { extractFromFile, extractFromText } from './extract.js';
import { extractFromUrl, parseUserUrl } from './fetchUrl.js';
import { consume, refund } from '../services/quota.js';
import { saveScan } from '../services/scans.js';
import { canUseBusinessMode } from '../services/users.js';
import { HttpError, allowanceText, nextCheckText } from '../services/util.js';

/**
 * @typedef {{kind: 'user'|'anonymous'|'chat', uid?: string, plan: string, quotaKey: string}} Principal
 */

/** @returns {{scans: number, periodDays: number}} */
export function allowanceFor(principal) {
  const plan = config.plans[principal.plan] ?? config.plans.free;
  return { scans: plan.scans, periodDays: plan.periodDays };
}

function quotaExceeded(principal, allowance, quota) {
  if (allowance.scans === 0) {
    return new HttpError(401, 'Please sign in to check a document. It’s free.', { code: 'auth_required', quota });
  }
  const paid = principal.plan === 'pro' || principal.plan === 'business';
  const at = quota.nextAt ? nextCheckText(quota.nextAt) : null;
  const when = at ? ` Your next ${paid ? '' : 'free '}check is available ${/^(today|tomorrow)/.test(at) ? at : `on ${at}`}.` : '';
  const hint = principal.kind === 'anonymous'
    ? ' Sign in to save your reports, or see our plans for more checks.'
    : paid ? '' : ' Upgrade your plan for more checks.';
  return new HttpError(429, `You have used all your ${paid ? '' : 'free '}checks (${allowanceText(allowance)}).${when}${hint}`, {
    code: 'quota_exceeded',
    quota,
  });
}

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

  const allowance = allowanceFor(principal);
  const { allowed, stamp, ...quota } = await consume(principal.quotaKey, allowance);
  if (!allowed) throw quotaExceeded(principal, allowance, quota);

  let result;
  try {
    result = await analyseDocument(extraction, { language, mode, hint });
  } catch (err) {
    await refund(principal.quotaKey, stamp).catch(() => {});
    throw err;
  }

  if (extraction.url) result.source.url = extraction.url;

  let scanId = null;
  if (save && principal.kind === 'user' && result.isLegalDocument) {
    scanId = await saveScan(principal.uid, result, { channel, fileName });
  }

  return { result, scanId, quota };
}
