import { config } from '../config.js';
import { getJson, scaled } from './http.js';
import type { ChainAdapter, ChainMovement } from './types.js';

const API = process.env.TRONGRID_API_URL ?? 'https://api.trongrid.io';

const headers = () =>
  config.tronGridKey ? { 'TRON-PRO-API-KEY': config.tronGridKey } : undefined;

interface TronTx {
  txID: string;
  block_timestamp: number;
  raw_data?: {
    contract?: Array<{
      type: string;
      parameter?: { value?: { amount?: number; owner_address?: string; to_address?: string } };
    }>;
  };
  ret?: Array<{ contractRet?: string; fee?: number }>;
}

interface Trc20Tx {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info: { symbol: string; decimals: number };
}

export const tron: ChainAdapter = {
  id: 'tron',
  name: 'TRON',
  nativeAsset: 'TRX',
  coinId: 'tron',
  family: 'tron',
  explorerTx: (hash) => `https://tronscan.org/#/transaction/${hash}`,
  explorerAddress: (address) => `https://tronscan.org/#/address/${address}`,
  validate: (address) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim()),
  async fetchMovements(address, limit) {
    const movements: ChainMovement[] = [];
    const capped = Math.min(limit, 200);

    const native = await getJson<{ data?: TronTx[] }>(
      `${API}/v1/accounts/${address}/transactions?limit=${capped}&order_by=block_timestamp,desc`,
      { headers: headers() },
    ).catch(() => ({ data: [] as TronTx[] }));

    for (const tx of native.data ?? []) {
      const contract = tx.raw_data?.contract?.[0];
      if (contract?.type !== 'TransferContract') continue;
      if (tx.ret?.[0]?.contractRet && tx.ret[0].contractRet !== 'SUCCESS') continue;
      const value = contract.parameter?.value;
      const amount = scaled(value?.amount ?? 0, 6);
      if (amount === 0) continue;
      const outgoing = hexToBase58Like(value?.owner_address) === address;
      movements.push({
        txHash: tx.txID,
        vout: 0,
        ts: new Date(tx.block_timestamp),
        direction: outgoing ? 'out' : 'in',
        asset: 'TRX',
        amount,
        fee: outgoing ? scaled(tx.ret?.[0]?.fee ?? 0, 6) : 0,
        counterparty: outgoing
          ? hexToBase58Like(value?.to_address)
          : hexToBase58Like(value?.owner_address),
      });
    }

    const trc20 = await getJson<{ data?: Trc20Tx[] }>(
      `${API}/v1/accounts/${address}/transactions/trc20?limit=${capped}&order_by=block_timestamp,desc`,
      { headers: headers() },
    ).catch(() => ({ data: [] as Trc20Tx[] }));

    let index = 1;
    for (const tx of trc20.data ?? []) {
      const amount = scaled(tx.value, tx.token_info?.decimals ?? 6);
      if (amount === 0) continue;
      const outgoing = tx.from === address;
      movements.push({
        txHash: tx.transaction_id,
        vout: index++,
        ts: new Date(tx.block_timestamp),
        direction: outgoing ? 'out' : 'in',
        asset: (tx.token_info?.symbol ?? 'TRC20').toUpperCase(),
        amount,
        fee: 0,
        counterparty: outgoing ? tx.to : tx.from,
      });
    }

    return movements;
  },
};

/**
 * TronGrid returns owner/to addresses as hex (41...) for native transfers.
 * We keep the hex form when it cannot be mapped, it is still a stable id.
 */
function hexToBase58Like(hex?: string): string | null {
  if (!hex) return null;
  return hex;
}
