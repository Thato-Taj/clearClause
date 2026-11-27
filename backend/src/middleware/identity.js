import { auth } from '../firebase.js';
import { resolveApiKey } from '../services/apiKeys.js';
import { getOrCreateUser } from '../services/users.js';
import { pseudonym, HttpError } from '../services/util.js';

const userPrincipal = (user) => ({ kind: 'user', ...user, quotaKey: `uid:${user.uid}` });

/**
 * Works out who is calling. Never trusts client-supplied identifiers:
 *  - `Authorization: Bearer <Firebase ID token>` from the website
 *  - `X-API-Key: cc_...` from the browser extension or Business API clients
 *  - otherwise anonymous, rate-limited by a hash of the IP address
 */
export async function identify(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const apiKey = req.get('x-api-key');

    if (header.startsWith('Bearer ')) {
      if (!auth) throw new HttpError(503, 'Accounts are temporarily unavailable.');
      let decoded;
      try {
        decoded = await auth.verifyIdToken(header.slice(7));
      } catch {
        throw new HttpError(401, 'Your session has expired. Please sign in again.', { code: 'auth_expired' });
      }
      req.principal = userPrincipal(await getOrCreateUser(decoded.uid, { email: decoded.email ?? null, name: decoded.name ?? null }));
    } else if (apiKey) {
      const uid = await resolveApiKey(apiKey);
      if (!uid) throw new HttpError(401, 'That access key is not valid. Create a new one in your account settings.', { code: 'bad_api_key' });
      req.principal = userPrincipal(await getOrCreateUser(uid));
    } else {
      req.principal = { kind: 'anonymous', plan: 'anonymous', quotaKey: `anon:${pseudonym(req.ip)}` };
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req, _res, next) {
  if (req.principal?.kind !== 'user') return next(new HttpError(401, 'Please sign in first.', { code: 'auth_required' }));
  next();
}
