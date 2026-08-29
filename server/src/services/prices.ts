import { config } from '../config.js';
import { getJson } from '../chains/http.js';
import { query } from '../db.js';

/** symbol -> CoinGecko id for everything we can resolve without an extra lookup. */
const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  ETH: 'ethereum',
  WETH: 'weth',
  STETH: 'staked-ether',
  POL: 'matic-network',
  MATIC: 'matic-network',
  TRX: 'tron',
  SOL: 'solana',
  WSOL: 'solana',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  TUSD: 'true-usd',
  FDUSD: 'first-digital-usd',
  BUSD: 'binance-usd',
  PYUSD: 'paypal-usd',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  TON: 'the-open-network',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  ATOM: 'cosmos',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
};

const STABLES = new Set(['USDT', 'USDC', 'DAI', 'TUSD', 'FDUSD', 'BUSD', 'PYUSD']);

export interface PriceRow {
  asset: string;
  currency: string;
  price: number;
  change_24h: number | null;
  updated_at: string;
}

export function coinIdFor(asset: string): string | undefined {
  return COIN_IDS[asset.toUpperCase()];
}

export function isStable(asset: string): boolean {
  return STABLES.has(asset.toUpperCase());
}

let lastFetch = 0;

export async function refreshPrices(assets: string[], force = false): Promise<void> {
  const currency = config.baseCurrency;
  const wanted = [...new Set(assets.map((a) => a.toUpperCase()))].filter((a) => COIN_IDS[a]);
  if (wanted.length === 0) return;

  const fresh = Date.now() - lastFetch < config.priceTtlSeconds * 1000;
  if (fresh && !force) return;

  const ids = [...new Set(wanted.map((a) => COIN_IDS[a]))].join(',');
  const key = config.coingeckoKey ? `&x_cg_demo_api_key=${config.coingeckoKey}` : '';
  const url = `${config.coingeckoApi}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true${key}`;

  try {
    const data = await getJson<Record<string, Record<string, number>>>(url);
    lastFetch = Date.now();
    for (const asset of wanted) {
      const entry = data[COIN_IDS[asset]];
      if (!entry) continue;
      const price = entry[currency];
      const change = entry[`${currency}_24h_change`];
      if (typeof price !== 'number') continue;
      await query(
        `INSERT INTO prices (asset, currency, price, change_24h, updated_at)
         VALUES ($1,$2,$3,$4, now())
         ON CONFLICT (asset, currency)
         DO UPDATE SET price = EXCLUDED.price, change_24h = EXCLUDED.change_24h, updated_at = now()`,
        [asset, currency, price, Number.isFinite(change) ? change : null],
      );
    }
  } catch (error) {
    console.warn('[prices] refresh failed:', (error as Error).message);
  }

  // Stablecoins always have a usable fallback so the dashboard is never empty.
  for (const asset of wanted.filter(isStable)) {
    await query(
      `INSERT INTO prices (asset, currency, price, change_24h, updated_at)
       VALUES ($1,$2,1,0, now()) ON CONFLICT (asset, currency) DO NOTHING`,
      [asset, currency],
    );
  }
}

export async function priceMap(): Promise<Map<string, PriceRow>> {
  const rows = await query<PriceRow>(`SELECT * FROM prices WHERE currency = $1`, [
    config.baseCurrency,
  ]);
  return new Map(rows.map((row) => [row.asset.toUpperCase(), row]));
}

export async function priceOf(asset: string): Promise<number | null> {
  const upper = asset.toUpperCase();
  if (isStable(upper)) return 1;
  const rows = await query<PriceRow>(
    `SELECT * FROM prices WHERE asset = $1 AND currency = $2`,
    [upper, config.baseCurrency],
  );
  return rows[0]?.price ?? null;
}

export async function marketChart(coinId: string, days: number): Promise<Array<[number, number]>> {
  const key = config.coingeckoKey ? `&x_cg_demo_api_key=${config.coingeckoKey}` : '';
  const url = `${config.coingeckoApi}/coins/${coinId}/market_chart?vs_currency=${config.baseCurrency}&days=${days}${key}`;
  const data = await getJson<{ prices: Array<[number, number]> }>(url);
  return data.prices ?? [];
}
