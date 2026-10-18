// Demo ma'lumotlar: `npm run seed:demo`
// Guruh, 3 ta xodim va o'tgan 7 kunlik ~30 ta lid yaratadi (turli statuslar bilan).
// Lokal sinov uchun: DEV_AUTH=true bo'lsa Mini App'ni brauzerda ?dev_tg=111 / ?dev_tg=222 bilan ochish mumkin.

import { STATUS_META, type LeadStatus } from '../../../shared/statuses.js';
import { config } from '../config.js';
import { COL, db, initStore, type Employee, type Group } from '../db/index.js';
import { addDays, addHours, addMinutes } from '../lib/time.js';
import { newKeyFields } from '../services/employees.js';
import { invalidateGroups, newGroup } from '../services/groups.js';
import { changeStatus, ingestLead } from '../services/leads.js';

const NAMES = [
  'Aziz Karimov', 'Dilnoza Rahimova', 'Jasur Toshmatov', 'Madina Yusupova', 'Sardor Aliyev', 'Nilufar Qodirova', 'Bekzod Ergashev',
  'Gulnora Saidova', 'Otabek Nurmatov', 'Shahnoza Ismoilova', 'Rustam Xolmatov', 'Malika Abdullayeva', 'Javohir Sobirov', 'Zarina Hamidova',
  'Ulug\'bek Rasulov', 'Kamola Mirzayeva', 'Farrux Jo\'rayev', 'Sevara Olimova', 'Doniyor Qosimov', 'Feruza Tursunova',
];
const CITIES = ['Toshkent', 'Samarqand', 'Buxoro', 'Andijon', 'Farg\'ona', 'Namangan', 'Qarshi'];
const PRODUCTS = ['Ingliz tili kursi', 'IT kursi (Frontend)', 'Matematika', 'IELTS tayyorlov', 'Rus tili'];

async function main() {
  await initStore();
  const now = new Date();

  const groupId = await db().create(
    COL.groups,
    newGroup({ title: "Sotuv bo'limi (demo)", chatId: -1009990001, chatType: 'supergroup', status: 'active', botMember: true }),
  );
  invalidateGroups();

  const staff = [
    { name: 'Ali Valiyev', tg: 111 },
    { name: 'Zuhra Karimova', tg: 222 },
    { name: 'Yangi Xodim', tg: null },
  ];
  const keys: string[] = [];
  const empIds: string[] = [];
  for (const [i, s] of staff.entries()) {
    const { key, keyHash, keyHint } = newKeyFields();
    keys.push(key);
    const emp: Employee = {
      fullName: s.name, phone: null, keyHash, keyHint, telegramId: s.tg, telegramUsername: s.tg ? `demo${s.tg}` : null,
      telegramName: s.tg ? s.name : null, groupIds: [groupId], isActive: true, acceptingLeads: true, onboardingDone: i === 0,
      botBlocked: false, boundAt: s.tg ? now : null, lastSeenAt: null, lastDigestDate: null, progress: {},
      createdAt: addMinutes(now, i), createdBy: null,
    };
    empIds.push(await db().create(COL.employees, emp));
  }
  const group = (await db().get<Group>(COL.groups, groupId))!;

  const plan: LeadStatus[] = [
    'success', 'success', 'rejected', 'postponed', 'no_answer', 'cancelled', 'success', 'new', 'postponed', 'success',
    'rejected', 'success', 'no_answer', 'new', 'success', 'postponed', 'cancelled', 'success', 'rejected', 'new',
    'success', 'postponed', 'success', 'no_answer', 'success', 'new', 'rejected', 'success', 'new', 'postponed',
  ];
  for (const [i, status] of plan.entries()) {
    const name = NAMES[i % NAMES.length]!;
    const phone = `+9989${(10_000_000 + ((i * 7_919_113) % 89_999_999)).toString().padStart(8, '0')}`;
    const text = `🆕 Yangi ariza\n👤 Ism: ${name}\n📞 Telefon: ${phone}\n📍 Shahar: ${CITIES[i % CITIES.length]}\n📚 Kurs: ${PRODUCTS[i % PRODUCTS.length]}`;
    const res = await ingestLead({ group, source: 'telegram', text, chatId: group.chatId, messageId: 5000 + i });
    if (!res) continue;
    const created = addHours(addDays(now, -Math.floor((plan.length - 1 - i) / 4.5)), -((i * 37) % 9));
    await db().update(COL.leads, res.lead.id, { createdAt: created, assignedAt: created });
    if (status === 'new' || !res.lead.assignedEmployeeId) continue;
    const emp = (await db().get<Employee>(COL.employees, res.lead.assignedEmployeeId))!;
    await changeStatus(
      res.lead.id,
      { type: 'employee', id: emp.id, name: emp.fullName },
      {
        status,
        postponedUntil: status === 'postponed' && i % 2 ? addDays(now, (i % 5) + 1) : null,
        note: status === 'success' ? 'Shartnoma tuzildi' : status === 'rejected' ? 'Narx qimmatlik qildi' : null,
      },
    );
    await db().update(COL.leads, res.lead.id, { responseSeconds: 120 + ((i * 431) % 2400) });
  }
  const total = await db().count(COL.leads, {});
  await db().close();

  console.log(`\n✅ Demo ma'lumotlar yaratildi: 1 guruh, ${staff.length} xodim, ${total} lid\n`);
  staff.forEach((s, i) => console.log(`  ${s.name.padEnd(16)} kalit: ${keys[i]}  ${s.tg ? `(dev: /app?dev_tg=${s.tg})` : '(ulanmagan)'}`));
  console.log(`\nAdmin panel: ${config.PUBLIC_URL}/admin`);
  console.log(`Statuslar: ${Object.values(STATUS_META).map((m) => m.emoji + ' ' + m.short).join('  ')}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
