import { Router } from 'express';
import { config } from '../config.js';
import { coinIdFor, isStable, marketChart, priceMap, priceOf, refreshPrices } from '../services/prices.js';
import { query } from '../db.js';

export const marketRouter = Router();

marketRouter.get('/prices', async (_req, res) => {
  const assets = await query<{ asset: string }>(`SELECT DISTINCT asset FROM balances`);
  await refreshPrices(assets.map((row) => row.asset));
  const prices = await priceMap();
  res.json([...prices.values()]);
});

marketRouter.post('/prices/refresh', async (_req, res) => {
  const assets = await query<{ asset: string }>(
    `SELECT DISTINCT asset FROM balances UNION SELECT DISTINCT asset FROM transactions`,
  );
  await refreshPrices(assets.map((row) => row.asset), true);
  res.json({ ok: true, assets: assets.length });
});

marketRouter.get('/chart', async (req, res) => {
  const asset = String(req.query.asset ?? 'BTC').toUpperCase();
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  if (isStable(asset)) {
    const points = Array.from({ length: days }, (_, index) => ({
      t: Date.now() - (days - index) * 86_400_000,
      p: 1,
    }));
    return res.json({ asset, days, points });
  }
  const coinId = coinIdFor(asset);
  if (!coinId) return res.status(404).json({ error: 'unknown_asset' });
  try {
    const raw = await marketChart(coinId, days);
    res.json({ asset, days, points: raw.map(([t, p]) => ({ t, p })) });
  } catch (error) {
    if (config.demoMode) {
      const base = await priceOf(asset);
      if (base) return res.json({ asset, days, points: syntheticSeries(asset, base, days) });
    }
    res.status(502).json({ error: (error as Error).message });
  }
});

/**
 * Offline fallback for demo installs: a deterministic random walk ending at the
 * current seeded price, so the chart isn't blank when the market API is unreachable.
 */
function syntheticSeries(asset: string, endPrice: number, days: number): Array<{ t: number; p: number }> {
  let seed = [...asset].reduce((sum, char) => sum + char.charCodeAt(0), 7);
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const walk: number[] = [endPrice];
  for (let i = 1; i < days; i += 1) {
    const drift = (next() - 0.5) * 0.05;
    walk.push(walk[i - 1] / (1 + drift));
  }
  walk.reverse();
  const now = Date.now();
  return walk.map((p, index) => ({ t: now - (days - index) * 86_400_000, p: Math.max(p, 0) }));
}

marketRouter.get('/convert', async (req, res) => {
  const from = String(req.query.from ?? 'BTC').toUpperCase();
  const to = String(req.query.to ?? 'USDT').toUpperCase();
  const amount = Number(req.query.amount ?? 1);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'invalid_amount' });
  }
  await refreshPrices([from, to]);
  const prices = await priceMap();
  const priceOf = (asset: string) =>
    isStable(asset) ? 1 : prices.get(asset)?.price ?? null;
  const fromPrice = priceOf(from);
  const toPrice = priceOf(to);
  if (!fromPrice || !toPrice) return res.status(404).json({ error: 'missing_price' });
  res.json({
    from,
    to,
    amount,
    rate: fromPrice / toPrice,
    result: (amount * fromPrice) / toPrice,
    currency: config.baseCurrency,
    fromPrice,
    toPrice,
  });
});
