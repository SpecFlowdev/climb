import { Router } from 'express';
import { config } from '../config.js';
import { coinIdFor, isStable, marketChart, priceMap, refreshPrices } from '../services/prices.js';
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
    res.status(502).json({ error: (error as Error).message });
  }
});

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
