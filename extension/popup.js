/* global CLEARCLAUSE_CONFIG, chrome, browser */
'use strict';

// Firefox exposes promise-based `browser`; Chrome/Edge/Brave MV3 return promises from `chrome`.
const ext = typeof browser !== 'undefined' ? browser : chrome;
const CFG = CLEARCLAUSE_CONFIG;

// Mirrors frontend/lib/site.ts so the popup says the same things as the website.
const LANGUAGES = [
  'English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sepedi', 'Setswana',
  'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele',
];
const SEVERITY = { violation: 'Breaks the law', concern: 'Unfair or risky', vague: 'Unclear wording' };
const SEVERITY_ORDER = ['violation', 'concern', 'vague'];
const BAND_LABEL = {
  clear: 'No issues found',
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
  critical: 'Critical risk',
};
/** [short, full name, plain description] — mirrors frontend/lib/site.ts. */
const ACTS = {
  POPIA: ['POPIA', 'Protection of Personal Information Act', 'How companies collect, use, share and keep your personal information.'],
  CPA: ['CPA', 'Consumer Protection Act', 'Your rights when you buy goods or services from a business.'],
  NCA: ['NCA', 'National Credit Act', 'Your rights when you borrow money or buy on credit.'],
  ECTA: ['ECTA', 'Electronic Communications and Transactions Act', 'Rules for online shopping, websites and agreements you accept online.'],
  BCEA: ['BCEA', 'Basic Conditions of Employment Act', 'Minimum rules for working hours, leave, pay and deductions.'],
  LRA: ['LRA', 'Labour Relations Act', 'Protection from unfair dismissal and unfair treatment at work.'],
  RHA: ['Rental Housing', 'Rental Housing Act', 'Rights of tenants and landlords in a home rental.'],
};

/** Keys written by the old popup (≤1.0). `analysisHTML` held unsanitised markup, so it must go. */
const LEGACY_KEYS = ['contractText', 'analysisHTML', 'hasResults', 'customApiKey', 'lastAnalysisData'];
const SCAN_TIMEOUT_MS = 150_000;

const state = { accessKey: '', me: null, busy: false };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

