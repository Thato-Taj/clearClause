import { ACT_IDS } from './acts.js';

/**
 * Non-compliance scoring. 0 = no problems found; the closer to 100, the less compliant.
 *
 * The model only classifies clauses; the numbers are computed here, deterministically,
 * so the same findings always give the same score and the method can be explained:
 *
 *   Start at 0. Each problem closes part of the remaining gap to 100:
 *     "breaks the law"  closes 50% of the gap  (one illegal clause → 50, two → 75)
 *     "unfair or risky" closes 20% of the gap
 *     "unclear wording" closes  5% of the gap
 *
 * This never saturates (more problems always means a higher score, but it never
 * quite reaches 100), so a contract with 3 problems and one with 15 score differently.
 * The same formula is applied per Act, using only the findings that cite that Act.
 */
export const SEVERITY_WEIGHTS = { violation: 0.5, concern: 0.2, vague: 0.05 };

export const BANDS = [
  { max: 0, id: 'clear', label: 'No issues found' },
  { max: 24, id: 'low', label: 'Low risk' },
  { max: 49, id: 'moderate', label: 'Moderate risk' },
  { max: 74, id: 'high', label: 'High risk' },
  { max: 100, id: 'critical', label: 'Critical risk' },
];

export const bandFor = (score) => BANDS.find((b) => score <= b.max) ?? BANDS.at(-1);

/** @param {{violation: number, concern: number, vague: number}} counts */
export function scoreFromCounts(counts) {
  const remaining =
    (1 - SEVERITY_WEIGHTS.violation) ** counts.violation *
    (1 - SEVERITY_WEIGHTS.concern) ** counts.concern *
    (1 - SEVERITY_WEIGHTS.vague) ** counts.vague;
  // Round down so 99.6 shows as 99, never a misleading "100".
  return Math.min(99, Math.floor((1 - remaining) * 100 + 1e-9));
}

/**
 * @param {Array<{severity: string, acts: Array<{act: string}>}>} clauses
 * @param {string[]} applicableActs
 */
export function computeScores(clauses, applicableActs) {
  const applicable = new Set(applicableActs);
  // An Act cited by a finding is applicable by definition.
  for (const c of clauses) for (const a of c.acts) applicable.add(a.act);

  const perAct = {};
  for (const id of ACT_IDS) {
    if (!applicable.has(id)) {
      perAct[id] = { applicable: false, score: null, band: null, counts: null };
      continue;
    }
    const counts = { violation: 0, concern: 0, vague: 0 };
    for (const c of clauses) {
      if (c.acts.some((a) => a.act === id)) counts[c.severity] += 1;
    }
    const score = scoreFromCounts(counts);
    perAct[id] = { applicable: true, score, band: bandFor(score).id, counts };
  }

  const counts = { violation: 0, concern: 0, vague: 0 };
  for (const c of clauses) counts[c.severity] += 1;
  const overall = scoreFromCounts(counts);
  const band = bandFor(overall);

  return { overall, band: band.id, bandLabel: band.label, counts, perAct };
}
