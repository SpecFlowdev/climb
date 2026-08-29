import { config } from '../config.js';
import { getAdapter } from '../chains/index.js';
import { query } from '../db.js';
import { categoryIdFor, defaultCategoryIds, loadRules } from './categorize.js';
import { priceOf, refreshPrices } from './prices.js';

export interface WalletRow {
  id: number;
  label: string;
  chain: string;
  address: string;
  color: string;
  archived: boolean;
  last_sync: string | null;
  sync_error: string | null;
}

export interface SyncResult {
  walletId: number;
  label: string;
  imported: number;
  scanned: number;
  error?: string;
}

let running = false;

export function isSyncing(): boolean {
  return running;
}

export async function syncWallet(wallet: WalletRow): Promise<SyncResult> {
  const adapter = getAdapter(wallet.chain);
  const rules = await loadRules();
  const fallback = await defaultCategoryIds();
  const known = await query<{ address: string }>(`SELECT address FROM wallets`);
  const ownAddresses = new Set(known.map((row) => row.address.toLowerCase()));

  try {
    const movements = await adapter.fetchMovements(wallet.address, config.maxTxPerSync);
    const assets = [...new Set(movements.map((m) => m.asset))];
    await refreshPrices([...assets, adapter.nativeAsset]);

    let imported = 0;
    for (const movement of movements) {
      const internal = Boolean(
        movement.counterparty && ownAddresses.has(movement.counterparty.toLowerCase()),
      );
      const price = await priceOf(movement.asset);
      const categoryId = await categoryIdFor(
        {
          counterparty: movement.counterparty,
          asset: movement.asset,
          chain: wallet.chain,
          direction: movement.direction,
          internal,
        },
        rules,
        fallback,
      );
      const rows = await query<{ id: number }>(
        `INSERT INTO transactions
           (wallet_id, chain, tx_hash, vout, ts, direction, asset, amount, fee,
            counterparty, price_usd, value_usd, category_id, internal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (wallet_id, tx_hash, asset, direction, vout) DO NOTHING
         RETURNING id`,
        [
          wallet.id,
          wallet.chain,
          movement.txHash,
          movement.vout,
          movement.ts.toISOString(),
          movement.direction,
          movement.asset,
          movement.amount,
          movement.fee,
          movement.counterparty ?? null,
          price,
          price === null ? null : price * movement.amount,
          categoryId,
          internal,
        ],
      );
      if (rows.length > 0) imported += 1;
    }

    await recomputeBalances(wallet.id);
    await query(`UPDATE wallets SET last_sync = now(), sync_error = NULL WHERE id = $1`, [
      wallet.id,
    ]);
    return { walletId: wallet.id, label: wallet.label, imported, scanned: movements.length };
  } catch (error) {
    const message = (error as Error).message ?? 'unknown error';
    await query(`UPDATE wallets SET last_sync = now(), sync_error = $2 WHERE id = $1`, [
      wallet.id,
      message,
    ]);
    return { walletId: wallet.id, label: wallet.label, imported: 0, scanned: 0, error: message };
  }
}

export async function recomputeBalances(walletId: number): Promise<void> {
  await query(`DELETE FROM balances WHERE wallet_id = $1`, [walletId]);
  await query(
    `INSERT INTO balances (wallet_id, asset, amount, updated_at)
     SELECT wallet_id,
            asset,
            SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) - SUM(fee),
            now()
       FROM transactions
      WHERE wallet_id = $1
      GROUP BY wallet_id, asset`,
    [walletId],
  );
}

export async function syncAll(): Promise<SyncResult[]> {
  if (running) return [];
  running = true;
  try {
    const wallets = await query<WalletRow>(
      `SELECT * FROM wallets WHERE archived = FALSE ORDER BY id`,
    );
    const results: SyncResult[] = [];
    for (const wallet of wallets) {
      results.push(await syncWallet(wallet));
    }
    return results;
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  const minutes = config.syncIntervalMinutes;
  if (minutes <= 0) return;
  setInterval(() => {
    syncAll()
      .then((results) => {
        const imported = results.reduce((sum, r) => sum + r.imported, 0);
        if (imported > 0) console.log(`[sync] scheduled run imported ${imported} movements`);
      })
      .catch((error) => console.warn('[sync] scheduled run failed:', error.message));
  }, minutes * 60_000);
  console.log(`[sync] scheduler enabled, every ${minutes} min`);
}
