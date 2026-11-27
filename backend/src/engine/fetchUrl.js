import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { InputError, extractFromFile } from './extract.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

/** Reject loopback, private, link-local, CGNAT, multicast and reserved ranges. */
export function isPublicAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false; // multicast + reserved
    return true;
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return false;
    if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice(7));
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (lower.startsWith('ff')) return false; // multicast
    return true;
  }
  return false;
}

/** DNS lookup that refuses to connect to non-public addresses (checked at connect time, so no rebinding). */
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    const blocked = list.find((a) => !isPublicAddress(a.address));
    if (blocked || !list.length) return callback(new InputError('That link points to a private address and cannot be checked.'));
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function request(url, redirectsLeft) {
  return new Promise((resolve, reject) => {
    // IP-literal hosts skip DNS (and so skip safeLookup) — check them directly.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !isPublicAddress(host)) {
      return reject(new InputError('That link points to a private address and cannot be checked.'));
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'ClearClauseBot/1.0 (+terms-and-conditions-checker)',
          Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new InputError('That link redirects too many times.'));
          let next;
          try {
            next = new URL(res.headers.location, url);
          } catch {
            return reject(new InputError('That link redirects somewhere invalid.'));
          }
          if (!['http:', 'https:'].includes(next.protocol)) return reject(new InputError('That link redirects somewhere we cannot open.'));
          return resolve(request(next, redirectsLeft - 1));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new InputError(`That page could not be opened (error ${status}).`));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new InputError('That page is too large to check.'));
          } else chunks.push(chunk);
        });
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: String(res.headers['content-type'] || ''), finalUrl: url }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new InputError('That page took too long to load.')));
    req.on('error', (err) => reject(err instanceof InputError ? err : new InputError('That page could not be opened.')));
  });
}

export function parseUserUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.username || url.password) return null;
  return url;
}

export async function extractFromUrl(raw) {
  const url = parseUserUrl(raw);
  if (!url) throw new InputError('Please send a full web link starting with https://');
  const { buffer, contentType, finalUrl } = await request(url, MAX_REDIRECTS);
  const mime = contentType.split(';')[0].trim();
  const name = finalUrl.pathname.split('/').pop() || 'page.html';
  const result = await extractFromFile(buffer, mime || 'text/html', mime === 'text/html' ? 'page.html' : name);
  if (!result.binary && result.text.replace(/\s/g, '').length < 200) {
    throw new InputError('We could not find enough text on that page. Some sites load their terms with JavaScript — copy and paste the text instead.');
  }
  return { ...result, url: finalUrl.toString() };
}
