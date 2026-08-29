import { Router } from 'express';
import * as stats from '../services/stats.js';

export const statsRouter = Router();

function period(req: any): stats.Period {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const rawMonth = req.query.month;
  if (rawMonth === 'all' || rawMonth === '0') return { year, month: null };
  const month = Number(rawMonth) || now.getUTCMonth() + 1;
  return { year, month: Math.min(Math.max(month, 1), 12) };
}

statsRouter.get('/summary', async (req, res) => {
  const current = period(req);
  const previous =
    current.month === null
      ? { year: current.year - 1, month: null }
      : current.month === 1
        ? { year: current.year - 1, month: 12 }
        : { year: current.year, month: current.month - 1 };

  res.json({
    period: current,
    current: await stats.summary(current),
    previous: await stats.summary(previous),
  });
});

statsRouter.get('/categories', async (req, res) => {
  const direction = req.query.direction === 'in' ? 'in' : 'out';
  res.json(await stats.byCategory(period(req), direction));
});

statsRouter.get('/assets', async (req, res) => {
  res.json(await stats.byAsset(period(req)));
});

statsRouter.get('/cashflow', async (req, res) => {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  res.json(await stats.cashflow(year));
});

statsRouter.get('/portfolio', async (_req, res) => {
  res.json(await stats.portfolio());
});

statsRouter.get('/networth', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  res.json(await stats.netWorthSeries(days));
});

statsRouter.get('/years', async (req, res) => {
  const { query } = await import('../db.js');
  const rows = await query<{ year: number }>(
    `SELECT DISTINCT EXTRACT(YEAR FROM ts)::int AS year FROM transactions ORDER BY 1 DESC`,
  );
  const years = rows.map((row) => row.year);
  const now = new Date().getUTCFullYear();
  if (!years.includes(now)) years.unshift(now);
  res.json(years);
});
