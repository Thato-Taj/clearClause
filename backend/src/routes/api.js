import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { db } from '../firebase.js';
import { ACTS, SEVERITY_LABELS } from '../engine/acts.js';
import { LANGUAGES, DOCUMENT_TYPES, translateResult } from '../engine/analyze.js';
import { SEVERITY_WEIGHTS, BANDS } from '../engine/scoring.js';
import { extractInput, runScan, dailyLimit } from '../engine/pipeline.js';
import { identify, requireUser } from '../middleware/identity.js';
import { peek } from '../services/quota.js';
import { listScans, getScan, deleteScan, updateScan, deleteAllUserData } from '../services/scans.js';
import { createLinkCode, unlinkFromAccount, CHANNELS } from '../services/links.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/apiKeys.js';
import { planInfo } from '../services/users.js';
import { HttpError } from '../services/util.js';

export const api = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 10 },
});

// Quotas are the real limit; this just stops floods and scripted abuse.
const scanLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes.' },
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// Public reference data (lets every client render the same labels & methodology)
// ---------------------------------------------------------------------------
api.get('/meta', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    languages: LANGUAGES,
    documentTypes: DOCUMENT_TYPES,
    acts: Object.values(ACTS).map(({ id, short, name, plain }) => ({ id, short, name, plain })),
    severities: SEVERITY_LABELS,
    scoring: { weights: SEVERITY_WEIGHTS, bands: BANDS },
    plans: Object.fromEntries(['anonymous', 'free', 'pro', 'business'].map((p) => [p, config.plans[p]])),
  });
});

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------
api.post(
  '/analyze',
  scanLimiter,
  express.json({ limit: '2mb' }),
  upload.single('file'),
  identify,
  wrap(async (req, res) => {
    const body = req.body || {};
    const extraction = await extractInput({ file: req.file, text: body.text, url: body.url });
    const { result, scanId, quota } = await runScan({
      principal: req.principal,
      extraction,
      language: body.language,
      mode: body.mode,
      hint: body.documentType,
      save: body.save !== 'false' && body.save !== false,
      channel: body.channel === 'extension' ? 'extension' : 'web',
      fileName: req.file?.originalname?.slice(0, 120) ?? (extraction.url ? new URL(extraction.url).hostname : null),
    });
    res.json({ result, scanId, quota });
  }),
);

api.post(
  '/translate',
  scanLimiter,
  express.json({ limit: '512kb' }),
  identify,
  wrap(async (req, res) => {
    const { scanId, result, language } = req.body || {};
    if (scanId) {
      if (req.principal.kind !== 'user') throw new HttpError(401, 'Please sign in first.');
      const scan = await getScan(req.principal.uid, String(scanId));
      if (!scan) throw new HttpError(404, 'That report was not found.');
      const translated = await translateResult(scan, language);
      const { id, createdAt, ...stored } = translated;
      await updateScan(req.principal.uid, scan.id, stored);
      return res.json({ result: translated, scanId: scan.id });
    }
    if (!result || !Array.isArray(result.clauses)) throw new HttpError(400, 'Nothing to translate.');
    res.json({ result: await translateResult(result, language) });
  }),
);

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
api.get(
  '/me',
  identify,
  wrap(async (req, res) => {
    const p = req.principal;
    const usage = await peek(p.quotaKey, dailyLimit(p));
    if (p.kind !== 'user') {
      return res.json({ user: null, plan: planInfo('anonymous'), usage, accountsEnabled: Boolean(db) });
    }
    res.json({
      user: { uid: p.uid, email: p.email, name: p.name, links: p.links },
      plan: planInfo(p.plan),
      usage,
      accountsEnabled: Boolean(db),
    });
  }),
);

api.delete(
  '/me',
  identify,
  requireUser,
  wrap(async (req, res) => {
    await deleteAllUserData(req.principal.uid);
    res.json({ deleted: true });
  }),
);

api.get('/scans', identify, requireUser, wrap(async (req, res) => {
  res.json({ scans: await listScans(req.principal.uid) });
}));

api.get('/scans/:id', identify, requireUser, wrap(async (req, res) => {
  const scan = await getScan(req.principal.uid, req.params.id);
  if (!scan) throw new HttpError(404, 'That report was not found.');
  res.json({ scan });
}));

api.delete('/scans/:id', identify, requireUser, wrap(async (req, res) => {
  const ok = await deleteScan(req.principal.uid, req.params.id);
  if (!ok) throw new HttpError(404, 'That report was not found.');
  res.json({ deleted: true });
}));

// Bot linking
api.post('/links/code', identify, requireUser, wrap(async (req, res) => {
  res.json(await createLinkCode(req.principal.uid));
}));

api.delete('/links/:channel', identify, requireUser, wrap(async (req, res) => {
  if (!CHANNELS.includes(req.params.channel)) throw new HttpError(400, 'Unknown channel.');
  await unlinkFromAccount(req.principal.uid, req.params.channel);
  res.json({ unlinked: true });
}));

// Access keys (extension + Business API)
api.get('/keys', identify, requireUser, wrap(async (req, res) => {
  res.json({ keys: await listApiKeys(req.principal.uid) });
}));

api.post('/keys', express.json(), identify, requireUser, wrap(async (req, res) => {
  res.status(201).json(await createApiKey(req.principal.uid, req.body?.label));
}));

api.delete('/keys/:id', identify, requireUser, wrap(async (req, res) => {
  const ok = await revokeApiKey(req.principal.uid, req.params.id);
  if (!ok) throw new HttpError(404, 'Key not found.');
  res.json({ revoked: true });
}));
