export function formatMoney(value: number | null | undefined, currency = 'usd'): string {
  const amount = Number(value ?? 0);
  const symbol = currency.toLowerCase() === 'eur' ? '€' : '$';
  const abs = Math.abs(amount);
  const digits = abs === 0 ? 0 : abs >= 1000 ? 0 : abs >= 1 ? 2 : 4;
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).replace(/,/g, ' ');
  return `${amount < 0 ? '−' : ''}${formatted} ${symbol}`;
}

export function formatSigned(value: number, currency = 'usd'): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatMoney(value, currency)}`;
}

export function formatCrypto(amount: number, asset: string): string {
  const abs = Math.abs(amount);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.001 ? 6 : 8;
  const value = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).replace(/,/g, ' ');
  return `${value} ${asset}`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatDate(value: string, locale: string, withTime = false): string {
  const date = new Date(value);
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortAddress(address: string | null | undefined, size = 6): string {
  if (!address) return '—';
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-4)}`;
}

export function relativeTime(value: string | null, locale: string): string {
  if (!value) return locale === 'ru' ? 'никогда' : 'never';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return locale === 'ru' ? 'только что' : 'just now';
  if (minutes < 60) return locale === 'ru' ? `${minutes} мин назад` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === 'ru' ? `${hours} ч назад` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return locale === 'ru' ? `${days} дн назад` : `${days} d ago`;
}

export const CHART_COLORS = [
  '#34d399',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#f0555c',
  '#22d3ee',
  '#f97316',
  '#10b981',
  '#ec4899',
  '#94a3b8',
];
