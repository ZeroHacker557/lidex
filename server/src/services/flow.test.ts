import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COL, db, setStore, type Employee, type Group, type Lead, type LeadEvent, type WithId } from '../db/index.js';
import { MemoryStore } from '../db/memory.js';
import { addDays, addMinutes } from '../lib/time.js';
import { processReminders, processSla } from '../scheduler/index.js';
import { invalidateGroups, newGroup } from './groups.js';
import { changeStatus, ingestLead, reassignLead } from './leads.js';

setStore(new MemoryStore(null));

function employee(name: string, groupIds: string[], tg: number | null, createdAt: Date): Employee {
  return {
    fullName: name, phone: null, keyHash: name, keyHint: 'XXXX', telegramId: tg, telegramUsername: null, telegramName: null,
    groupIds, isActive: true, acceptingLeads: true, onboardingDone: true, botBlocked: false, boundAt: tg ? createdAt : null,
    lastSeenAt: null, lastDigestDate: null, progress: {}, createdAt, createdBy: null,
  };
}

test("lid oqimi: taqsimlash, takror, status, eslatma, SLA", async () => {
  const gid = await db().create(COL.groups, newGroup({ title: 'Sotuv', chatId: -1001, chatType: 'supergroup', status: 'active' }));
  invalidateGroups();
  const t = new Date('2026-01-01');
  const a = await db().create(COL.employees, employee('Ali', [gid], 1, t));
  const b = await db().create(COL.employees, employee('Bek', [gid], 2, new Date(t.getTime() + 1000)));
  await db().create(COL.employees, employee('Unbound', [gid], null, new Date(t.getTime() + 2000)));
  const group = (await db().get<Group>(COL.groups, gid))!;

  // Round-robin: Ali -> Bek -> Ali (bog'lanmagan xodim o'tkazib yuboriladi)
  const r1 = await ingestLead({ group, source: 'telegram', text: 'Ism: Aziz\nTel: 901111111', chatId: -1001, messageId: 1 });
  const r2 = await ingestLead({ group, source: 'telegram', text: 'Ism: Vali\nTel: 902222222', chatId: -1001, messageId: 2 });
  const r3 = await ingestLead({ group, source: 'telegram', text: 'Ism: Sami\nTel: 903333333', chatId: -1001, messageId: 3 });
  assert.deepEqual([r1!.lead.assignedEmployeeId, r2!.lead.assignedEmployeeId, r3!.lead.assignedEmployeeId], [a, b, a]);
  assert.deepEqual([r1!.lead.seq, r2!.lead.seq, r3!.lead.seq], [1001, 1002, 1003]);

  // Bir xil xabar qayta kelsa — yangi lid yaratilmaydi
  const again = await ingestLead({ group, source: 'telegram', text: 'Ism: Aziz\nTel: 901111111', chatId: -1001, messageId: 1 });
  assert.equal(again!.created, false);

  // Telefonsiz xabar lid emas
  assert.equal(await ingestLead({ group, source: 'telegram', text: 'Salom hammaga', chatId: -1001, messageId: 9 }), null);

  // Takroriy raqam — avvalgi xodimga (sticky)
  const dup = await ingestLead({ group, source: 'telegram', text: 'Ism: Vali\nTel: +998 90 222 22 22', chatId: -1001, messageId: 4 });
  assert.equal(dup!.lead.isDuplicate, true);
  assert.equal(dup!.lead.assignedEmployeeId, b);

  // Status: boshqa xodimning lidiga tegib bo'lmaydi
  await assert.rejects(() => changeStatus(r1!.lead.id, { type: 'employee', id: b, name: 'Bek' }, { status: 'success' }));

  const ali = { type: 'employee' as const, id: a, name: 'Ali' };
  const success = await changeStatus(r1!.lead.id, ali, { status: 'success', note: 'Shartnoma' });
  assert.equal(success.status, 'success');
  assert.ok(success.responseSeconds !== null);
  assert.equal(success.nextReminderAt, null);

  // Yakuniy statusni tahrirlash
  const edited = await changeStatus(r1!.lead.id, ali, { status: 'cancelled' });
  assert.equal(edited.status, 'cancelled');

  // Keyinga qoldirish: sanasiz -> 2 kundan keyin eslatma
  const postponed = await changeStatus(r3!.lead.id, ali, { status: 'postponed' });
  const diffDays = (postponed.nextReminderAt!.getTime() - Date.now()) / 86_400_000;
  assert.ok(diffDays > 1.5 && diffDays < 3.1, `diff=${diffDays}`);

  // Sana bilan — aynan o'sha vaqt
  const when = addDays(new Date(), 5);
  const dated = await changeStatus(r3!.lead.id, ali, { status: 'postponed', postponedUntil: when });
  assert.equal(dated.nextReminderAt!.getTime(), when.getTime());

  // Eslatma vaqti kelganda scheduler yuboradi va keyingisini rejalashtiradi
  await processReminders(addDays(when, 0.001));
  const afterReminder = (await db().get<Lead>(COL.leads, r3!.lead.id))!;
  assert.equal(afterReminder.reminderCount, 1);
  assert.ok(afterReminder.nextReminderAt!.getTime() > when.getTime());

  // SLA: javobsiz yangi lid uchun ogohlantirish (jim soatlardan tashqari vaqt)
  const noon = new Date('2026-10-20T07:00:00Z'); // Toshkent 12:00
  await db().update(COL.leads, r2!.lead.id, { createdAt: addMinutes(noon, -20) });
  await processSla(noon);
  const late = (await db().get<Lead>(COL.leads, r2!.lead.id))!;
  assert.ok(late.slaNotifiedAt, 'SLA ogohlantirishi belgilanishi kerak');
  assert.equal(late.escalatedAt, null);
  await processSla(addMinutes(noon, 30));
  assert.ok((await db().get<Lead>(COL.leads, r2!.lead.id))!.escalatedAt, 'eskalatsiya bo\'lishi kerak');

  // Qayta biriktirish
  const moved = await reassignLead(r2!.lead.id, a, { type: 'admin', id: 'adm', name: 'Admin' });
  assert.equal(moved.assignedEmployeeId, a);

  // Jurnal to'liq yozilgan
  const events = await db().query<LeadEvent>(COL.events, { where: [['leadId', '==', r1!.lead.id]], orderBy: [['createdAt', 'asc']] });
  assert.deepEqual(events.map((e) => e.type), ['created', 'assigned', 'status_changed', 'status_changed']);
  assert.equal(events[3]!.meta?.edit, true);

  const emp = (await db().get<Employee>(COL.employees, a)) as WithId<Employee>;
  assert.equal(emp.fullName, 'Ali');
});
