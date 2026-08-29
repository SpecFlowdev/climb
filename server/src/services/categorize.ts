import { query } from '../db.js';

export interface RuleRow {
  id: number;
  priority: number;
  field: 'counterparty' | 'asset' | 'chain' | 'note' | 'direction';
  operator: 'equals' | 'contains' | 'starts_with';
  pattern: string;
  category_id: number;
  enabled: boolean;
}

export interface Categorizable {
  counterparty?: string | null;
  asset: string;
  chain: string;
  note?: string | null;
  direction: 'in' | 'out';
  internal?: boolean;
}

export async function loadRules(): Promise<RuleRow[]> {
  return query<RuleRow>(
    `SELECT * FROM rules WHERE enabled = TRUE ORDER BY priority ASC, id ASC`,
  );
}

export function matchRule(rule: RuleRow, tx: Categorizable): boolean {
  const value = String(tx[rule.field] ?? '').toLowerCase();
  const pattern = rule.pattern.toLowerCase();
  if (!value) return false;
  if (rule.operator === 'equals') return value === pattern;
  if (rule.operator === 'starts_with') return value.startsWith(pattern);
  return value.includes(pattern);
}

export async function categoryIdFor(
  tx: Categorizable,
  rules: RuleRow[],
  fallback: { internal?: number; income?: number; expense?: number },
): Promise<number | null> {
  if (tx.internal && fallback.internal) return fallback.internal;
  for (const rule of rules) {
    if (matchRule(rule, tx)) return rule.category_id;
  }
  return (tx.direction === 'in' ? fallback.income : fallback.expense) ?? null;
}

export async function defaultCategoryIds(): Promise<{
  internal?: number;
  income?: number;
  expense?: number;
}> {
  const rows = await query<{ id: number; name: string }>(
    `SELECT id, name FROM categories WHERE name IN ('Internal Transfer','Other','Trading Profit')`,
  );
  const byName = new Map(rows.map((row) => [row.name, row.id]));
  return {
    internal: byName.get('Internal Transfer'),
    income: byName.get('Trading Profit'),
    expense: byName.get('Other'),
  };
}

/** Re-runs the rule engine over stored transactions (manual overrides are kept). */
export async function recategorizeAll(): Promise<number> {
  const rules = await loadRules();
  const fallback = await defaultCategoryIds();
  const rows = await query<any>(
    `SELECT id, counterparty, asset, chain, note, direction, internal FROM transactions WHERE manual = FALSE`,
  );
  let updated = 0;
  for (const row of rows) {
    const categoryId = await categoryIdFor(row, rules, fallback);
    if (categoryId) {
      await query(`UPDATE transactions SET category_id = $1 WHERE id = $2`, [categoryId, row.id]);
      updated += 1;
    }
  }
  return updated;
}
