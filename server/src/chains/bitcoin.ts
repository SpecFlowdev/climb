import { getJson, scaled } from './http.js';
import type { ChainAdapter, ChainMovement } from './types.js';

const API = 'https://blockstream.info/api';

interface EsploraTx {
  txid: string;
  status: { block_time?: number; confirmed: boolean };
  fee: number;
  vin: Array<{ prevout?: { scriptpubkey_address?: string; value: number } }>;
  vout: Array<{ scriptpubkey_address?: string; value: number }>;
}

export const bitcoin: ChainAdapter = {
  id: 'bitcoin',
  name: 'Bitcoin',
  nativeAsset: 'BTC',
  coinId: 'bitcoin',
  family: 'utxo',
  explorerTx: (hash) => `https://blockstream.info/tx/${hash}`,
  explorerAddress: (address) => `https://blockstream.info/address/${address}`,
  validate: (address) =>
    /^(bc1[ac-hj-np-z02-9]{7,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address.trim()),
  async fetchMovements(address, limit) {
    const txs = await getJson<EsploraTx[]>(`${API}/address/${address}/txs`);
    const movements: ChainMovement[] = [];
    for (const tx of txs.slice(0, limit)) {
      const inputs = tx.vin.filter((v) => v.prevout?.scriptpubkey_address === address);
      const outputs = tx.vout.filter((v) => v.scriptpubkey_address === address);
      const spent = inputs.reduce((sum, v) => sum + (v.prevout?.value ?? 0), 0);
      const received = outputs.reduce((sum, v) => sum + v.value, 0);
      const ts = new Date((tx.status.block_time ?? Date.now() / 1000) * 1000);
      const net = received - spent;
      if (net === 0) continue;
      const counterparty =
        net > 0
          ? tx.vin.find((v) => v.prevout?.scriptpubkey_address !== address)?.prevout
              ?.scriptpubkey_address
          : tx.vout.find((v) => v.scriptpubkey_address !== address)?.scriptpubkey_address;
      const fee = net > 0 ? 0 : scaled(tx.fee, 8);
      movements.push({
        txHash: tx.txid,
        vout: 0,
        ts,
        direction: net > 0 ? 'in' : 'out',
        asset: 'BTC',
        // `net` for an outgoing tx already includes the miner fee, keep them apart.
        amount: Math.max(scaled(Math.abs(net), 8) - fee, 0),
        fee,
        counterparty: counterparty ?? null,
      });
    }
    return movements;
  },
};