/** Builds DOM without innerHTML — scanned pages and model output are untrusted. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) if (child != null && child !== false && child !== '') node.append(child);
  return node;
}

const webUrl = (path = '') => `${CFG.webUrl}${path}`;
const webLink = (path, text, className = 'link') =>
  el('a', { class: className, href: webUrl(path), target: '_blank', rel: 'noopener', text });

const store = {
  get: (keys) => ext.storage.local.get(keys),
  set: (items) => ext.storage.local.set(items),
  remove: (keys) => ext.storage.local.remove(keys),
};

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const isLink = (text) => /^https?:\/\/\S+$/i.test(text);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, { method = 'GET', body, timeoutMs = 20_000 } = {}) {
  const headers = {};
  if (state.accessKey) headers['X-API-Key'] = state.accessKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${CFG.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(
      err.name === 'AbortError'
        ? 'ClearClause took too long to answer. Please try again.'
        : 'We could not reach ClearClause. Check your internet connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.code);
  return data;
}

// ---------------------------------------------------------------------------
// Account status line
// ---------------------------------------------------------------------------
function quotaText(q) {
  if (!q) return '';
  if (q.limit === -1) return 'unlimited scans';
  const per = q.periodDays === 1 ? 'a day' : `every ${q.periodDays} days`;
  return `${q.remaining} of ${q.limit} scans left (${q.limit} ${per})`;
}

function renderStatus() {
  const status = $('status');
  const me = state.me;
  if (!me) return;
  if (!me.user) {
    status.replaceChildren(el('strong', { text: 'Guest' }), ` · ${quotaText(me.usage)}`);
    return;
  }
  const who = me.user.email || me.user.name || 'Signed in';
  status.replaceChildren(el('strong', { text: who }), ` · ${me.plan.label} plan · ${quotaText(me.usage)}`);
}

async function refreshStatus() {
  try {
    state.me = await api('/api/me');
    renderStatus();
  } catch (err) {
    state.me = null;
    const status = $('status');
    if (err.code === 'bad_api_key') {
      status.replaceChildren(
        'Your access key no longer works. ',
        el('button', { class: 'link', type: 'button', text: 'Update it', onclick: () => toggleSettings(true) }),
      );
    } else {
      status.textContent = err.status === 0 ? 'Can’t reach ClearClause right now.' : err.message;
    }
  }
}

// ---------------------------------------------------------------------------
// Settings (access key)
// ---------------------------------------------------------------------------
function toggleSettings(force) {
  const open = force ?? $('settings').hidden;
  $('settings').hidden = !open;
  $('settingsBtn').setAttribute('aria-expanded', String(open));
  if (open) $('accessKey').focus();
}

function setKeyMessage(text, isError = false) {
  $('keyMessage').textContent = text;
  $('keyMessage').classList.toggle('is-error', isError);
}

async function saveKey() {
  const value = $('accessKey').value.trim();
  if (!value) return setKeyMessage('Paste your access key first.', true);
  if (!value.startsWith('cc_')) return setKeyMessage('Access keys start with “cc_”. Copy the whole key from your account page.', true);

  const previous = state.accessKey;
  state.accessKey = value;
  $('saveKeyBtn').disabled = true;
  try {
    state.me = await api('/api/me');
    await store.set({ accessKey: value });
    renderStatus();
    $('removeKeyBtn').hidden = false;
    setKeyMessage(`Saved. Your scans now use ${state.me.user?.email || 'your account'} and are kept in your reports.`);
  } catch (err) {
    if (err.status === 0) {
      // Can't verify offline — keep it; the next scan will tell them if it's wrong.
      await store.set({ accessKey: value });
      $('removeKeyBtn').hidden = false;
      setKeyMessage('Saved, but we couldn’t check it right now.');
    } else {
      state.accessKey = previous;
      setKeyMessage(err.message, true);
    }
  } finally {
    $('saveKeyBtn').disabled = false;
  }
}

async function removeKey() {
  await store.remove('accessKey');
  state.accessKey = '';
  $('accessKey').value = '';
  $('removeKeyBtn').hidden = true;
  setKeyMessage('Key removed. You’re scanning as a guest.');
  refreshStatus();
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
let draftTimer;
function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => store.set({ draft: $('docText').value }), 300);
}

function showError(message, extra) {
  const box = $('error');
  // replaceChildren() would print a null as the text "null", so only pass real nodes.
  box.replaceChildren(...[el('p', { text: message }), extra && el('p', {}, extra)].filter(Boolean));
  box.hidden = false;
}

function hideError() {
  $('error').hidden = true;
}

async function grabPage() {
  hideError();
  $('grabNote').textContent = '';
  let tab;
  try {
    [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  } catch {
    // handled below
  }
  if (!tab?.id) return showError('There’s no page to read.');

  let out;
  try {
    const [injection] = await ext.scripting.executeScript({
      target: { tabId: tab.id },
      // Runs in the page. A real selection wins, so people can check just one section.
      func: () => {
        const selection = String(window.getSelection?.() ?? '').trim();
        if (selection.length >= 200) return { text: selection, from: 'selection' };
        return { text: document.body ? document.body.innerText : '', from: 'page' };
      },
    });
    out = injection?.result;
  } catch {
    return showError('Your browser doesn’t let extensions read this page (for example settings pages and web stores). Copy the text and paste it in instead.');
  }

  const text = (out?.text || '').trim();
  if (!text) return showError('We couldn’t find any text on this page. Copy the terms and paste them in instead.');

  const clipped = text.slice(0, CFG.maxChars);
  $('docText').value = clipped;
  await store.set({ draft: clipped });
  const where = hostOf(tab.url) || 'this page';
  const count = clipped.length.toLocaleString('en-ZA');
  $('grabNote').textContent =
    `${out.from === 'selection' ? 'Took your selected text' : 'Took the text'} from ${where} (${count} characters).` +
    (text.length > clipped.length ? ' It was too long, so only the first part will be checked.' : '');
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
function setBusy(busy) {
  state.busy = busy;
  $('analyzeBtn').disabled = busy;
  $('grabBtn').disabled = busy;
  $('language').disabled = busy;
  $('docText').readOnly = busy;
  $('loading').hidden = !busy;
}

function showApiError(err) {
  let extra = null;
  if (err.code === 'bad_api_key') {
    extra = el('button', { class: 'link', type: 'button', text: 'Update your access key', onclick: () => toggleSettings(true) });
  } else if (err.code === 'quota_exceeded') {
    extra = webLink('/pricing', 'See plans');
  }
  showError(err.message, extra);
}

async function analyze(event) {
  event.preventDefault();
  if (state.busy) return;
  hideError();

  const text = $('docText').value.trim();
  if (!text) return showError('Paste some text first, or press “Use this page”.');
  if (!isLink(text) && text.replace(/\s/g, '').length < 80) {
    return showError('That’s too short to check. Paste the full terms, contract or policy.');
  }

  setBusy(true);
  // If the popup closes mid-scan this survives, so we can explain what happened next time.
  await store.set({ pending: { startedAt: Date.now(), signedIn: Boolean(state.accessKey) } });
  try {
    const data = await api('/api/analyze', {
      method: 'POST',
      body: { text: text.slice(0, CFG.maxChars), language: $('language').value, channel: 'extension' },
      timeoutMs: SCAN_TIMEOUT_MS,
    });
    const last = { result: data.result, scanId: data.scanId ?? null, at: Date.now() };
    await store.set({ last });
    if (state.me && data.quota) {
      state.me.usage = data.quota;
      renderStatus();
    }
    showResults(last);
  } catch (err) {
    showApiError(err);
  } finally {
    await store.remove('pending');
    setBusy(false);
  }
}

async function newScan() {
  await store.remove(['last', 'draft']);
  $('docText').value = '';
  $('grabNote').textContent = '';
  $('results').hidden = true;
  $('results').replaceChildren();
  $('scanView').hidden = false;
  $('docText').focus();
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function scoreCard(scores) {
  const { overall, band, counts } = scores;
  const fill = el('div', { class: `bar-fill fill-${band}` });
  fill.style.width = `${Math.max(overall, overall === 0 ? 0 : 3)}%`;

  return el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'score-line' },
      el('span', { class: `score-num band-${band}`, text: String(overall) }),
      el('span', { class: 'score-of', text: '/ 100' }),
      el('span', { class: `band-label band-${band}`, text: BAND_LABEL[band] || scores.bandLabel }),
    ),
    el(
      'div',
      { class: 'bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': overall, 'aria-label': `Risk score ${overall} out of 100` },
      fill,
      [25, 50, 75].map((t) => {
        const tick = el('span', { class: 'bar-tick', 'aria-hidden': 'true' });
        tick.style.left = `${t}%`;
        return tick;
      }),
    ),
    el('p', { class: 'hint score-help', text: '0 means we found no problems. The higher the number, the less this document follows the law.' }),
    el(
      'dl',
      { class: 'counts' },
      SEVERITY_ORDER.map((s) =>
        el('div', { class: `sev-${s}` }, el('dt', { text: s === 'vague' ? 'Unclear' : SEVERITY[s] }), el('dd', { text: String(counts?.[s] ?? 0) })),
      ),
    ),
  );
}

function findingItem(clause, open) {
  const severity = SEVERITY[clause.severity] ? clause.severity : 'concern';
  return el(
    'li',
    {},
    el(
      'details',
      { class: `finding sev-${severity}`, open },
      el(
        'summary',
        {},
        el('span', { class: 'finding-meta' }, el('span', { class: 'chip', text: SEVERITY[severity] }), clause.reference && el('span', { class: 'ref', text: clause.reference })),
        el('span', { class: 'finding-title', text: clause.title }),
      ),
      el(
        'div',
        { class: 'finding-body' },
        clause.quote && el('blockquote', { class: 'quote' }, el('mark', { text: `“${clause.quote}”` })),
        clause.quote && clause.quoteVerified === false &&
          el('p', { class: 'hint quote-note', text: 'We couldn’t match this wording exactly in the text — check the original clause.' }),
        el('h3', { text: 'What this means' }),
        el('p', { text: clause.explanation }),
        el('h3', { text: 'What you can do' }),
        el('p', { text: clause.action }),
        lawList(clause.acts),
      ),
    ),
  );
}

/** One line per Act with its sections merged ("CPA s 48, s 51"), its name and what it covers. */
function lawList(acts) {
  if (!acts?.length) return null;
  const byAct = new Map();
  for (const { act, section } of acts) {
    const sections = byAct.get(act) ?? [];
    if (section && !sections.includes(section)) sections.push(section);
    byAct.set(act, sections);
  }
  return [
    el('h3', { text: byAct.size === 1 ? 'The law' : 'The laws' }),
    el(
      'ul',
      { class: 'acts', 'aria-label': 'Laws involved' },
      [...byAct].map(([act, sections]) => {
        const [short, name, plain] = ACTS[act] ?? [act, act, ''];
        return el(
          'li',
          {},
          el('span', { class: 'act-chip', text: sections.length ? `${short} ${sections.join(', ')}` : short }),
          el('span', { class: 'act-text' }, el('strong', { text: name }), plain && ` — ${plain}`),
        );
      }),
    ),
  ];
}

