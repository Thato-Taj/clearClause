import type { ActId, BandId, Severity } from './types';

/** Edit these before launch. */
export const SITE = {
  name: 'ClearClause',
  apiUrl: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/$/, ''),
  telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT || 'ClearClauseBot',
  /** International format without "+", e.g. 27821234567. Empty hides WhatsApp links. */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
  /** Where privacy requests and sales enquiries go. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@clearclause.co.za',
  extensionUrl: process.env.NEXT_PUBLIC_EXTENSION_URL || '',
};

export const SEVERITY: Record<Severity, { label: string; short: string; description: string }> = {
  violation: {
    label: 'Breaks the law',
    short: 'Illegal',
    description: 'This part seems to go against a specific South African law.',
  },
  concern: {
    label: 'Unfair or risky',
    short: 'Risky',
    description: 'Probably legal, but one-sided or likely to cost you later.',
  },
  vague: {
    label: 'Unclear wording',
    short: 'Vague',
    description: 'So vague that you can’t tell what you are agreeing to.',
  },
};

export const BAND_LABEL: Record<BandId, string> = {
  clear: 'No issues found',
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
  critical: 'Critical risk',
};

/** Mirrors backend/src/engine/acts.js — keep in sync. */
export const ACTS: Record<ActId, { short: string; name: string; plain: string }> = {
  POPIA: {
    short: 'POPIA',
    name: 'Protection of Personal Information Act',
    plain: 'How companies collect, use, share and keep your personal information.',
  },
  CPA: {
    short: 'CPA',
    name: 'Consumer Protection Act',
    plain: 'Your rights when you buy goods or services from a business.',
  },
  NCA: {
    short: 'NCA',
    name: 'National Credit Act',
    plain: 'Your rights when you borrow money or buy on credit.',
  },
  ECTA: {
    short: 'ECTA',
    name: 'Electronic Communications and Transactions Act',
    plain: 'Rules for online shopping, websites and agreements you accept online.',
  },
  BCEA: {
    short: 'BCEA',
    name: 'Basic Conditions of Employment Act',
    plain: 'Minimum rules for working hours, leave, pay and deductions.',
  },
  LRA: {
    short: 'LRA',
    name: 'Labour Relations Act',
    plain: 'Protection from unfair dismissal and unfair treatment at work.',
  },
  RHA: {
    short: 'Rental Housing',
    name: 'Rental Housing Act',
    plain: 'Rights of tenants and landlords in a home rental.',
  },
};

export const ACT_ORDER: ActId[] = ['POPIA', 'CPA', 'NCA', 'ECTA', 'BCEA', 'LRA', 'RHA'];

/** Share of the remaining gap to 100 that each finding closes — mirrors backend scoring.js. */
export const SCORING = { violation: 0.5, concern: 0.2, vague: 0.05 } as const;

export const LANGUAGES = [
  'English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sepedi', 'Setswana',
  'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele',
];

/** Placeholder pricing for the pitch — payments are not wired up yet. */
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'R0',
    period: '',
    blurb: 'For anyone about to sign something.',
    features: ['3 scans a day', 'Website, WhatsApp, Telegram and browser extension', 'All 11 official languages', 'Saved reports when signed in'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R79',
    period: '/month',
    blurb: 'For people who sign a lot — freelancers, landlords, job seekers.',
    features: ['50 scans a day', 'Everything in Free', 'Download reports as PDF', 'Priority processing'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'From R1 490',
    period: '/month',
    blurb: 'For companies that write terms, policies and contracts.',
    features: [
      'Unlimited scans',
      'Compliance mode: fix suggestions and safer wording for your own documents',
      'API access for your systems',
      'Team seats and onboarding (coming soon)',
    ],
  },
] as const;
