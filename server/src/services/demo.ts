import { query } from '../db.js';
import { recomputeBalances } from './sync.js';

interface DemoTx {
  daysAgo: number;
  direction: 'in' | 'out';
  asset: string;
  amount: number;
  price: number;
  fee?: number;
  category: string;
  counterparty: string;
  note: string;
}

const WALLETS = [
  { label: 'Main BTC vault', chain: 'bitcoin', address: 'demo-btc-vault', color: '#f7931a' },
  { label: 'ETH hot wallet', chain: 'ethereum', address: 'demo-eth-hot', color: '#627eea' },
  { label: 'USDT payouts', chain: 'tron', address: 'demo-tron-usdt', color: '#2ecc8f' },
];

const PLAN: DemoTx[] = [
  { daysAgo: 2, direction: 'in', asset: 'USDT', amount: 4200, price: 1, category: 'Salary & Payroll', note: 'Monthly payroll', counterparty: 'Payroll provider' },
  { daysAgo: 3, direction: 'out', asset: 'USDT', amount: 320, price: 1, category: 'Subscriptions', note: 'Cloud & SaaS subscriptions', counterparty: 'Cloud services' },
  { daysAgo: 5, direction: 'out', asset: 'ETH', amount: 0.35, price: 3100, fee: 0.002, category: 'Hardware & Software', note: 'New hardware wallet', counterparty: '0x9a1f…c2d4' },
  { daysAgo: 8, direction: 'in', asset: 'BTC', amount: 0.045, price: 68000, category: 'Trading Profit', note: 'Exchange withdrawal', counterparty: 'Exchange withdrawal' },
  { daysAgo: 11, direction: 'out', asset: 'USDT', amount: 780, price: 1, category: 'Shopping', note: 'Online purchase', counterparty: 'Merchant gateway' },
  { daysAgo: 14, direction: 'in', asset: 'ETH', amount: 0.8, price: 3050, category: 'Staking & Rewards', note: 'Staking rewards', counterparty: 'Staking pool' },
  { daysAgo: 17, direction: 'out', asset: 'BTC', amount: 0.012, price: 66500, fee: 0.0002, category: 'Investments', note: 'Move to cold storage', counterparty: 'Cold storage' },
  { daysAgo: 21, direction: 'out', asset: 'USDT', amount: 145, price: 1, category: 'Food & Cafe', note: 'Crypto card spending', counterparty: 'Crypto card' },
  { daysAgo: 26, direction: 'in', asset: 'USDT', amount: 1500, price: 1, category: 'Refund', note: 'Contract refund', counterparty: 'Contract refund' },
  { daysAgo: 33, direction: 'in', asset: 'USDT', amount: 4200, price: 1, category: 'Salary & Payroll', note: 'Monthly payroll', counterparty: 'Payroll provider' },
  { daysAgo: 37, direction: 'out', asset: 'ETH', amount: 0.22, price: 2950, fee: 0.003, category: 'Fees & Gas', note: 'Contract interaction', counterparty: '0x44be…8810' },
  { daysAgo: 44, direction: 'out', asset: 'USDT', amount: 610, price: 1, category: 'Shopping', note: 'Online purchase', counterparty: 'Merchant gateway' },
  { daysAgo: 52, direction: 'in', asset: 'BTC', amount: 0.03, price: 61000, category: 'Trading Profit', note: 'Exchange withdrawal', counterparty: 'Exchange withdrawal' },
  { daysAgo: 61, direction: 'in', asset: 'USDT', amount: 4200, price: 1, category: 'Salary & Payroll', note: 'Monthly payroll', counterparty: 'Payroll provider' },
  { daysAgo: 68, direction: 'out', asset: 'USDT', amount: 950, price: 1, category: 'Investments', note: 'Move to cold storage', counterparty: 'DCA bot' },
];

const WALLET_FOR: Record<string, number> = { BTC: 0, ETH: 1, USDT: 2 };

export async function seedDemoData(): Promise<boolean> {
  const existing = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM wallets`);
  if ((existing[0]?.count ?? 0) > 0) return false;

  const walletIds: number[] = [];
  for (const wallet of WALLETS) {
    const rows = await query<{ id: number }>(
      `INSERT INTO wallets (label, chain, address, color, last_sync)
       VALUES ($1,$2,$3,$4, now()) RETURNING id`,
      [wallet.label, wallet.chain, wallet.address, wallet.color],
    );
    walletIds.push(rows[0].id);
  }

  const categories = await query<{ id: number; name: string }>(`SELECT id, name FROM categories`);
  const categoryId = new Map(categories.map((row) => [row.name, row.id]));

  let index = 0;
  for (const tx of PLAN) {
    const walletId = walletIds[WALLET_FOR[tx.asset] ?? 0];
    const ts = new Date(Date.now() - tx.daysAgo * 86_400_000);
    await query(
      `INSERT INTO transactions
         (wallet_id, chain, tx_hash, vout, ts, direction, asset, amount, fee,
          counterparty, note, price_usd, value_usd, category_id, manual)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
       ON CONFLICT DO NOTHING`,
      [
        walletId,
        WALLETS[WALLET_FOR[tx.asset] ?? 0].chain,
        `demo-${index}`,
        0,
        ts.toISOString(),
        tx.direction,
        tx.asset,
        tx.amount,
        tx.fee ?? 0,
        tx.counterparty,
        tx.note,
        tx.price,
        tx.price * tx.amount,
        categoryId.get(tx.category) ?? null,
      ],
    );
    index += 1;
  }

  for (const walletId of walletIds) {
    await recomputeBalances(walletId);
  }
  return true;
}
