import { query } from '../db.js';
import { isStable, priceMap } from './prices.js';

/* ------------------------------- budgets -------------------------------- */

export interface BudgetProgress {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryNameRu: string | null;
  color: string;
  period: 'month' | 'year';
  amount: number;
  spent: number;
  remaining: number;
  usedPercent: number;
  /** Share of the period already elapsed — tells you if you are ahead or behind. */
  periodElapsedPercent: number;
  status: 'ok' | 'warning' | 'over';
}

function periodBounds(period: 'month' | 'year', year: number, month: number) {
  const start =
    period === 'year' ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, month - 1, 1));
  const end =
    period === 'year' ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function budgetProgress(year: number, month: number): Promise<BudgetProgress[]> {
  const budgets = await query<{
    id: number;
    category_id: number;
    amount: number;
    period: 'month' | 'year';
    name: string;
    name_ru: string | null;
    color: string;
  }>(
    `SELECT b.id, b.category_id, b.amount, b.period, c.name, c.name_ru, c.color
       FROM budgets b JOIN categories c ON c.id = b.category_id
      ORDER BY b.amount DESC`,
  );

  const result: BudgetProgress[] = [];
  const now = Date.now();

  for (const budget of budgets) {
    const { start, end } = periodBounds(budget.period, year, month);
    const [row] = await query<{ spent: number }>(
      `SELECT COALESCE(SUM(value_usd), 0) AS spent
         FROM transactions
        WHERE category_id = $1 AND direction = 'out' AND internal = FALSE
          AND ts >= $2 AND ts < $3`,
      [budget.category_id, start.toISOString(), end.toISOString()],
    );

    const amount = Number(budget.amount);
    const spent = Number(row?.spent ?? 0);
    const usedPercent = amount > 0 ? (spent / amount) * 100 : 0;
    const elapsed =
      ((Math.min(now, end.getTime()) - start.getTime()) / (end.getTime() - start.getTime())) * 100;

    result.push({
      id: budget.id,
      categoryId: budget.category_id,
      categoryName: budget.name,
      categoryNameRu: budget.name_ru,
      color: budget.color,
      period: budget.period,
      amount,
      spent,
      remaining: amount - spent,
      usedPercent,
      periodElapsedPercent: Math.max(0, Math.min(elapsed, 100)),
      status: usedPercent >= 100 ? 'over' : usedPercent >= 80 ? 'warning' : 'ok',
    });
  }

  return result;
}

/* -------------------------------- goals --------------------------------- */

export interface GoalProgress {
  id: number;
  title: string;
  asset: string | null;
  target: number;
  current: number;
  progressPercent: number;
  /** Fiat value of what is held toward the goal, for display. */
  currentValue: number;
  targetValue: number;
  deadline: string | null;
  daysLeft: number | null;
  color: string;
  /** Monthly contribution needed to land on time. */
  requiredPerMonth: number | null;
  archived: boolean;
}

export async function goalProgress(): Promise<GoalProgress[]> {
  const goals = await query<{
    id: number;
    title: string;
    asset: string | null;
    target: number;
    deadline: string | null;
    color: string;
    archived: boolean;
  }>(`SELECT * FROM goals ORDER BY archived ASC, created_at DESC`);

  if (goals.length === 0) return [];

  const prices = await priceMap();
  const balances = await query<{ asset: string; amount: number }>(
    `SELECT UPPER(b.asset) AS asset, SUM(b.amount) AS amount
       FROM balances b JOIN wallets w ON w.id = b.wallet_id
      WHERE w.archived = FALSE
      GROUP BY 1`,
  );
  const held = new Map(balances.map((row) => [row.asset, Number(row.amount)]));
  const priceOf = (asset: string) => (isStable(asset) ? 1 : prices.get(asset)?.price ?? 0);
  const netWorth = [...held.entries()].reduce(
    (sum, [asset, amount]) => sum + amount * priceOf(asset),
    0,
  );

  return goals.map((goal) => {
    const asset = goal.asset ? goal.asset.toUpperCase() : null;
    const target = Number(goal.target);
    // An asset goal counts coins; a fiat goal counts the whole portfolio value.
    const current = asset ? held.get(asset) ?? 0 : netWorth;
    const price = asset ? priceOf(asset) : 1;

    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const daysLeft = deadline
      ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000)
      : null;
    const missing = Math.max(target - current, 0);
    const monthsLeft = daysLeft !== null ? Math.max(daysLeft / 30.44, 0.1) : null;

    return {
      id: goal.id,
      title: goal.title,
      asset,
      target,
      current,
      progressPercent: target > 0 ? Math.min((current / target) * 100, 100) : 0,
      currentValue: current * price,
      targetValue: target * price,
      deadline: goal.deadline,
      daysLeft,
      color: goal.color,
      requiredPerMonth: monthsLeft === null ? null : (missing * price) / monthsLeft,
      archived: goal.archived,
    };
  });
}

/* ------------------------------ recurring -------------------------------- */

export interface RecurringPayment {
  counterparty: string;
  asset: string;
  categoryName: string | null;
  categoryColor: string | null;
  occurrences: number;
  averageValue: number;
  /** Median gap between occurrences, in days. */
  intervalDays: number;
  lastSeen: string;
  nextExpected: string;
  monthlyEstimate: number;
}

/**
 * Finds payments that repeat on a stable cadence — subscriptions, salaries,
 * automated transfers. No configuration: it reads the history it already has.
 */
export async function detectRecurring(minOccurrences = 3): Promise<RecurringPayment[]> {
  const rows = await query<{
    counterparty: string;
    asset: string;
    ts: string;
    value_usd: number | null;
    category_name: string | null;
    category_color: string | null;
  }>(
    `SELECT t.counterparty, t.asset, t.ts, t.value_usd,
            c.name AS category_name, c.color AS category_color
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.counterparty IS NOT NULL AND t.internal = FALSE
      ORDER BY t.ts ASC`,
  );

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.counterparty.toLowerCase()}|${row.asset.toUpperCase()}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const found: RecurringPayment[] = [];

  for (const group of groups.values()) {
    if (group.length < minOccurrences) continue;

    const gaps: number[] = [];
    for (let i = 1; i < group.length; i += 1) {
      gaps.push(
        (new Date(group[i].ts).getTime() - new Date(group[i - 1].ts).getTime()) / 86_400_000,
      );
    }
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    if (!Number.isFinite(median) || median < 3 || median > 400) continue;

    // Reject groups whose spacing is all over the place — those are not a schedule.
    const spread = gaps.filter((gap) => Math.abs(gap - median) <= median * 0.4).length / gaps.length;
    if (spread < 0.6) continue;

    const last = group[group.length - 1];
    const averageValue =
      group.reduce((sum, row) => sum + Math.abs(Number(row.value_usd ?? 0)), 0) / group.length;

    found.push({
      counterparty: last.counterparty,
      asset: last.asset.toUpperCase(),
      categoryName: last.category_name,
      categoryColor: last.category_color,
      occurrences: group.length,
      averageValue,
      intervalDays: Math.round(median),
      lastSeen: last.ts,
      nextExpected: new Date(new Date(last.ts).getTime() + median * 86_400_000).toISOString(),
      monthlyEstimate: averageValue * (30.44 / median),
    });
  }

  return found.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}
