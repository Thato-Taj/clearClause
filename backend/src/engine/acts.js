/**
 * South African legislation ClearClause audits against.
 * `plain` is shown to users (written for a grade-10 reader).
 * `focus` is given to the model as audit guidance.
 */
export const ACTS = {
  POPIA: {
    id: 'POPIA',
    short: 'POPIA',
    name: 'Protection of Personal Information Act 4 of 2013',
    plain: 'Controls how companies collect, use, share and keep your personal information.',
    focus: [
      'Processing must be lawful, minimal and for a specific, explicitly defined purpose (ss 9-14).',
      'Consent must be voluntary, specific and informed; bundled or implied consent is weak (s 11, s 1 definition of consent).',
      'Data subjects must be told what is collected, why, who receives it and their rights (s 18).',
      'Records must not be kept longer than necessary (s 14).',
      'Security safeguards and breach notification duties (ss 19-22).',
      'Direct marketing by electronic communication requires opt-in consent for non-customers and an opt-out every time (s 69).',
      'Special personal information (health, biometrics, religion, etc.) and children\'s information need extra justification (ss 26-35).',
      'Cross-border transfers only to countries/recipients with adequate protection or with consent (s 72).',
      'Automated decisions with legal effect need safeguards (s 71).',
      'Data subjects may access, correct and delete their information and object to processing (ss 23-25, s 11(3)).',
    ],
  },
  CPA: {
    id: 'CPA',
    short: 'CPA',
    name: 'Consumer Protection Act 68 of 2008',
    plain: 'Protects you when you buy goods or services from a business.',
    focus: [
      'Agreements must be in plain and understandable language (s 22).',
      'Unfair, unreasonable or unjust terms are not allowed (s 48).',
      'Risky terms that limit the supplier\'s liability or make the consumer assume risk must be drawn to the consumer\'s attention in a conspicuous manner and acknowledged (s 49).',
      'Prohibited terms: waiving consumer rights, excluding liability for gross negligence, forcing consumers to accept unilateral changes, false acknowledgements (s 51).',
      'Fixed-term agreements: max 24 months, consumer may cancel on 20 business days\' notice with only a reasonable cancellation penalty (s 14).',
      'Cooling-off right of 5 business days for direct marketing sales (s 16).',
      'Right to return unsafe/defective goods and the implied 6-month warranty (ss 55-56).',
      'Fair disclosure of prices and fees (ss 23, 41).',
    ],
  },
  NCA: {
    id: 'NCA',
    short: 'NCA',
    name: 'National Credit Act 34 of 2005',
    plain: 'Protects you when you borrow money or buy on credit.',
    focus: [
      'Unlawful provisions in credit agreements are void, e.g. waiving rights, forced consent to debit orders, or authorising the lender to enter premises (s 90).',
      'Fees and interest must not exceed prescribed limits and must be disclosed (ss 100-106).',
      'Reckless lending and affordability assessment duties (ss 80-81).',
      'Pre-agreement statement and quotation requirements (s 92-93).',
      'Consumer may settle early without unreasonable penalties (s 125).',
    ],
  },
  ECTA: {
    id: 'ECTA',
    short: 'ECTA',
    name: 'Electronic Communications and Transactions Act 25 of 2002',
    plain: 'Sets rules for online shopping, websites and electronic agreements.',
    focus: [
      'Online suppliers must disclose identity, contact details, full price, terms and the cancellation process (s 43).',
      '7-day cooling-off period for most online purchases (s 44).',
      'Unsolicited commercial communications must offer an opt-out (s 45).',
      'Consumer protections in Chapter VII cannot be waived by agreement (s 48).',
    ],
  },
  BCEA: {
    id: 'BCEA',
    short: 'BCEA',
    name: 'Basic Conditions of Employment Act 75 of 1997',
    plain: 'Sets the minimum rules for working hours, leave, pay and deductions at work.',
    focus: [
      'Maximum ordinary hours (45 per week) and overtime limits and pay (ss 9-10).',
      'Annual, sick, family responsibility and maternity/parental leave minimums (ss 20-27).',
      'Deductions from pay only with written consent or by law, and within limits (s 34).',
      'Notice periods for termination (s 37).',
      'Basic conditions cannot be reduced by contract except as allowed by the Act (s 4).',
    ],
  },
  LRA: {
    id: 'LRA',
    short: 'LRA',
    name: 'Labour Relations Act 66 of 1995',
    plain: 'Protects workers from unfair dismissal and unfair treatment.',
    focus: [
      'Employees may not be dismissed unfairly; fair reason and fair procedure are required (s 185, s 188).',
      'Freedom of association and the right to join a union (ss 4-5).',
      'Restraint-of-trade clauses are enforceable only if reasonable in scope, area and duration (common law, read with the Constitution).',
    ],
  },
  RHA: {
    id: 'RHA',
    short: 'Rental Housing',
    name: 'Rental Housing Act 50 of 1999',
    plain: 'Protects tenants and landlords in residential leases.',
    focus: [
      'Deposit must be kept in an interest-bearing account and refunded with interest within set periods (s 5(3)).',
      'Joint inspections at the start and end of the lease (s 5(3)(e), (f)).',
      'Landlord may not lock out a tenant or cut services without a court order; unfair practices are prohibited (s 4).',
      'Tenant\'s right to privacy (s 4).',
    ],
  },
};

export const ACT_IDS = Object.keys(ACTS);

export const SEVERITIES = ['violation', 'concern', 'vague'];

/** Plain-language labels used on every channel. */
export const SEVERITY_LABELS = {
  violation: 'Breaks the law',
  concern: 'Unfair or risky',
  vague: 'Unclear wording',
};
