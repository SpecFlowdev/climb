import { config } from '../config.js';
import { getJson } from './http.js';
import type { ChainAdapter, ChainMovement } from './types.js';

interface RpcResponse<T> {
  result: T;
  error?: { message: string };
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const res = await getJson<RpcResponse<T>>(config.solanaRpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  if (res.error) throw new Error(`solana rpc: ${res.error.message}`);
  return res.result;
}

interface SignatureInfo {
  signature: string;
  blockTime?: number | null;
  err: unknown;
}

interface TxDetails {
  blockTime?: number | null;
  meta?: {
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
  transaction?: { message: { accountKeys: Array<{ pubkey: string } | string> } };
}

interface TokenBalance {
  accountIndex: number;
  owner?: string;
  mint: string;
  uiTokenAmount: { uiAmount: number | null; decimals: number };
}

const KNOWN_MINTS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  So11111111111111111111111111111111111111112: 'WSOL',
};

export const solana: ChainAdapter = {
  id: 'solana',
  name: 'Solana',
  nativeAsset: 'SOL',
  coinId: 'solana',
  family: 'solana',
  explorerTx: (hash) => `https://solscan.io/tx/${hash}`,
  explorerAddress: (address) => `https://solscan.io/account/${address}`,
  validate: (address) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim()),
  async fetchMovements(address, limit) {
    const capped = Math.min(limit, 50);
    const signatures = await rpc<SignatureInfo[]>('getSignaturesForAddress', [
      address,
      { limit: capped },
    ]);
    const movements: ChainMovement[] = [];

    for (const sig of signatures) {
      if (sig.err) continue;
      let tx: TxDetails | null = null;
      try {
        tx = await rpc<TxDetails>('getTransaction', [
          sig.signature,
          { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' },
        ]);
      } catch {
        continue;
      }
      if (!tx?.meta) continue;

      const keys = (tx.transaction?.message.accountKeys ?? []).map((key) =>
        typeof key === 'string' ? key : key.pubkey,
      );
      const index = keys.indexOf(address);
      const ts = new Date(((tx.blockTime ?? sig.blockTime) ?? Date.now() / 1000) * 1000);

      if (index >= 0) {
        const delta =
          ((tx.meta.postBalances[index] ?? 0) - (tx.meta.preBalances[index] ?? 0)) / 1e9;
        const fee = index === 0 ? tx.meta.fee / 1e9 : 0;
        const net = delta + (index === 0 ? fee : 0);
        if (Math.abs(net) > 1e-9) {
          movements.push({
            txHash: sig.signature,
            vout: 0,
            ts,
            direction: net > 0 ? 'in' : 'out',
            asset: 'SOL',
            amount: Math.abs(net),
            fee,
            counterparty: keys.find((key) => key !== address) ?? null,
          });
        }
      }

      const pre = new Map<string, number>();
      for (const balance of tx.meta.preTokenBalances ?? []) {
        if (balance.owner !== address) continue;
        pre.set(balance.mint, balance.uiTokenAmount.uiAmount ?? 0);
      }
      let vout = 1;
      for (const balance of tx.meta.postTokenBalances ?? []) {
        if (balance.owner !== address) continue;
        const before = pre.get(balance.mint) ?? 0;
        const after = balance.uiTokenAmount.uiAmount ?? 0;
        const delta = after - before;
        if (Math.abs(delta) < 1e-9) continue;
        movements.push({
          txHash: sig.signature,
          vout: vout++,
          ts,
          direction: delta > 0 ? 'in' : 'out',
          asset: KNOWN_MINTS[balance.mint] ?? `${balance.mint.slice(0, 4)}…`,
          amount: Math.abs(delta),
          fee: 0,
          counterparty: null,
        });
      }
    }

    return movements;
  },
};
