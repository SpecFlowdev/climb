import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { recategorizeAll } from '../services/categorize.js';

export const categoriesRouter = Router();

const categoryInput = z.object({
  name: z.string().min(1).max(48),
  nameRu: z.string().max(48).optional(),
  kind: z.enum(['income', 'expense', 'transfer']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2ecc8f'),
  icon: z.string().max(24).default('tag'),
});

categoriesRouter.get('/', async (_req, res) => {
  res.json(
    await query(
      `SELECT c.*, COALESCE(t.count, 0)::int AS tx_count
         FROM categories c
         LEFT JOIN (SELECT category_id, COUNT(*) AS count FROM transactions GROUP BY category_id) t
                ON t.category_id = c.id
        ORDER BY c.kind, c.name`,
    ),
  );
});

categoriesRouter.post('/', async (req, res) => {
  const parsed = categoryInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, nameRu, kind, color, icon } = parsed.data;
  const rows = await query(
    `INSERT INTO categories (name, name_ru, kind, color, icon)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (name, kind) DO UPDATE SET color = EXCLUDED.color, icon = EXCLUDED.icon
     RETURNING *`,
    [name, nameRu ?? null, kind, color, icon],
  );
  res.status(201).json(rows[0]);
});

categoriesRouter.patch('/:id', async (req, res) => {
  const parsed = categoryInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const map: Record<string, string> = { nameRu: 'name_ru' };
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'nothing_to_update' });
  const assignments = fields
    .map(([key], index) => `${map[key] ?? key} = $${index + 2}`)
    .join(', ');
  const rows = await query(`UPDATE categories SET ${assignments} WHERE id = $1 RETURNING *`, [
    req.params.id,
    ...fields.map(([, value]) => value),
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

categoriesRouter.delete('/:id', async (req, res) => {
  const rows = await query(
    `DELETE FROM categories WHERE id = $1 AND system = FALSE RETURNING id`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(400).json({ error: 'system_category_or_missing' });
  res.json({ ok: true });
});

categoriesRouter.post('/recategorize', async (_req, res) => {
  res.json({ updated: await recategorizeAll() });
});
