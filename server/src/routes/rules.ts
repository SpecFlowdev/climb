import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

export const rulesRouter = Router();

const ruleInput = z.object({
  field: z.enum(['counterparty', 'asset', 'chain', 'note', 'direction']),
  operator: z.enum(['equals', 'contains', 'starts_with']),
  pattern: z.string().min(1).max(120),
  categoryId: z.number().int().positive(),
  priority: z.number().int().min(1).max(999).default(100),
  enabled: z.boolean().default(true),
});

rulesRouter.get('/', async (_req, res) => {
  res.json(
    await query(
      `SELECT r.*, c.name AS category_name, c.color AS category_color
         FROM rules r JOIN categories c ON c.id = r.category_id
        ORDER BY r.priority ASC, r.id ASC`,
    ),
  );
});

rulesRouter.post('/', async (req, res) => {
  const parsed = ruleInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { field, operator, pattern, categoryId, priority, enabled } = parsed.data;
  const rows = await query(
    `INSERT INTO rules (field, operator, pattern, category_id, priority, enabled)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [field, operator, pattern, categoryId, priority, enabled],
  );
  res.status(201).json(rows[0]);
});

rulesRouter.patch('/:id', async (req, res) => {
  const parsed = ruleInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const map: Record<string, string> = { categoryId: 'category_id' };
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return res.status(400).json({ error: 'nothing_to_update' });
  const assignments = fields
    .map(([key], index) => `${map[key] ?? key} = $${index + 2}`)
    .join(', ');
  const rows = await query(`UPDATE rules SET ${assignments} WHERE id = $1 RETURNING *`, [
    req.params.id,
    ...fields.map(([, value]) => value),
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

rulesRouter.delete('/:id', async (req, res) => {
  const rows = await query(`DELETE FROM rules WHERE id = $1 RETURNING id`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});
