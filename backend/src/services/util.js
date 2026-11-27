import crypto from 'node:crypto';
import { config } from '../config.js';

/** Salted one-way hash for identifiers we must not store raw (IPs, phone numbers, chat ids). */
export const pseudonym = (value) =>
  crypto.createHmac('sha256', config.hashSalt).update(String(value)).digest('hex').slice(0, 32);

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Quotas reset at midnight South African time, not UTC. */
export const saDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(d); // YYYY-MM-DD

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.expose = true;
    Object.assign(this, extra);
  }
}
