import 'node:process';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num(process.env.PORT, 8080),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://climb:climb@localhost:5432/climb',
  baseCurrency: (process.env.BASE_CURRENCY ?? 'usd').toLowerCase(),
  syncIntervalMinutes: num(process.env.SYNC_INTERVAL_MINUTES, 15),
  priceTtlSeconds: num(process.env.PRICE_TTL_SECONDS, 300),
  maxTxPerSync: num(process.env.MAX_TX_PER_SYNC, 200),
  requestTimeoutMs: num(process.env.HTTP_TIMEOUT_MS, 20000),
  coingeckoApi: process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3',
  coingeckoKey: process.env.COINGECKO_API_KEY ?? '',
  etherscanKey: process.env.ETHERSCAN_API_KEY ?? '',
  tronGridKey: process.env.TRONGRID_API_KEY ?? '',
  solanaRpc: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  demoMode: (process.env.DEMO_MODE ?? 'false').toLowerCase() === 'true',
};

export type Config = typeof config;
