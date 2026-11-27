import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScores, bandFor, scoreFromCounts } from '../src/engine/scoring.js';
import { verifyQuote, normaliseForMatch, normaliseResult } from '../src/engine/analyze.js';
import { sniffType, htmlToText, extractFromText } from '../src/engine/extract.js';
import { isPublicAddress, parseUserUrl } from '../src/engine/fetchUrl.js';
import { formatReport } from '../src/bots/format.js';

const clause = (severity, ...acts) => ({ severity, acts: acts.map((act) => ({ act, section: '' })) });

test('scores are 0 when nothing is found and Acts are applicable', () => {
  const s = computeScores([], ['POPIA', 'CPA']);
  assert.equal(s.overall, 0);
  assert.equal(s.band, 'clear');
  assert.equal(s.perAct.POPIA.score, 0);
  assert.equal(s.perAct.POPIA.applicable, true);
  assert.equal(s.perAct.BCEA.applicable, false);
  assert.equal(s.perAct.BCEA.score, null);
});

test('scores close part of the remaining gap per finding, per Act and overall', () => {
  const s = computeScores(
    [clause('violation', 'POPIA'), clause('concern', 'POPIA', 'CPA'), clause('vague', 'CPA')],
    ['POPIA'],
  );
  assert.equal(s.perAct.POPIA.score, 60); // 1 - 0.5 * 0.8
  assert.equal(s.perAct.CPA.score, 24); // cited => applicable; 1 - 0.8 * 0.95
  assert.equal(s.overall, 62); // 1 - 0.5 * 0.8 * 0.95
  assert.equal(s.band, 'high');
});

test('one illegal clause is high risk, two are critical, and scores never saturate at 100', () => {
  assert.equal(scoreFromCounts({ violation: 1, concern: 0, vague: 0 }), 50);
  assert.equal(bandFor(50).id, 'high');
  assert.equal(scoreFromCounts({ violation: 2, concern: 0, vague: 0 }), 75);
  assert.equal(bandFor(75).id, 'critical');
  const five = scoreFromCounts({ violation: 5, concern: 0, vague: 0 });
  const fifteen = scoreFromCounts({ violation: 15, concern: 0, vague: 0 });
  assert.ok(five < fifteen || fifteen === 99);
  assert.ok(fifteen <= 99);
  // Lots of vague wording alone stays moderate.
  assert.equal(bandFor(scoreFromCounts({ violation: 0, concern: 0, vague: 10 })).id, 'moderate');
});

test('bands', () => {
  assert.equal(bandFor(0).id, 'clear');
  assert.equal(bandFor(24).id, 'low');
  assert.equal(bandFor(25).id, 'moderate');
  assert.equal(bandFor(74).id, 'high');
  assert.equal(bandFor(75).id, 'critical');
});

test('quote verification tolerates whitespace and smart quotes but rejects paraphrase', () => {
  const src = normaliseForMatch('7.2  We may share your “personal information”\nwith our partners — at any time.');
  assert.equal(verifyQuote('We may share your "personal information" with our partners - at any time.', src), true);
  assert.equal(verifyQuote('We can give your data to anyone we like whenever we want.', src), false);
  assert.equal(verifyQuote('anything', ''), null);
});

test('normaliseResult drops junk, sorts by severity and computes scores', () => {
  const r = normaliseResult(
    {
      isLegalDocument: true,
      title: 'Acme Terms',
      documentType: 'Terms of Service',
      summary: 'Summary.',
      applicableActs: ['POPIA', 'NOPE'],
      clauses: [
        { reference: '1', title: 'Vague fees', quote: 'a reasonable fee', severity: 'vague', acts: [{ act: 'CPA', section: 's 22' }], explanation: 'x', action: 'y' },
        { reference: '2', title: 'Sells data', quote: 'we sell your data', severity: 'violation', acts: [{ act: 'POPIA', section: 's 11' }, { act: 'FAKE', section: '' }], explanation: 'x', action: 'y' },
        { reference: '3', title: 'Bad', severity: 'catastrophic', acts: [], explanation: 'x', action: 'y' },
      ],
      positives: [],
      verdict: 'Be careful.',
    },
    { sourceText: 'We charge a reasonable fee. We sell your data.', language: 'English', mode: 'consumer', extraction: { source: 'paste', truncated: false } },
  );
  assert.equal(r.clauses.length, 2);
  assert.equal(r.clauses[0].severity, 'violation');
  assert.deepEqual(r.clauses[0].acts, [{ act: 'POPIA', section: 's 11' }]);
  assert.equal(r.clauses[0].quoteVerified, true);
  assert.deepEqual(r.applicableActs, ['POPIA', 'CPA']);
  assert.equal(r.scores.overall, 52); // 1 - 0.5 * 0.95
});

