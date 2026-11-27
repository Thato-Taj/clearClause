import crypto from 'node:crypto';
import { config } from '../config.js';

/** Salted one-way hash for identifiers we must not store raw (IPs, phone numbers, chat ids). */
export const pseudonym = (value) =>
  crypto.createHmac('sha256', config.hashSalt).update(String(value)).digest('hex').slice(0, 32);

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const SA_TZ = 'Africa/Johannesburg';

/** Calendar date in South Africa, not UTC. */
export const saDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: SA_TZ }).format(d); // YYYY-MM-DD

/** "3 checks every 14 days", "50 checks a day", "unlimited checks". */
export function allowanceText({ scans, periodDays }) {
  if (scans === -1) return 'unlimited checks';
  const noun = scans === 1 ? 'check' : 'checks';
  const period = periodDays === 1 ? 'a day' : periodDays === 7 ? 'a week' : `every ${periodDays} days`;
  return `${scans} ${noun} ${period}`;
}

/** When a check frees up, in South African time: "today at 22:30", "tomorrow at 09:00" or "Tuesday 15 December". */
export function nextCheckText(nextAt, now = Date.now()) {
  const at = new Date(nextAt);
  const day = saDate(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: SA_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  if (day === saDate(new Date(now))) return `today at ${time}`;
  if (day === saDate(new Date(now + 86_400_000))) return `tomorrow at ${time}`;
  const part = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: SA_TZ, ...opts }).format(at);
  return `${part({ weekday: 'long' })} ${part({ day: 'numeric' })} ${part({ month: 'long' })}`;
}

/** "2 of 3 checks left (you get 3 checks every 14 days)", plus when the next one frees up if none are left. */
export function usageText(usage, now = Date.now()) {
  if (!usage || usage.limit === -1) return 'Unlimited checks';
  const base = `${usage.remaining} of ${usage.limit} checks left (you get ${allowanceText({ scans: usage.limit, periodDays: usage.periodDays })})`;
  return usage.remaining === 0 && usage.nextAt ? `${base}. Next check: ${nextCheckText(usage.nextAt, now)}` : base;
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.expose = true;
    Object.assign(this, extra);
  }
}
