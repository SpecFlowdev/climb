export interface ApiError extends Error {
  code?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const error = new Error(data?.error ?? 'request_failed') as ApiError;
    error.code = data?.error;
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ------------------------------- API types ------------------------------- */

export interface Chain {
  id: string;
  name: string;
  nativeAsset: string;
  family: string;
}

export interface Balance {
  wallet_id: number;
  asset: string;
  amount: number;
}

export interface Wallet {
  id: number;
  label: string;
  chain: string;
  chainName: string;
  address: string;
  color: string;
  archived: boolean;
  last_sync: string | null;
  sync_error: string | null;
  tx_count: number;
  explorer: string | null;
  balances: Balance[];
}

export interface Transaction {
  id: number;
  wallet_id: number | null;
  chain: string;
  tx_hash: string;
  ts: string;
  direction: 'in' | 'out';
  asset: string;
  amount: number;
  fee: number;
  counterparty: string | null;
  note: string | null;
  price_usd: number | null;
  value_usd: number | null;
  category_id: number | null;
  internal: boolean;
  manual: boolean;
  wallet_label: string | null;
  wallet_color: string | null;
  category_name: string | null;
  category_name_ru: string | null;
  category_color: string | null;
  category_icon: string | null;
  category_kind: string | null;
  explorer: string | null;
}

export interface Category {
  id: number;
  name: string;
  name_ru: string | null;
  kind: 'income' | 'expense' | 'transfer';
  color: string;
  icon: string;
  system: boolean;
  tx_count: number;
}

export interface Rule {
  id: number;
  priority: number;
  field: 'counterparty' | 'asset' | 'chain' | 'note' | 'direction';
  operator: 'equals' | 'contains' | 'starts_with';
  pattern: string;
  category_id: number;
  enabled: boolean;
  category_name: string;
  category_color: string;
}

export interface Summary {
  income: number;
  expense: number;
  fees: number;
  net: number;
  savingsRate: number;
  transactions: number;
}

export interface SummaryResponse {
  period: { year: number; month: number | null };
  current: Summary;
  previous: Summary;
}

export interface CategoryStat {
  category_id: number | null;
  name: string | null;
  name_ru: string | null;
  color: string | null;
  icon: string | null;
  total: number;
  count: number;
}

export interface CashflowPoint {
  month: number;
  income: number;
  expense: number;
  net: number;
}

export interface PortfolioAsset {
  asset: string;
  amount: number;
  price: number;
  value: number;
  change24h: number | null;
  share: number;
}

export interface Portfolio {
  total: number;
  change24h: number;
  changePercent24h: number;
  assets: PortfolioAsset[];
  chains: Array<{ chain: string; value: number; share: number }>;
  wallets: Array<{ id: number; label: string; chain: string; color: string; value: number }>;
}

export interface AssetStat {
  asset: string;
  income: number;
  expense: number;
  count: number;
}

export interface Status {
  version: string;
  wallets: number;
  transactions: number;
  lastSync: string | null;
  syncing: boolean;
  syncIntervalMinutes: number;
  baseCurrency: string;
  demoMode: boolean;
}

export interface Settings {
  language: string;
  theme: string;
  currency: string;
  hideSmallBalances: boolean;
  privacyMode: boolean;
  [key: string]: unknown;
}
