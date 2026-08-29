import { bitcoin } from './bitcoin.js';
import { arbitrum, base, ethereum, optimism, polygon } from './evm.js';
import { solana } from './solana.js';
import { tron } from './tron.js';
import type { ChainAdapter } from './types.js';

export const adapters: ChainAdapter[] = [
  bitcoin,
  ethereum,
  polygon,
  arbitrum,
  base,
  optimism,
  tron,
  solana,
];

export const adapterMap = new Map(adapters.map((adapter) => [adapter.id, adapter]));

export function getAdapter(chain: string): ChainAdapter {
  const adapter = adapterMap.get(chain);
  if (!adapter) throw new Error(`unsupported chain: ${chain}`);
  return adapter;
}

export const chainCatalog = adapters.map((adapter) => ({
  id: adapter.id,
  name: adapter.name,
  nativeAsset: adapter.nativeAsset,
  family: adapter.family,
}));
