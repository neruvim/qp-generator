import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { parseCount, randomBelow } from '../src/random';
import { LotteryStore, openDatabase } from '../src/storage';

describe('input and unbiased randomness', () => {
  it.each(['', '0', '-1', '1.5', '1e3', 'abc', '9007199254740992'])('rejects %s', input => {
    expect(() => parseCount(input)).toThrow();
  });
  it.each([1, 20, 1000, 10000, Number.MAX_SAFE_INTEGER])('accepts %s', count => {
    expect(parseCount(String(count))).toBe(count);
  });
  it('rejects the biased tail of the random range', () => {
    const samples = [(1n << 53n) - 1n, 19n];
    expect(randomBelow(10, () => samples.shift()!)).toBe(9);
    expect(samples).toHaveLength(0);
  });
  it('maps equal-size buckets uniformly', () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0n; i < 400n; i++) counts[randomBelow(4, () => i)]++;
    expect(counts).toEqual([100, 100, 100, 100]);
  });
});

async function fixture() {
  const db = await openDatabase(crypto.randomUUID());
  return { db, store: new LotteryStore(db) };
}

describe('transactional sparse shuffle', () => {
  it.each([1, 20, 150, 1000, 10000])('draws every number once for N=%s', async total => {
    const { store, db } = await fixture();
    await store.start(total);
    const seen = new Set<number>();
    for (let i = 0; i < total; i++) {
      const state = await store.draw();
      expect(state.last).toBeGreaterThanOrEqual(1);
      expect(state.last).toBeLessThanOrEqual(total);
      expect(seen.has(state.last!)).toBe(false);
      seen.add(state.last!);
      expect(state.remaining).toBe(total - i - 1);
    }
    expect(seen.size).toBe(total);
    await expect(store.draw()).rejects.toThrow();
    db.close();
  }, 30000);

  it('enumerates all six equally probable sequences for three players', async () => {
    const sequences = new Set<string>();
    for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
      const { store, db } = await fixture();
      await store.start(3);
      const values = [];
      for (const index of [a, b, 0]) values.push((await store.draw(() => index)).last);
      sequences.add(values.join(','));
      db.close();
    }
    expect(sequences.size).toBe(6);
  });

  it('starts at the safe integer limit with constant storage and restores swaps', async () => {
    const name = crypto.randomUUID();
    let db = await openDatabase(name);
    let store = new LotteryStore(db);
    await store.start(Number.MAX_SAFE_INTEGER);
    expect((await store.draw(() => 0)).last).toBe(1);
    db.close();
    db = await openDatabase(name);
    store = new LotteryStore(db);
    expect((await store.draw(() => 0)).last).toBe(Number.MAX_SAFE_INTEGER);
    expect(await store.history(0)).toEqual([{ order: 2, value: Number.MAX_SAFE_INTEGER }, { order: 1, value: 1 }]);
    db.close();
  });

  it('aborts all writes if history cannot be saved', async () => {
    const { store, db } = await fixture();
    const before = await store.start(3);
    const tx = db.transaction('history', 'readwrite');
    tx.objectStore('history').add({ order: 1, value: 99 });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
    await expect(store.draw(() => 0)).rejects.toThrow();
    expect(await store.read()).toEqual(before);
    const cleanup = db.transaction('history', 'readwrite');
    cleanup.objectStore('history').clear();
    await new Promise<void>(resolve => { cleanup.oncomplete = () => resolve(); });
    expect((await store.draw(() => 0)).last).toBe(1);
    db.close();
  });

  it('resets results but keeps participant count and animation preference', async () => {
    const { store, db } = await fixture();
    await store.start(123);
    await store.setAnimation(false);
    await store.draw();
    expect(await store.reset()).toEqual({ active: false, total: 123, remaining: 123, last: null, animation: false });
    expect(await store.history(0)).toEqual([]);
    await store.start(1);
    expect((await store.draw()).last).toBe(1);
    db.close();
  });

  it('paginates ordered history', async () => {
    const { store, db } = await fixture();
    await store.start(100);
    for (let i = 0; i < 55; i++) await store.draw();
    expect((await store.history(0)).map(item => item.order)).toEqual(Array.from({ length: 50 }, (_, index) => 55 - index));
    expect((await store.history(1)).map(item => item.order)).toEqual([5, 4, 3, 2, 1]);
    db.close();
  });
});
