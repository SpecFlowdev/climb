import { Router } from 'express';
import { getAdapter } from '../chains/index.js';
import { query } from '../db.js';
import { positionFor, positions } from '../services/pnl.js';

export const assetsRouter = Router();

assetsRouter.get('/', async (_req, res) => {
  const list = await positions();
  const total = list.reduce((sum, item) => sum + item.value, 0);
  res.json({
    total,
    costBasis: list.reduce((sum, item) => sum + item.costBasis, 0),
    unrealized: list.reduce((sum, item) => sum + item.unrealized, 0),
    realized: list.reduce((sum, item) => sum + item.realized, 0),
    assets: list.map((item) => ({
      ...item,
      share: total > 0 ? (item.value / total) * 100 : 0,
    })),
  });
});

assetsRouter.get('/:asset', async (req, res) => {
  const asset = req.params.asset.toUpperCase();
  const position = await positionFor(asset);
  if (!position) return res.status(404).json({ error: 'unknown_asset' });

  const transactions = await query<any>(
    `SELECT t.*, w.label AS wallet_label, c.name AS category_name, c.name_ru AS category_name_ru,
            c.color AS category_color
       FROM transactions t
       LEFT JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE UPPER(t.asset) = $1
      ORDER BY t.ts DESC
      LIMIT 100`,
    [asset],
  );

  const wallets = await query<{ label: string; chain: string; color: string; amount: number }>(
    `SELECT w.label, w.chain, w.color, b.amount
       FROM balances b JOIN wallets w ON w.id = b.wallet_id
      WHERE UPPER(b.asset) = $1 AND b.amount <> 0
      ORDER BY b.amount DESC`,
    [asset],
  );

  res.json({
    position,
    wallets,
    transactions: transactions.map((row) => ({
      ...row,
      explorer: (() => {
        try {
          return getAdapter(row.chain).explorerTx(row.tx_hash);
        } catch {
          return null;
        }
      })(),
    })),
  });
});
