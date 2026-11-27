import { auth } from './firebase';
import { SITE } from './site';
import type { AnalysisResult, ApiKey, Me, Quota, SavedScan, ScanSummary } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public quota?: Quota,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const user = auth.currentUser;
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${SITE.apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('We could not reach ClearClause. Check your internet connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.code, data.quota);
  return data as T;
}

export interface AnalyzeInput {
  file?: File | null;
  text?: string;
  url?: string;
  language: string;
  mode: 'consumer' | 'business';
}

export function analyze(input: AnalyzeInput) {
  const form = new FormData();
  if (input.file) form.append('file', input.file);
  if (input.text) form.append('text', input.text);
  if (input.url) form.append('url', input.url);
  form.append('language', input.language);
  form.append('mode', input.mode);
  return request<{ result: AnalysisResult; scanId: string | null; quota: Quota }>('/api/analyze', { method: 'POST', body: form });
}

export const translate = (body: { scanId?: string; result?: AnalysisResult; language: string }) =>
  request<{ result: AnalysisResult; scanId?: string }>('/api/translate', { method: 'POST', body: JSON.stringify(body) });

export const getMe = () => request<Me>('/api/me');
export const deleteMe = () => request<{ deleted: true }>('/api/me', { method: 'DELETE' });

export const listScans = () => request<{ scans: ScanSummary[] }>('/api/scans');
export const getScan = (id: string) => request<{ scan: SavedScan }>(`/api/scans/${encodeURIComponent(id)}`);
export const deleteScan = (id: string) => request<{ deleted: true }>(`/api/scans/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const createLinkCode = () => request<{ code: string; expiresInMinutes: number }>('/api/links/code', { method: 'POST' });
export const unlinkChannel = (channel: 'telegram' | 'whatsapp') =>
  request<{ unlinked: true }>(`/api/links/${channel}`, { method: 'DELETE' });

export const listKeys = () => request<{ keys: ApiKey[] }>('/api/keys');
export const createKey = (label: string) =>
  request<ApiKey & { key: string }>('/api/keys', { method: 'POST', body: JSON.stringify({ label }) });
export const revokeKey = (id: string) => request<{ revoked: true }>(`/api/keys/${id}`, { method: 'DELETE' });
