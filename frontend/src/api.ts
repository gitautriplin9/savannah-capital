export type Role = 'customer' | 'teller' | 'loan_officer' | 'admin';
export type SessionUser = { id: string; name: string; email: string; phone: string; role: Role; kycStatus: string };
export type Account = { id: string; type: string; name: string; number: string; balance: number; frozen: boolean };
export type Transaction = { id: string; reference: string; kind: string; description: string; amount: number; fee: number; status: string; counterparty: string; created_at: string; flagged: boolean; entry_direction?: 'credit' | 'debit' };
export type Loan = { id: string; user_id: string; customer_name?: string; amount_cents: number; tenure_months: number; rate_percent: number; purpose: string; status: string; reviewer_comment: string; created_at: string; repaid_cents: number };

type Session = { user: SessionUser; accessToken: string; refreshToken: string };
const KEY = 'kcb-demo-session';
const API_BASE_URL = ((typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : '').trim() || '').replace(/\/$/, '');

export const getSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null; }
  catch { return null; }
};
export const setSession = (session: Session | null) => session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY);

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let session = getSession();
  const base = API_BASE_URL || '';
  const send = (token?: string) => fetch(`${base}/api${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  let response = await send(session?.accessToken);
  if (response.status === 401 && session?.refreshToken && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
    if (refreshed.ok) {
      const tokens = await refreshed.json() as { accessToken: string; refreshToken: string };
      session = { ...session, ...tokens };
      setSession(session);
      response = await send(session.accessToken);
    } else setSession(null);
  }
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed.');
  return body;
}
