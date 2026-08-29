import { Router } from 'express';
import { z } from 'zod';
import { getAdapter } from '../chains/index.js';
import { query } from '../db.js';
import { priceOf } from '../services/prices.js';
import { recomputeBalances } from '../services/sync.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', async (req, res) => {
  const {
    walletId,
    chain,
    asset,
    direction,
    categoryId,
    search,
    from,
    to,
    limit = '100',
    offset = '0',
    includeInternal = 'true',
  } = req.query as Record<string, string>;

  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  const push = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (walletId) push('t.wallet_id = ?', Number(walletId));
  if (chain) push('t.chain = ?', chain);
  if (asset) push('UPPER(t.asset) = ?', asset.toUpperCase());
  if (direction) push('t.direction = ?', direction);
  if (categoryId) push('t.category_id = ?', Number(categoryId));
  if (from) push('t.ts >= ?', from);
  if (to) push('t.ts < ?', to);
  if (includeInternal === 'false') where.push('t.internal = FALSE');
  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    where.push(
      `(t.counterparty ILIKE $${index} OR t.note ILIKE $${index} OR t.tx_hash ILIKE $${index})`,
    );
  }

  const sql = `
    SELECT t.*, w.label AS wallet_label, w.color AS wallet_color,
           c.name AS category_name, c.name_ru AS category_name_ru,
           c.color AS category_color, c.icon AS category_icon, c.kind AS category_kind
      FROM transactions t
      LEFT JOIN wallets w ON w.id = t.wallet_id
      LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.ts DESC, t.id DESC
     LIMIT ${Math.min(Number(limit) || 100, 500)} OFFSET ${Number(offset) || 0}`;

  const rows = await query(sql, params);

  const totals = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions t WHERE ${where.join(' AND ')}`,
    params,
  );

  res.json({
    total: totals[0]?.count ?? 0,
    items: rows.map((row: any) => ({
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

const manualTx = z.object({
  walletId: z.number().int().positive().nullable().optional(),
  chain: z.string().default('manual'),
  ts: z.string(),
  direction: z.enum(['in', 'out']),
  asset: z.string().min(2).max(12),
  amount: z.number().positive(),
  fee: z.number().min(0).default(0),
  counterparty: z.string().max(120).optional(),
  note: z.string().max(280).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
});

transactionsRouter.post('/', async (req, res) => {
  const parsed = manualTx.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const tx = parsed.data;
  const price = await priceOf(tx.asset);
  const rows = await query(
    `INSERT INTO transactions
       (wallet_id, chain, tx_hash, vout, ts, direction, asset, amount, fee, counterparty, note,
        price_usd, value_usd, category_id, manual)
     VALUES ($1,$2,$3,0,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
     RETURNING *`,
    [
      tx.walletId ?? null,
      tx.chain,
      `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tx.ts,
      tx.direction,
      tx.asset.toUpperCase(),
      tx.amount,
      tx.fee,
      tx.counterparty ?? null,
      tx.note ?? null,
      price,
      price === null ? null : price * tx.amount,
      tx.categoryId ?? null,
    ],
  );
  if (tx.walletId) await recomputeBalances(tx.walletId);
  res.status(201).json(rows[0]);
});

const patchTx = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  note: z.string().max(280).nullable().optional(),
  internal: z.boolean().optional(),
});

transactionsRouter.patch('/:id', async (req, res) => {
  const parsed = patchTx.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { categoryId, note, internal } = parsed.data;

  const rows = await query(
    `UPDATE transactions
        SET category_id = COALESCE($2, category_id),
            note = COALESCE($3, note),
            internal = COALESCE($4, internal),
            manual = TRUE
      WHERE id = $1
      RETURNING *`,
    [req.params.id, categoryId ?? null, note ?? null, internal ?? null],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

transactionsRouter.delete('/:id', async (req, res) => {
  const rows = await query<{ wallet_id: number | null }>(
    `DELETE FROM transactions WHERE id = $1 RETURNING wallet_id`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  if (rows[0].wallet_id) await recomputeBalances(rows[0].wallet_id);
  res.json({ ok: true });
});

transactionsRouter.get('/export.csv', async (_req, res) => {
  const rows = await query<any>(
    `SELECT t.ts, t.chain, t.direction, t.asset, t.amount, t.fee, t.value_usd,
            t.counterparty, t.note, w.label AS wallet, c.name AS category, t.tx_hash
       FROM transactions t
       LEFT JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN categories c ON c.id = t.category_id
      ORDER BY t.ts DESC`,
  );
  const header = 'date,chain,direction,asset,amount,fee,value_usd,counterparty,note,wallet,category,tx_hash';
  const escape = (value: unknown) =>
    value === null || value === undefined ? '' : `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    header,
    ...rows.map((row) =>
      [
        new Date(row.ts).toISOString(),
        row.chain,
        row.direction,
        row.asset,
        row.amount,
        row.fee,
        row.value_usd,
        row.counterparty,
        row.note,
        row.wallet,
        row.category,
        row.tx_hash,
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\n');
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', 'attachment; filename="climb-transactions.csv"');
  res.send(csv);
});
