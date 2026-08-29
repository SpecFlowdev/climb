import assert from 'node:assert/strict';
import { test } from 'node:test';
// Tests run against the compiled output, so they exercise exactly what ships.
import { computeAssetPnl } from '../dist/services/pnl.js';

const mv = (
  ts: string,
  direction: 'in' | 'out',
  amount: number,
  price: number,
  fee = 0,
) => ({ ts, direction, asset: 'BTC', amount, fee, price_usd: price });

test('a single purchase leaves one open lot at its cost', () => {
  const result = computeAssetPnl('BTC', [mv('2024-01-01', 'in', 1, 20000)]);
  assert.equal(result.openAmount, 1);
  assert.equal(result.costBasis, 20000);
  assert.equal(result.avgCost, 20000);
  assert.equal(result.realized, 0);
});

test('averages the cost of several purchases', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'in', 1, 30000),
  ]);
  assert.equal(result.openAmount, 2);
  assert.equal(result.avgCost, 25000);
});

test('sells the oldest lot first and realises its gain', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'in', 1, 30000),
    mv('2024-03-01', 'out', 1, 40000),
  ]);
  // FIFO disposes the $20k coin: 40000 - 20000 = 20000 realised.
  assert.equal(result.realized, 20000);
  assert.equal(result.openAmount, 1);
  // What is left is the $30k lot, not the blended average.
  assert.equal(result.avgCost, 30000);
});

test('a partial sale splits the lot without touching the next one', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'in', 1, 30000),
    mv('2024-03-01', 'out', 0.5, 40000),
  ]);
  assert.equal(result.realized, 10000);
  assert.equal(result.openAmount, 1.5);
  assert.equal(result.lots.length, 2);
  assert.equal(result.lots[0].amount, 0.5);
});

test('a sale spanning two lots realises both gains', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'in', 1, 30000),
    mv('2024-03-01', 'out', 1.5, 40000),
  ]);
  // 1 @ 20k -> +20000, then 0.5 @ 30k -> +5000
  assert.equal(result.realized, 25000);
  assert.equal(result.openAmount, 0.5);
});

test('a loss is realised as a negative number', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 50000),
    mv('2024-02-01', 'out', 1, 30000),
  ]);
  assert.equal(result.realized, -20000);
  assert.equal(result.openAmount, 0);
});

test('a network fee is a disposal with no proceeds', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'out', 0.5, 30000, 0.01),
  ]);
  // Sale realises 0.5 * (30000 - 20000) = 5000, the fee burns 0.01 * 20000 = 200.
  assert.equal(result.realized, 4800);
  assert.ok(Math.abs(result.openAmount - 0.49) < 1e-9);
});

test('disposing more than was ever acquired does not invent negative stock', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 0.5, 20000),
    mv('2024-02-01', 'out', 1, 30000),
  ]);
  // 0.5 covered by the lot (+5000), 0.5 uncovered counted at full proceeds (+15000).
  assert.equal(result.realized, 20000);
  assert.equal(result.openAmount, 0);
  assert.equal(result.lots.length, 0);
});

test('tracks how much was bought and sold in fiat', () => {
  const result = computeAssetPnl('BTC', [
    mv('2024-01-01', 'in', 1, 20000),
    mv('2024-02-01', 'out', 0.5, 30000),
  ]);
  assert.equal(result.bought, 20000);
  assert.equal(result.sold, 15000);
});

test('a movement with an unknown price is treated as zero cost, not NaN', () => {
  const result = computeAssetPnl('BTC', [
    { ts: '2024-01-01', direction: 'in', asset: 'BTC', amount: 1, fee: 0, price_usd: null },
  ]);
  assert.equal(result.costBasis, 0);
  assert.ok(Number.isFinite(result.avgCost));
});
