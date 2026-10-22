import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COL, db, setStore } from '../db/index.js';
import { MemoryStore } from '../db/memory.js';
import { approveWebLogin, createWebLogin, getPendingWebLogin, pollWebLogin } from './weblogin.js';

setStore(new MemoryStore(null));

test("saytdan kirish: so'rov, tasdiq, bir martalik token", async () => {
  const w = await createWebLogin();
  assert.ok(await getPendingWebLogin(w.id));
  assert.deepEqual(await pollWebLogin(w.id, w.secret), { status: 'pending' });

  // Noto'g'ri secret — so'rov topilmaydi (boshqa qurilma tokenni ololmaydi)
  await assert.rejects(() => pollWebLogin(w.id, 'x'.repeat(32)), /topilmadi/);

  assert.equal(await approveWebLogin(w.id, { id: 'emp1', telegramId: 42 }), true);
  assert.equal(await approveWebLogin(w.id, { id: 'emp2', telegramId: 43 }), false); // ikkinchi marta tasdiqlanmaydi
  assert.equal(await getPendingWebLogin(w.id), null);

  assert.deepEqual(await pollWebLogin(w.id, w.secret), { status: 'approved', employeeId: 'emp1' });
  assert.deepEqual(await pollWebLogin(w.id, w.secret), { status: 'expired' }); // bir martalik

  // Muddati o'tgan so'rov tasdiqlanmaydi
  const old = await createWebLogin();
  await db().update(COL.webLogins, old.id, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal(await approveWebLogin(old.id, { id: 'emp1', telegramId: 42 }), false);
  assert.deepEqual(await pollWebLogin(old.id, old.secret), { status: 'expired' });
});
