import { query } from '../db.js';
import { isStable, priceMap } from './prices.js';

/**
 * Cost-basis engine.
 *
 * Every incoming movement opens a lot at the price it was acquired for; every
 * outgoing movement closes lots oldest-first (FIFO) and realises the difference.
 * That gives the two numbers a crypto holder actually cares about: what the
 * position cost, and how much of the gain is already banked.
 */

export interface Lot {
  ts: string;
  amount: number;
  costPerUnit: number;
}

export interface AssetPosition {
  asset: string;
  amount: number;
  price: number;
  value: number;
  change24h: number | null;
  /** Weighted average price of the lots still open. */
  avgCost: number;
  /** What the open position cost in total. */
  costBasis: number;
  /** Gain if the whole open position were sold at the current price. */
  unrealized: number;
  unrealizedPercent: number;
  /** Gain already banked by past disposals. */
  realized: number;
  totalPnl: number;
  bought: number;
  sold: number;
  txCount: number;
  firstSeen: string | null;
  lastActivity: string | null;
  openLots: Lot[];
}

interface MovementRow {
  ts: string;
  direction: 'in' | 'out';
  asset: string;
  amount: number;
  fee: number;
  price_usd: number | null;
}

/** Runs FIFO over one asset's movements, oldest first. */
export function computeAssetPnl(asset: string, movements: MovementRow[]) {
  const lots: Lot[] = [];
  let realized = 0;
  let bought = 0;
  let sold = 0;

  for (const movement of movements) {
    const amount = Number(movement.amount);
    const price = movement.price_usd === null ? 0 : Number(movement.price_usd);

    if (movement.direction === 'in') {
      if (amount > 0) lots.push({ ts: movement.ts, amount, costPerUnit: price });
      bought += amount * price;
    } else {
      let remaining = amount;
      sold += amount * price;
      while (remaining > 1e-12 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.amount, remaining);
        realized += take * (price - lot.costPerUnit);
        lot.amount -= take;
        remaining -= take;
        if (lot.amount <= 1e-12) lots.shift();
      }
      // Disposing more than we ever saw acquired (partial history) — treat the
      // uncovered part as pure gain rather than inventing a negative lot.
      if (remaining > 1e-12) realized += remaining * price;
    }

    // A network fee is a disposal of the same asset with no proceeds.
    const fee = Number(movement.fee ?? 0);
    if (fee > 0) {
      let remaining = fee;
      while (remaining > 1e-12 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.amount, remaining);
        realized -= take * lot.costPerUnit;
        lot.amount -= take;
        remaining -= take;
        if (lot.amount <= 1e-12) lots.shift();
      }
    }
  }

  const openAmount = lots.reduce((sum, lot) => sum + lot.amount, 0);
  const costBasis = lots.reduce((sum, lot) => sum + lot.amount * lot.costPerUnit, 0);

  return {
    asset,
    openAmount,
    costBasis,
    avgCost: openAmount > 1e-12 ? costBasis / openAmount : 0,
    realized,
    bought,
    sold,
    lots,
  };
}

async function movementsByAsset(asset?: string) {
  const rows = await query<MovementRow>(
    `SELECT ts, direction, asset, amount, fee, price_usd
       FROM transactions
      ${asset ? 'WHERE UPPER(asset) = $1' : ''}
      ORDER BY ts ASC, id ASC`,
    asset ? [asset.toUpperCase()] : [],
  );
  const grouped = new Map<string, MovementRow[]>();
  for (const row of rows) {
    const key = row.asset.toUpperCase();
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

export async function positions(): Promise<AssetPosition[]> {
  const [grouped, prices, balances] = await Promise.all([
    movementsByAsset(),
    priceMap(),
    query<{ asset: string; amount: number }>(
      `SELECT UPPER(b.asset) AS asset, SUM(b.amount) AS amount
         FROM balances b JOIN wallets w ON w.id = b.wallet_id
        WHERE w.archived = FALSE
        GROUP BY 1`,
    ),
  ]);

  const held = new Map(balances.map((row) => [row.asset, Number(row.amount)]));
  const result: AssetPosition[] = [];

  for (const [asset, movements] of grouped) {
    const pnl = computeAssetPnl(asset, movements);
    // Trust the ledger balance when we have one, fall back to the lot total.
    const amount = held.get(asset) ?? pnl.openAmount;
    if (Math.abs(amount) < 1e-12 && Math.abs(pnl.realized) < 0.01) continue;

    const price = isStable(asset) ? 1 : prices.get(asset)?.price ?? 0;
    const value = amount * price;
    const costBasis = pnl.avgCost * amount;
    const unrealized = value - costBasis;

    result.push({
      asset,
      amount,
      price,
      value,
      change24h: prices.get(asset)?.change_24h ?? (isStable(asset) ? 0 : null),
      avgCost: pnl.avgCost,
      costBasis,
      unrealized,
      unrealizedPercent: costBasis > 0 ? (unrealized / costBasis) * 100 : 0,
      realized: pnl.realized,
      totalPnl: unrealized + pnl.realized,
      bought: pnl.bought,
      sold: pnl.sold,
      txCount: movements.length,
      firstSeen: movements[0]?.ts ?? null,
      lastActivity: movements[movements.length - 1]?.ts ?? null,
      openLots: pnl.lots.filter((lot) => lot.amount > 1e-12),
    });
  }

  return result.sort((a, b) => b.value - a.value);
}

export async function positionFor(asset: string): Promise<AssetPosition | null> {
  const all = await positions();
  return all.find((item) => item.asset === asset.toUpperCase()) ?? null;
}