function showResults({ result: r, scanId }) {
  const root = $('results');
  const parts = [el('p', { class: 'eyebrow', text: r.documentType || 'Document' }), el('h1', { id: 'resultTitle', text: r.title || 'Untitled document' })];

  if (!r.isLegalDocument) {
    parts.push(
      el(
        'div',
        { class: 'card' },
        el('p', { text: 'This doesn’t look like a contract, terms or policy, so there’s nothing to score.' }),
        r.summary && el('p', { class: 'hint', text: r.summary }),
      ),
    );
  } else {
    parts.push(scoreCard(r.scores));
    if (r.source?.truncated) {
      parts.push(el('p', { class: 'notice', text: 'This document is very long, so only the first part was checked.' }));
    }
    parts.push(el('h2', { text: 'In short' }), el('p', { class: 'summary-text', text: r.summary }));

    const clauses = [...(r.clauses || [])].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    parts.push(el('h2', { text: `What we found (${clauses.length})` }));
    parts.push(
      clauses.length
        ? el('ol', { class: 'findings' }, clauses.map((c, i) => findingItem(c, i === 0)))
        : el('p', { class: 'summary-text', text: 'We didn’t find any problems in this document.' }),
    );

    if (r.positives?.length) {
      parts.push(el('h2', { text: 'What’s fair' }), el('ul', { class: 'positives' }, r.positives.map((p) => el('li', { text: p }))));
    }
    if (r.verdict) {
      parts.push(el('div', { class: 'card verdict' }, el('h2', { text: 'Our advice' }), el('p', { text: r.verdict })));
    }
  }

  parts.push(
    el(
      'div',
      { class: 'actions' },
      scanId && webLink(`/reports/${encodeURIComponent(scanId)}`, 'Open full report', 'btn primary'),
      el('button', { class: scanId ? 'btn secondary' : 'btn primary', type: 'button', text: 'Check another', onclick: newScan }),
    ),
  );
  if (scanId) {
    parts.push(el('p', { class: 'hint save-hint', text: 'Saved to your reports. Open it to translate, print or save as PDF.' }));
  } else if (!state.accessKey && r.isLegalDocument) {
    parts.push(
      el(
        'p',
        { class: 'hint save-hint' },
        'Want to keep this? ',
        el('button', { class: 'link', type: 'button', text: 'Add an access key', onclick: () => toggleSettings(true) }),
        ' to save checks to your reports.',
      ),
    );
  }

  root.replaceChildren(...parts);
  $('scanView').hidden = true;
  root.hidden = false;
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------
async function init() {
  $('brandLink').href = webUrl('/');
  $('brandLink').target = '_blank';
  $('brandLink').rel = 'noopener';
  $('getKeyLink').href = webUrl('/account#extension');
  $('getKeyLink').target = '_blank';
  $('getKeyLink').rel = 'noopener';

  const select = $('language');
  select.replaceChildren(...LANGUAGES.map((l) => el('option', { value: l, text: l })));

  $('settingsBtn').addEventListener('click', () => toggleSettings());
  $('saveKeyBtn').addEventListener('click', saveKey);
  $('accessKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveKey();
  });
  $('removeKeyBtn').addEventListener('click', removeKey);
  $('grabBtn').addEventListener('click', grabPage);
  $('scanForm').addEventListener('submit', analyze);
  $('docText').addEventListener('input', saveDraftSoon);
  select.addEventListener('change', () => store.set({ language: select.value }));

  store.remove(LEGACY_KEYS).catch(() => {});
  const saved = await store.get(['accessKey', 'draft', 'language', 'last', 'pending']);

  state.accessKey = typeof saved.accessKey === 'string' ? saved.accessKey : '';
  $('accessKey').value = state.accessKey;
  $('removeKeyBtn').hidden = !state.accessKey;
  if (LANGUAGES.includes(saved.language)) select.value = saved.language;
  if (typeof saved.draft === 'string') $('docText').value = saved.draft;

  // A scan that never cleared its marker means the popup closed before the answer arrived.
  const interrupted = Boolean(saved.pending) && !(saved.last && saved.last.at > saved.pending.startedAt);
  if (interrupted) {
    const notice = $('notice');
    notice.replaceChildren(
      ...[
        el('p', { text: 'Your last check stopped because this window closed. Keep it open until the result appears.' }),
        saved.pending.signedIn && el('p', {}, 'If it finished, it’s in ', webLink('/reports', 'your reports'), '.'),
      ].filter(Boolean),
    );
    notice.hidden = false;
  }
  if (saved.pending) store.remove('pending').catch(() => {});

  if (saved.last?.result && !interrupted) showResults(saved.last);
  refreshStatus();
}

init();
