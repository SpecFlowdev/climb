import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { isSyncing } from '../services/sync.js';

export const settingsRouter = Router();

const DEFAULTS = {
  language: 'en',
  theme: 'dark',
  currency: config.baseCurrency,
  numberFormat: 'space',
  hideSmallBalances: false,
  privacyMode: false,
};

settingsRouter.get('/', async (_req, res) => {
  const rows = await query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  res.json({ ...DEFAULTS, ...stored });
});

const settingsInput = z.record(z.string(), z.any());

settingsRouter.put('/', async (req, res) => {
  const parsed = settingsInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_settings' });
  for (const [key, value] of Object.entries(parsed.data)) {
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    );
  }
  res.json({ ok: true });
});

settingsRouter.get('/status', async (_req, res) => {
  const [wallets] = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM wallets`);
  const [txs] = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM transactions`);
  const [lastSync] = await query<{ last: string | null }>(
    `SELECT MAX(last_sync)::text AS last FROM wallets`,
  );
  res.json({
    version: process.env.APP_VERSION ?? '0.1.0',
    wallets: wallets?.count ?? 0,
    transactions: txs?.count ?? 0,
    lastSync: lastSync?.last ?? null,
    syncing: isSyncing(),
    syncIntervalMinutes: config.syncIntervalMinutes,
    baseCurrency: config.baseCurrency,
    demoMode: config.demoMode,
  });
});

settingsRouter.post('/wipe', async (req, res) => {
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'confirmation_required' });
  await query(`TRUNCATE transactions, balances, wallets RESTART IDENTITY CASCADE`);
  res.json({ ok: true });
});
