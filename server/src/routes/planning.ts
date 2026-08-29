import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { budgetProgress, detectRecurring, goalProgress } from '../services/planning.js';

export const planningRouter = Router();

/* ------------------------------- budgets -------------------------------- */

const budgetInput = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  period: z.enum(['month', 'year']).default('month'),
});

planningRouter.get('/budgets', async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  res.json(await budgetProgress(year, month));
});

planningRouter.post('/budgets', async (req, res) => {
  const parsed = budgetInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { categoryId, amount, period } = parsed.data;
  const rows = await query(
    `INSERT INTO budgets (category_id, amount, period) VALUES ($1,$2,$3)
     ON CONFLICT (category_id, period) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING *`,
    [categoryId, amount, period],
  );
  res.status(201).json(rows[0]);
});

planningRouter.delete('/budgets/:id', async (req, res) => {
  const rows = await query(`DELETE FROM budgets WHERE id = $1 RETURNING id`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* -------------------------------- goals --------------------------------- */

const goalInput = z.object({
  title: z.string().min(1).max(80),
  asset: z.string().min(2).max(12).nullable().optional(),
  target: z.number().positive(),
  deadline: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#34d399'),
});

planningRouter.get('/goals', async (_req, res) => {
  res.json(await goalProgress());
});

planningRouter.post('/goals', async (req, res) => {
  const parsed = goalInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, asset, target, deadline, color } = parsed.data;
  const rows = await query(
    `INSERT INTO goals (title, asset, target, deadline, color) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [title, asset ? asset.toUpperCase() : null, target, deadline || null, color],
  );
  res.status(201).json(rows[0]);
});

planningRouter.patch('/goals/:id', async (req, res) => {
  const parsed = goalInput.partial().extend({ archived: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'nothing_to_update' });
  const assignments = fields.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  const rows = await query(`UPDATE goals SET ${assignments} WHERE id = $1 RETURNING *`, [
    req.params.id,
    ...fields.map(([, value]) => value),
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

planningRouter.delete('/goals/:id', async (req, res) => {
  const rows = await query(`DELETE FROM goals WHERE id = $1 RETURNING id`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/* ------------------------------ recurring -------------------------------- */

planningRouter.get('/recurring', async (_req, res) => {
  res.json(await detectRecurring());
});
