export interface ChainMovement {
  txHash: string;
  /** Index that keeps several movements of the same tx unique. */
  vout: number;
  ts: Date;
  direction: 'in' | 'out';
  asset: string;
  amount: number;
  fee: number;
  counterparty?: string | null;
}

export interface ChainAdapter {
  id: string;
  name: string;
  nativeAsset: string;
  /** CoinGecko id of the native asset. */
  coinId: string;
  family: 'utxo' | 'evm' | 'tron' | 'solana';
  explorerTx: (hash: string) => string;
  explorerAddress: (address: string) => string;
  validate: (address: string) => boolean;
  fetchMovements: (address: string, limit: number) => Promise<ChainMovement[]>;
}

export class ChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainError';
  }
}
