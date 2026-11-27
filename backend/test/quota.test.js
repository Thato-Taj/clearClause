import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { consume, refund, peek } from '../src/services/quota.js';
import { allowanceText, nextCheckText } from '../src/services/util.js';
import { runScan } from '../src/engine/pipeline.js';

// These tests run against the in-memory store (FIREBASE_DISABLED=1), which shares its
// rolling-window logic with the Firestore store.

const DAY = 86_400_000;
const FREE = { scans: 3, periodDays: 14 };
const T0 = Date.parse('2026-12-01T08:00:00Z'); // Tuesday 1 December, 10:00 in South Africa

test('free accounts, guests and chat users get 3 checks every 14 days; Business is unlimited', () => {
  for (const plan of ['free', 'anonymous']) {
    assert.equal(config.plans[plan].scans, 3, plan);
    assert.equal(config.plans[plan].periodDays, 14, plan);
  }
  assert.equal(config.plans.pro.periodDays, 1);
  assert.equal(config.plans.business.scans, -1);
});

test('a 4th check inside 14 days is refused and says when the next one frees up', async () => {
  const key = 'test:fourth';
  for (const [i, at] of [T0, T0 + 2 * DAY, T0 + 5 * DAY].entries()) {
    const q = await consume(key, FREE, at);
    assert.equal(q.allowed, true);
    assert.equal(q.remaining, 2 - i);
  }
  const blocked = await consume(key, FREE, T0 + 13 * DAY);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.nextAt, new Date(T0 + 14 * DAY).toISOString());
});

test('each check frees up 14 days after it was used (rolling window, not calendar fortnights)', async () => {
  const key = 'test:rolling';
  await consume(key, FREE, T0);
  await consume(key, FREE, T0 + DAY);
  await consume(key, FREE, T0 + 2 * DAY);
  assert.equal((await consume(key, FREE, T0 + 14 * DAY - 1)).allowed, false, 'one millisecond early');

  const freed = await consume(key, FREE, T0 + 14 * DAY);
  assert.equal(freed.allowed, true, 'the oldest check has freed up');
  assert.equal(freed.remaining, 0);
  assert.equal((await consume(key, FREE, T0 + 14 * DAY + 1000)).allowed, false, 'only one check freed up, not all three');
});

test('a refunded check (the analysis failed) does not count', async () => {
  const key = 'test:refund';
  await consume(key, FREE, T0);
  const q = await consume(key, FREE, T0 + 1000);
  await refund(key, q.stamp);
  const after = await peek(key, FREE, T0 + 2000);
  assert.equal(after.used, 1);
  assert.equal(after.remaining, 2);
});

test('peek does not use up a check', async () => {
  const key = 'test:peek';
  await peek(key, FREE, T0);
  await peek(key, FREE, T0);
  assert.equal((await peek(key, FREE, T0)).remaining, 3);
  assert.equal((await peek(key, FREE, T0)).nextAt, null);
});

test('unlimited plans are never blocked', async () => {
  const key = 'test:unlimited';
  for (let i = 0; i < 20; i += 1) assert.equal((await consume(key, { scans: -1, periodDays: 1 }, T0 + i)).allowed, true);
  assert.equal((await peek(key, { scans: -1, periodDays: 1 }, T0)).remaining, -1);
});

test('allowances read naturally', () => {
  assert.equal(allowanceText({ scans: 3, periodDays: 14 }), '3 checks every 14 days');
  assert.equal(allowanceText({ scans: 50, periodDays: 1 }), '50 checks a day');
  assert.equal(allowanceText({ scans: 1, periodDays: 7 }), '1 check a week');
  assert.equal(allowanceText({ scans: -1, periodDays: 1 }), 'unlimited checks');
});

test('the next free check is given in South African time', () => {
  assert.equal(nextCheckText('2026-12-15T08:00:00.000Z', T0), 'Tuesday 15 December');
  assert.equal(nextCheckText('2026-12-01T20:30:00.000Z', T0), 'today at 22:30');
  assert.equal(nextCheckText('2026-12-02T07:00:00.000Z', T0), 'tomorrow at 09:00');
});

test('a scan over the limit is refused with the allowance and the date, before any AI call', async () => {
  const principal = { kind: 'anonymous', plan: 'anonymous', quotaKey: 'test:runscan' };
  for (let i = 0; i < 3; i += 1) await consume(principal.quotaKey, FREE);
  await assert.rejects(
    runScan({ principal, extraction: { text: 'x'.repeat(500), binary: null, source: 'text', truncated: false } }),
    (err) => {
      assert.equal(err.status, 429);
      assert.equal(err.code, 'quota_exceeded');
      assert.match(err.message, /3 checks every 14 days/);
      assert.match(err.message, /next free check/i);
      assert.equal(err.quota.remaining, 0);
      assert.ok(err.quota.nextAt);
      return true;
    },
  );
});
