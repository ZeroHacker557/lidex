import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore } from './memory.js';
import { inc } from './store.js';

test('MemoryStore: Firestore semantikasi', async () => {
  const s = new MemoryStore(null);
  const t0 = new Date('2026-10-01T10:00:00Z');
  for (let i = 0; i < 5; i++) {
    await s.create('leads', {
      n: i,
      status: i % 2 ? 'new' : 'success',
      emp: i < 3 ? 'a' : null,
      tags: ['x', `t${i}`],
      createdAt: new Date(t0.getTime() + i * 60_000),
    }, `L${i}`);
  }
  const page1 = await s.query<{ n: number }>('leads', { orderBy: [['createdAt', 'desc']], limit: 2 });
  assert.deepEqual(page1.map((d) => d.n), [4, 3]);
  const page2 = await s.query<{ n: number; createdAt: Date }>('leads', {
    orderBy: [['createdAt', 'desc']],
    startAfter: [new Date(t0.getTime() + 3 * 60_000)],
    limit: 2,
  });
  assert.deepEqual(page2.map((d) => d.n), [2, 1]);

  assert.equal(await s.count('leads', { where: [['status', 'in', ['new']]] }), 2);
  assert.equal(await s.count('leads', { where: [['emp', '==', null]] }), 2);
  assert.equal(await s.count('leads', { where: [['emp', '!=', null]] }), 3);
  assert.equal(await s.count('leads', { where: [['tags', 'array-contains', 't3']] }), 1);
  assert.equal(await s.count('leads', { where: [['createdAt', '>=', new Date(t0.getTime() + 2 * 60_000)]] }), 3);

  await s.update('leads', 'L0', { n: inc(10) });
  assert.equal((await s.get<{ n: number }>('leads', 'L0'))?.n, 10);
  await assert.rejects(() => s.update('leads', 'nope', { n: 1 }));
  await assert.rejects(() => s.create('leads', {}, 'L0'));

  const agg = await s.aggregate('leads', {}, { avg: 'n', sum: 'n' });
  assert.equal(agg.count, 5);
  assert.equal(agg.sum, 10 + 1 + 2 + 3 + 4);

  // Tranzaksiyalar ketma-ket: hisoblagich yo'qolmaydi
  await Promise.all(
    Array.from({ length: 20 }, () =>
      s.runTransaction(async (tx) => {
        const c = await tx.get<{ value: number }>('counters', 'c');
        tx.set('counters', 'c', { value: (c?.value ?? 0) + 1 });
      }),
    ),
  );
  assert.equal((await s.get<{ value: number }>('counters', 'c'))?.value, 20);
});
