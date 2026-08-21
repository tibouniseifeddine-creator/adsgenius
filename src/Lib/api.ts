// Shared fetch helper for authenticated API calls against the real backend.
// Mirrors the API_URL resolution already used in AuthContext.tsx (same-origin in
// production, localhost in local dev) and automatically attaches the stored auth
// token. Pages that are migrating off DemoContext's fake data onto real backend
// data (see COWORK_ADSGENIUS_REALDATA_PLAN.md) should use this instead of useDemo().
const configuredApiUrl = (import.meta as any).env?.VITE_API_URL?.trim();
export const API_URL = configuredApiUrl || ((import.meta as any).env?.DEV ? 'http://localhost:4000' : '');
const TOKEN_KEY = 'adsgenius_token';

export async function apiFetch<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any)?.error ?? 'Request failed');
  return data as T;
}