test('file sniffing uses magic bytes, not names', () => {
  assert.equal(sniffType(Buffer.from('%PDF-1.7 ...'), 'text/plain', 'x.txt'), 'pdf');
  assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), '', 'x.pdf'), 'image/png');
  assert.equal(sniffType(Buffer.from('PK\u0003\u0004....'), '', 'contract.docx'), 'docx');
  assert.equal(sniffType(Buffer.from('PK\u0003\u0004....'), '', 'archive.zip'), 'unsupported');
  assert.equal(sniffType(Buffer.from('Plain terms and conditions.'), '', 'terms.txt'), 'text');
  assert.equal(sniffType(Buffer.from([0, 1, 2, 3, 0, 0, 0, 0, 0, 255, 254, 0]), '', 'bin'), 'unsupported');
});

test('html to text strips scripts and tags', () => {
  const t = htmlToText('<html><script>alert(1)</script><h1>Terms</h1><p>We may&nbsp;share &amp; sell.</p></html>');
  assert.match(t, /Terms\s+We may share & sell\./);
  assert.doesNotMatch(t, /alert/);
});

test('pasted text must be long enough', () => {
  assert.throws(() => extractFromText('too short'), /too short/);
});

test('private network addresses are blocked for link fetching', () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(a), false, a);
  }
  for (const a of ['8.8.8.8', '41.0.0.1', '2001:4860:4860::8888']) assert.equal(isPublicAddress(a), true, a);
  assert.equal(parseUserUrl('file:///etc/passwd'), null);
  assert.equal(parseUserUrl('https://user:pw@example.com'), null);
  assert.ok(parseUserUrl('https://example.com/terms'));
});

test('chat formatter escapes HTML for Telegram and splits long reports', () => {
  const result = normaliseResult(
    {
      isLegalDocument: true,
      title: 'Shop <script>',
      documentType: 'Terms of Service',
      summary: 'S',
      applicableActs: ['CPA'],
      clauses: Array.from({ length: 12 }, (_, i) => ({
        reference: `${i}`, title: `Problem ${i}`, quote: 'q'.repeat(300), severity: 'concern',
        acts: [{ act: 'CPA', section: 's 48' }], explanation: 'e'.repeat(600), action: 'a'.repeat(300),
      })),
      positives: [],
      verdict: 'V',
    },
    { sourceText: '', language: 'English', mode: 'consumer', extraction: { source: 'image', truncated: false } },
  );
  const msgs = formatReport(result, { style: 'telegram', reportUrl: 'https://x/reports/1', quota: { remaining: 2, limit: 3 } });
  assert.ok(msgs.length > 1);
  assert.ok(msgs.every((m) => m.length <= 4096));
  assert.ok(msgs[0].includes('Shop &lt;script&gt;'));
  assert.ok(msgs.at(-1).includes('+ 4 more findings'));
  const wa = formatReport(result, { style: 'whatsapp' });
  assert.ok(wa[0].startsWith('⚖️ *ClearClause report*'));
});

test('IP-literal links to private ranges are refused before connecting', async () => {
  const { extractFromUrl } = await import('../src/engine/fetchUrl.js');
  for (const u of ['http://169.254.169.254/latest/meta-data', 'http://127.0.0.1:5001/health', 'http://[::1]/']) {
    await assert.rejects(extractFromUrl(u), /private address/, u);
  }
});

test('bot conversation: help, language, link hints and short-text nudge (no Firestore)', async () => {
  const { handleIncoming } = await import('../src/bots/core.js');
  const say = async (text) => {
    const out = [];
    await handleIncoming({ channel: 'telegram', userId: '42', text, reply: async (m) => { out.push(m); } });
    return out.join('\n');
  };
  assert.match(await say('/start'), /Welcome to ClearClause/);
  assert.match(await say('/language'), /isiZulu/);
  assert.match(await say('LANGUAGE sesotho'), /answer in Sesotho/);
  assert.match(await say('/link'), /6-digit code/);
  assert.match(await say('/start link_123456'), /not available/); // no Firestore in tests
  assert.match(await say('hello, what is this?'), /Welcome/);
  assert.match(await say('Can you look at my lease please'), /PDF, Word document, photo or link/);
});
