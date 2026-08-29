import { Router } from 'express';
import { z } from 'zod';
import { chainCatalog, getAdapter } from '../chains/index.js';
import { query } from '../db.js';
import { recomputeBalances, syncAll, syncWallet, type WalletRow } from '../services/sync.js';

export const walletsRouter = Router();

const walletInput = z.object({
  label: z.string().min(1).max(60),
  chain: z.string().min(2),
  address: z.string().min(8).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

walletsRouter.get('/chains', (_req, res) => {
  res.json(chainCatalog);
});

walletsRouter.get('/', async (_req, res) => {
  const wallets = await query<WalletRow & { assets: number; value_assets: string }>(
    `SELECT w.*,
            COALESCE((SELECT COUNT(*) FROM balances b WHERE b.wallet_id = w.id AND b.amount <> 0), 0)::int AS assets,
            COALESCE((SELECT COUNT(*) FROM transactions t WHERE t.wallet_id = w.id), 0)::int AS tx_count
       FROM wallets w
      ORDER BY w.archived ASC, w.id ASC`,
  );
  const balances = await query<{ wallet_id: number; asset: string; amount: number }>(
    `SELECT wallet_id, asset, amount FROM balances WHERE amount <> 0`,
  );
  res.json(
    wallets.map((wallet) => {
      const adapter = chainCatalog.find((chain) => chain.id === wallet.chain);
      return {
        ...wallet,
        chainName: adapter?.name ?? wallet.chain,
        explorer: (() => {
          try {
            return getAdapter(wallet.chain).explorerAddress(wallet.address);
          } catch {
            return null;
          }
        })(),
        balances: balances.filter((balance) => balance.wallet_id === wallet.id),
      };
    }),
  );
});

walletsRouter.post('/', async (req, res) => {
  const parsed = walletInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { label, chain, address, color } = parsed.data;
  let adapter;
  try {
    adapter = getAdapter(chain);
  } catch {
    return res.status(400).json({ error: 'unsupported_chain' });
  }
  const trimmed = address.trim();
  if (!adapter.validate(trimmed)) {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (/\b(\w+\s+){11,}\w+\b/.test(trimmed)) {
    return res.status(400).json({ error: 'seed_phrase_rejected' });
  }

  const existing = await query(`SELECT id FROM wallets WHERE chain = $1 AND address = $2`, [
    chain,
    trimmed,
  ]);
  if (existing.length > 0) return res.status(409).json({ error: 'wallet_exists' });

  const rows = await query<WalletRow>(
    `INSERT INTO wallets (label, chain, address, color) VALUES ($1,$2,$3,$4) RETURNING *`,
    [label, chain, trimmed, color ?? '#2ecc8f'],
  );
  const wallet = rows[0];
  const result = await syncWallet(wallet).catch((error) => ({
    walletId: wallet.id,
    label: wallet.label,
    imported: 0,
    scanned: 0,
    error: (error as Error).message,
  }));
  res.status(201).json({ wallet, sync: result });
});

walletsRouter.patch('/:id', async (req, res) => {
  const schema = walletInput.partial().extend({ archived: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  const assignments = fields.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  const rows = await query<WalletRow>(
    `UPDATE wallets SET ${assignments} WHERE id = $1 RETURNING *`,
    [req.params.id, ...fields.map(([, value]) => value)],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

walletsRouter.delete('/:id', async (req, res) => {
  const rows = await query(`DELETE FROM wallets WHERE id = $1 RETURNING id`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

walletsRouter.post('/:id/sync', async (req, res) => {
  const rows = await query<WalletRow>(`SELECT * FROM wallets WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(await syncWallet(rows[0]));
});

walletsRouter.post('/sync', async (_req, res) => {
  res.json({ results: await syncAll() });
});

walletsRouter.post('/:id/recompute', async (req, res) => {
  await recomputeBalances(Number(req.params.id));
  res.json({ ok: true });
});
