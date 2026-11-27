export type Severity = 'violation' | 'concern' | 'vague';
export type ActId = 'POPIA' | 'CPA' | 'NCA' | 'ECTA' | 'BCEA' | 'LRA' | 'RHA';
export type BandId = 'clear' | 'low' | 'moderate' | 'high' | 'critical';

export interface Clause {
  id: string;
  reference: string;
  title: string;
  quote: string;
  /** true = found in the document; false = model may have paraphrased; null = couldn't check (photo/scan) */
  quoteVerified: boolean | null;
  severity: Severity;
  severityLabel: string;
  acts: { act: ActId; section: string }[];
  explanation: string;
  action: string;
}

export interface ActScore {
  applicable: boolean;
  score: number | null;
  band: BandId | null;
  counts: Record<Severity, number> | null;
}

export interface AnalysisResult {
  version: number;
  isLegalDocument: boolean;
  title: string;
  documentType: string;
  language: string;
  mode: 'consumer' | 'business';
  summary: string;
  verdict: string;
  positives: string[];
  clauses: Clause[];
  applicableActs: ActId[];
  scores: {
    overall: number;
    band: BandId;
    bandLabel: string;
    counts: Record<Severity, number>;
    perAct: Record<ActId, ActScore>;
  };
  source: { kind: string; truncated: boolean; characters: number | null; url?: string };
  model: string;
  analysedAt: string;
}

export interface SavedScan extends AnalysisResult {
  id: string;
  fileName: string | null;
  channel: 'web' | 'extension' | 'telegram' | 'whatsapp';
  createdAt: string | null;
}

export interface ScanSummary {
  id: string;
  title: string;
  documentType: string;
  fileName: string | null;
  channel: SavedScan['channel'];
  language: string;
  score: number | null;
  band: BandId | null;
  counts: Record<Severity, number> | null;
  createdAt: string | null;
}

/** Rolling window: each check counts for `periodDays` after it was used. limit -1 = unlimited. */
export interface Quota {
  used: number | null;
  limit: number;
  remaining: number;
  periodDays: number;
  /** When the next check frees up (ISO time), or null if none are in use. */
  nextAt: string | null;
}

export interface Me {
  user: { uid: string; email: string | null; name: string | null; links: Partial<Record<'telegram' | 'whatsapp', { linkedAt: string }>> } | null;
  plan: { id: 'anonymous' | 'free' | 'pro' | 'business'; label: string; scans: number; periodDays: number };
  usage: Quota;
  accountsEnabled: boolean;
}

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}
