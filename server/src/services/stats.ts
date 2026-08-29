import { query } from '../db.js';
import { isStable, priceMap } from './prices.js';

export interface Period {
  year: number;
  month: number | null; // null = whole year
}

function range(period: Period): [string, string] {
  const start =
    period.month === null
      ? new Date(Date.UTC(period.year, 0, 1))
      : new Date(Date.UTC(period.year, period.month - 1, 1));
  const end =
    period.month === null
      ? new Date(Date.UTC(period.year + 1, 0, 1))
      : new Date(Date.UTC(period.year, period.month, 1));
  return [start.toISOString(), end.toISOString()];
}

export async function summary(period: Period) {
  const [from, to] = range(period);
  const rows = await query<{ direction: string; total: number; fees: number }>(
    `SELECT direction,
            COALESCE(SUM(value_usd), 0) AS total,
            COALESCE(SUM(fee * COALESCE(price_usd, 0)), 0) AS fees
       FROM transactions
      WHERE ts >= $1 AND ts < $2 AND internal = FALSE
      GROUP BY direction`,
    [from, to],
  );
  const income = rows.find((r) => r.direction === 'in')?.total ?? 0;
  const expense = rows.find((r) => r.direction === 'out')?.total ?? 0;
  const fees = rows.reduce((sum, row) => sum + Number(row.fees ?? 0), 0);
  const net = income - expense - fees;
  const counts = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE ts >= $1 AND ts < $2`,
    [from, to],
  );
  return {
    income,
    expense: expense + fees,
    fees,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    transactions: counts[0]?.count ?? 0,
  };
}

export async function byCategory(period: Period, direction: 'in' | 'out') {
  const [from, to] = range(period);
  return query<{
    category_id: number | null;
    name: string | null;
    name_ru: string | null;
    color: string | null;
    icon: string | null;
    total: number;
    count: number;
  }>(
    `SELECT t.category_id,
            c.name, c.name_ru, c.color, c.icon,
            COALESCE(SUM(t.value_usd), 0) AS total,
            COUNT(*)::int AS count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.ts >= $1 AND t.ts < $2 AND t.direction = $3 AND t.internal = FALSE
      GROUP BY t.category_id, c.name, c.name_ru, c.color, c.icon
      HAVING COALESCE(SUM(t.value_usd), 0) > 0
      ORDER BY total DESC`,
    [from, to, direction],
  );
}

export async function byAsset(period: Period) {
  const [from, to] = range(period);
  return query<{ asset: string; income: number; expense: number; count: number }>(
    `SELECT asset,
            COALESCE(SUM(CASE WHEN direction = 'in' THEN value_usd END), 0) AS income,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN value_usd END), 0) AS expense,
            COUNT(*)::int AS count
       FROM transactions
      WHERE ts >= $1 AND ts < $2 AND internal = FALSE
      GROUP BY asset
      ORDER BY (COALESCE(SUM(value_usd), 0)) DESC`,
    [from, to],
  );
}

export async function cashflow(year: number) {
  const rows = await query<{ month: number; income: number; expense: number }>(
    `SELECT EXTRACT(MONTH FROM ts)::int AS month,
            COALESCE(SUM(CASE WHEN direction = 'in' THEN value_usd END), 0) AS income,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN value_usd END), 0) AS expense
       FROM transactions
      WHERE ts >= $1 AND ts < $2 AND internal = FALSE
      GROUP BY 1
      ORDER BY 1`,
    [
      new Date(Date.UTC(year, 0, 1)).toISOString(),
      new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    ],
  );
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const row = byMonth.get(index + 1);
    const income = Number(row?.income ?? 0);
    const expense = Number(row?.expense ?? 0);
    return { month: index + 1, income, expense, net: income - expense };
  });
}

export async function portfolio() {
  const prices = await priceMap();
  const rows = await query<{
    asset: string;
    amount: number;
    wallet_id: number;
    label: string;
    chain: string;
    color: string;
  }>(
    `SELECT b.asset, b.amount, b.wallet_id, w.label, w.chain, w.color
       FROM balances b
       JOIN wallets w ON w.id = b.wallet_id
      WHERE w.archived = FALSE AND b.amount <> 0`,
  );

  const assets = new Map<
    string,
    { asset: string; amount: number; price: number; value: number; change24h: number | null }
  >();
  const chains = new Map<string, number>();
  const wallets = new Map<number, { id: number; label: string; chain: string; color: string; value: number }>();

  for (const row of rows) {
    const upper = row.asset.toUpperCase();
    const price = isStable(upper) ? 1 : prices.get(upper)?.price ?? 0;
    const value = price * Number(row.amount);
    const existing = assets.get(upper);
    if (existing) {
      existing.amount += Number(row.amount);
      existing.value += value;
    } else {
      assets.set(upper, {
        asset: upper,
        amount: Number(row.amount),
        price,
        value,
        change24h: prices.get(upper)?.change_24h ?? (isStable(upper) ? 0 : null),
      });
    }
    chains.set(row.chain, (chains.get(row.chain) ?? 0) + value);
    const wallet = wallets.get(row.wallet_id) ?? {
      id: row.wallet_id,
      label: row.label,
      chain: row.chain,
      color: row.color,
      value: 0,
    };
    wallet.value += value;
    wallets.set(row.wallet_id, wallet);
  }

  const assetList = [...assets.values()].sort((a, b) => b.value - a.value);
  const total = assetList.reduce((sum, item) => sum + item.value, 0);
  const change24h = assetList.reduce(
    (sum, item) => sum + (item.change24h === null ? 0 : (item.value * item.change24h) / 100),
    0,
  );

  return {
    total,
    change24h,
    changePercent24h: total > 0 ? (change24h / total) * 100 : 0,
    assets: assetList.map((item) => ({
      ...item,
      share: total > 0 ? (item.value / total) * 100 : 0,
    })),
    chains: [...chains.entries()]
      .map(([chain, value]) => ({ chain, value, share: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value),
    wallets: [...wallets.values()].sort((a, b) => b.value - a.value),
  };
}

/** Net worth reconstructed backwards from the current balances and the tx history. */
export async function netWorthSeries(days: number) {
  const current = await portfolio();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await query<{ day: string; delta: number }>(
    `SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(CASE WHEN direction = 'in' THEN value_usd ELSE -value_usd END), 0) AS delta
       FROM transactions
      WHERE ts >= $1
      GROUP BY 1
      ORDER BY 1`,
    [since],
  );
  const deltas = new Map(rows.map((row) => [row.day, Number(row.delta)]));

  const series: Array<{ date: string; value: number }> = [];
  let value = current.total;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
    series.push({ date, value: Math.max(value, 0) });
    value -= deltas.get(date) ?? 0;
  }
  return series.reverse();
}
