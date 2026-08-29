import { query } from '../db.js';

/**
 * Data behind the money map: a two-level tree of where money went.
 *
 *   total  ->  category  ->  the counterparties inside that category
 *
 * Counterparties are capped per category so one noisy address cannot bury the
 * shape of the map; whatever is left over is folded into a single "other" leaf.
 */

export interface MapLeaf {
  id: string;
  label: string;
  value: number;
  count: number;
  isOther: boolean;
}

export interface MapBranch {
  id: string;
  categoryId: number | null;
  label: string;
  labelRu: string | null;
  color: string;
  value: number;
  count: number;
  share: number;
  children: MapLeaf[];
}

export interface MoneyMap {
  direction: 'in' | 'out';
  total: number;
  transactions: number;
  branches: MapBranch[];
}

const LEAVES_PER_BRANCH = 6;

export async function moneyMap(
  year: number,
  month: number | null,
  direction: 'in' | 'out',
): Promise<MoneyMap> {
  const from = (month === null
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, month - 1, 1))
  ).toISOString();
  const to = (month === null
    ? new Date(Date.UTC(year + 1, 0, 1))
    : new Date(Date.UTC(year, month, 1))
  ).toISOString();

  const rows = await query<{
    category_id: number | null;
    name: string | null;
    name_ru: string | null;
    color: string | null;
    counterparty: string | null;
    note: string | null;
    value: number;
    count: number;
  }>(
    `SELECT t.category_id,
            c.name, c.name_ru, c.color,
            COALESCE(NULLIF(t.counterparty, ''), NULLIF(t.note, ''), t.chain) AS counterparty,
            NULL::text AS note,
            COALESCE(SUM(t.value_usd), 0) AS value,
            COUNT(*)::int AS count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.ts >= $1 AND t.ts < $2 AND t.direction = $3 AND t.internal = FALSE
      GROUP BY t.category_id, c.name, c.name_ru, c.color, 5
     HAVING COALESCE(SUM(t.value_usd), 0) > 0
      ORDER BY value DESC`,
    [from, to, direction],
  );

  const byCategory = new Map<string, MapBranch>();

  for (const row of rows) {
    const key = String(row.category_id ?? 'none');
    let branch = byCategory.get(key);
    if (!branch) {
      branch = {
        id: key,
        categoryId: row.category_id,
        label: row.name ?? 'Uncategorised',
        labelRu: row.name_ru,
        color: row.color ?? '#94a3b8',
        value: 0,
        count: 0,
        share: 0,
        children: [],
      };
      byCategory.set(key, branch);
    }
    branch.value += Number(row.value);
    branch.count += row.count;
    branch.children.push({
      id: `${key}:${row.counterparty ?? '?'}`,
      label: row.counterparty ?? '—',
      value: Number(row.value),
      count: row.count,
      isOther: false,
    });
  }

  const branches = [...byCategory.values()].sort((a, b) => b.value - a.value);
  const total = branches.reduce((sum, branch) => sum + branch.value, 0);

  for (const branch of branches) {
    branch.share = total > 0 ? (branch.value / total) * 100 : 0;
    branch.children.sort((a, b) => b.value - a.value);

    if (branch.children.length > LEAVES_PER_BRANCH) {
      const kept = branch.children.slice(0, LEAVES_PER_BRANCH);
      const rest = branch.children.slice(LEAVES_PER_BRANCH);
      kept.push({
        id: `${branch.id}:other`,
        label: 'other',
        value: rest.reduce((sum, leaf) => sum + leaf.value, 0),
        count: rest.reduce((sum, leaf) => sum + leaf.count, 0),
        isOther: true,
      });
      branch.children = kept;
    }
  }

  return {
    direction,
    total,
    transactions: branches.reduce((sum, branch) => sum + branch.count, 0),
    branches,
  };
}
