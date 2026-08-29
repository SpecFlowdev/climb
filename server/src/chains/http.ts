import { config } from '../config.js';
import { ChainError } from './types.js';

export async function getJson<T>(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { accept: 'application/json', ...(init.headers ?? {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new ChainError(`upstream ${res.status} for ${hostOf(url)}`);
      }
      if (!res.ok) {
        throw new ChainError(`request failed (${res.status}) for ${hostOf(url)}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ChainError(`request failed for ${hostOf(url)}`);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function scaled(value: string | number | undefined, decimals: number): number {
  if (value === undefined || value === null) return 0;
  const raw = typeof value === 'number' ? BigInt(Math.trunc(value)) : BigInt(value || '0');
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}
