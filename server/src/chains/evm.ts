import { getJson, scaled } from './http.js';
import type { ChainAdapter, ChainMovement } from './types.js';

interface BlockscoutAddressRef {
  hash: string;
}

interface BlockscoutTx {
  hash: string;
  timestamp: string;
  value: string;
  from: BlockscoutAddressRef | null;
  to: BlockscoutAddressRef | null;
  fee?: { value: string } | null;
  status?: string | null;
}

interface BlockscoutTokenTransfer {
  transaction_hash: string;
  timestamp: string;
  from: BlockscoutAddressRef | null;
  to: BlockscoutAddressRef | null;
  token: { symbol: string | null; decimals: string | null };
  total: { value: string; decimals: string };
}

interface EvmChainSpec {
  id: string;
  name: string;
  nativeAsset: string;
  coinId: string;
  api: string;
  explorer: string;
}

const eq = (a?: string | null, b?: string | null) =>
  Boolean(a && b) && a!.toLowerCase() === b!.toLowerCase();

function createEvmAdapter(spec: EvmChainSpec): ChainAdapter {
  return {
    id: spec.id,
    name: spec.name,
    nativeAsset: spec.nativeAsset,
    coinId: spec.coinId,
    family: 'evm',
    explorerTx: (hash) => `${spec.explorer}/tx/${hash}`,
    explorerAddress: (address) => `${spec.explorer}/address/${address}`,
    validate: (address) => /^0x[a-fA-F0-9]{40}$/.test(address.trim()),
    async fetchMovements(address, limit) {
      const movements: ChainMovement[] = [];

      const native = await getJson<{ items?: BlockscoutTx[] }>(
        `${spec.api}/addresses/${address}/transactions?filter=to%20%7C%20from`,
      ).catch(() => ({ items: [] as BlockscoutTx[] }));

      for (const tx of (native.items ?? []).slice(0, limit)) {
        if (tx.status && tx.status !== 'ok') continue;
        const amount = scaled(tx.value, 18);
        const outgoing = eq(tx.from?.hash, address);
        const fee = outgoing ? scaled(tx.fee?.value, 18) : 0;
        if (amount === 0 && fee === 0) continue;
        movements.push({
          txHash: tx.hash,
          vout: 0,
          ts: new Date(tx.timestamp),
          direction: outgoing ? 'out' : 'in',
          asset: spec.nativeAsset,
          amount,
          fee,
          counterparty: (outgoing ? tx.to?.hash : tx.from?.hash) ?? null,
        });
      }

      const tokens = await getJson<{ items?: BlockscoutTokenTransfer[] }>(
        `${spec.api}/addresses/${address}/token-transfers?type=ERC-20`,
      ).catch(() => ({ items: [] as BlockscoutTokenTransfer[] }));

      let index = 1;
      for (const transfer of (tokens.items ?? []).slice(0, limit)) {
        const decimals = Number(transfer.total?.decimals ?? transfer.token?.decimals ?? 18);
        const amount = scaled(transfer.total?.value, Number.isFinite(decimals) ? decimals : 18);
        if (amount === 0) continue;
        const outgoing = eq(transfer.from?.hash, address);
        movements.push({
          txHash: transfer.transaction_hash,
          vout: index++,
          ts: new Date(transfer.timestamp),
          direction: outgoing ? 'out' : 'in',
          asset: (transfer.token?.symbol ?? 'TOKEN').toUpperCase(),
          amount,
          fee: 0,
          counterparty: (outgoing ? transfer.to?.hash : transfer.from?.hash) ?? null,
        });
      }

      return movements;
    },
  };
}

export const ethereum = createEvmAdapter({
  id: 'ethereum',
  name: 'Ethereum',
  nativeAsset: 'ETH',
  coinId: 'ethereum',
  api: process.env.ETHEREUM_API_URL ?? 'https://eth.blockscout.com/api/v2',
  explorer: 'https://etherscan.io',
});

export const polygon = createEvmAdapter({
  id: 'polygon',
  name: 'Polygon',
  nativeAsset: 'POL',
  coinId: 'matic-network',
  api: process.env.POLYGON_API_URL ?? 'https://polygon.blockscout.com/api/v2',
  explorer: 'https://polygonscan.com',
});

export const arbitrum = createEvmAdapter({
  id: 'arbitrum',
  name: 'Arbitrum One',
  nativeAsset: 'ETH',
  coinId: 'ethereum',
  api: process.env.ARBITRUM_API_URL ?? 'https://arbitrum.blockscout.com/api/v2',
  explorer: 'https://arbiscan.io',
});

export const base = createEvmAdapter({
  id: 'base',
  name: 'Base',
  nativeAsset: 'ETH',
  coinId: 'ethereum',
  api: process.env.BASE_API_URL ?? 'https://base.blockscout.com/api/v2',
  explorer: 'https://basescan.org',
});

export const optimism = createEvmAdapter({
  id: 'optimism',
  name: 'Optimism',
  nativeAsset: 'ETH',
  coinId: 'ethereum',
  api: process.env.OPTIMISM_API_URL ?? 'https://optimism.blockscout.com/api/v2',
  explorer: 'https://optimistic.etherscan.io',
});
