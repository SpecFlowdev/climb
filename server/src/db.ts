import pg from 'pg';
import { config } from './config.js';

// numeric/int8 as JS numbers – balances in this app never approach 2^53.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as any[]);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS wallets (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  chain       TEXT NOT NULL,
  address     TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#2ecc8f',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync   TIMESTAMPTZ,
  sync_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain, address)
);

CREATE TABLE IF NOT EXISTS categories (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  name_ru   TEXT,
  kind      TEXT NOT NULL CHECK (kind IN ('income','expense','transfer')),
  color     TEXT NOT NULL DEFAULT '#2ecc8f',
  icon      TEXT NOT NULL DEFAULT 'tag',
  system    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS rules (
  id          SERIAL PRIMARY KEY,
  priority    INT NOT NULL DEFAULT 100,
  field       TEXT NOT NULL CHECK (field IN ('counterparty','asset','chain','note','direction')),
  operator    TEXT NOT NULL CHECK (operator IN ('equals','contains','starts_with')),
  pattern     TEXT NOT NULL,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           SERIAL PRIMARY KEY,
  wallet_id    INT REFERENCES wallets(id) ON DELETE CASCADE,
  chain        TEXT NOT NULL,
  tx_hash      TEXT NOT NULL,
  vout         INT NOT NULL DEFAULT 0,
  ts           TIMESTAMPTZ NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('in','out')),
  asset        TEXT NOT NULL,
  amount       NUMERIC(38,12) NOT NULL,
  fee          NUMERIC(38,12) NOT NULL DEFAULT 0,
  counterparty TEXT,
  note         TEXT,
  price_usd    NUMERIC(24,8),
  value_usd    NUMERIC(24,8),
  category_id  INT REFERENCES categories(id) ON DELETE SET NULL,
  internal     BOOLEAN NOT NULL DEFAULT FALSE,
  manual       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, tx_hash, asset, direction, vout)
);

CREATE INDEX IF NOT EXISTS transactions_ts_idx ON transactions (ts DESC);
CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS transactions_asset_idx ON transactions (asset);

CREATE TABLE IF NOT EXISTS balances (
  wallet_id  INT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset      TEXT NOT NULL,
  amount     NUMERIC(38,12) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_id, asset)
);

CREATE TABLE IF NOT EXISTS prices (
  asset      TEXT NOT NULL,
  currency   TEXT NOT NULL,
  price      NUMERIC(24,8) NOT NULL,
  change_24h NUMERIC(12,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset, currency)
);

CREATE TABLE IF NOT EXISTS budgets (
  id          SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  period      TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, period)
);

CREATE TABLE IF NOT EXISTS goals (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  /* Either accumulate a number of coins, or a fiat value. */
  asset       TEXT,
  target      NUMERIC(38,12) NOT NULL CHECK (target > 0),
  deadline    DATE,
  color       TEXT NOT NULL DEFAULT '#34d399',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
`;

const DEFAULT_CATEGORIES: Array<[string, string, string, string, string]> = [
  // name, name_ru, kind, color, icon
  ['Salary & Payroll', 'Зарплата', 'income', '#34d399', 'wallet'],
  ['Trading Profit', 'Доход от торговли', 'income', '#10b981', 'trending-up'],
  ['Staking & Rewards', 'Стейкинг и награды', 'income', '#22d3ee', 'sparkles'],
  ['Airdrop', 'Аирдроп', 'income', '#a855f7', 'gift'],
  ['Refund', 'Возврат', 'income', '#2dd4bf', 'undo'],
  ['Exchange Deposit', 'Пополнение биржи', 'transfer', '#3b82f6', 'exchange'],
  ['Internal Transfer', 'Внутренний перевод', 'transfer', '#94a3b8', 'shuffle'],
  ['Fees & Gas', 'Комиссии и газ', 'expense', '#f97316', 'fuel'],
  ['Shopping', 'Покупки', 'expense', '#f59e0b', 'bag'],
  ['Food & Cafe', 'Еда и кафе', 'expense', '#f0555c', 'utensils'],
  ['Subscriptions', 'Подписки', 'expense', '#a855f7', 'repeat'],
  ['Hardware & Software', 'Техника и софт', 'expense', '#3b82f6', 'cpu'],
  ['Investments', 'Инвестиции', 'expense', '#34d399', 'chart'],
  ['Withdrawal', 'Вывод средств', 'expense', '#ec4899', 'bank'],
  ['Other', 'Другое', 'expense', '#94a3b8', 'dots'],
];

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
  for (const [name, nameRu, kind, color, icon] of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO categories (name, name_ru, kind, color, icon, system)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       ON CONFLICT (name, kind) DO UPDATE
         SET name_ru = EXCLUDED.name_ru, color = EXCLUDED.color, icon = EXCLUDED.icon
         WHERE categories.system = TRUE`,
      [name, nameRu, kind, color, icon],
    );
  }
}

export async function waitForDatabase(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`[db] not ready yet (attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
