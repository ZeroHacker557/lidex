import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchTokens, parseLeadText, searchTokenFor } from './parser.js';
import { extractPhones, normalizePhone } from './phone.js';

test('telefon raqamlarni normallashtirish', () => {
  assert.equal(normalizePhone('+998 90 123 45 67'), '+998901234567');
  assert.equal(normalizePhone('90 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('(99) 888 77 66'), '+998998887766');
  assert.equal(normalizePhone('998901234567'), '+998901234567');
  assert.equal(normalizePhone('12345'), null);
});

test('matndan telefonlarni topish (sana va qatorlarni aralashtirmasdan)', () => {
  const phones = extractPhones('Sana: 18.10.2026\nTel: +998 90 123 45 67\n2-raqam: 93 555 44 33\n100');
  assert.deepEqual(phones, ['+998901234567', '+998935554433']);
});

test('odatiy lid formatini ajratish', () => {
  const p = parseLeadText(
    '🆕 Yangi ariza\n👤 Ism: Aziz Karimov\n📞 Telefon: +998 90 123 45 67\n📍 Manzil: Toshkent, Chilonzor\n💬 Izoh: kurs haqida\nhttps://site.uz',
  );
  assert.equal(p.name, 'Aziz Karimov');
  assert.equal(p.phone, '+998901234567');
  assert.deepEqual(
    p.fields.map((f) => f.key),
    ['Manzil', 'Izoh'],
  );
});

test('rus tilidagi va kalitsiz formatlar', () => {
  const ru = parseLeadText('Новая заявка\nИмя: Олег\nНомер: 8 (90) 111-22-33\nTelegram: @oleg_uz');
  assert.equal(ru.name, 'Олег');
  assert.equal(ru.phone, '+998901112233');
  assert.equal(ru.telegramUsername, 'oleg_uz');

  const bare = parseLeadText('Dilnoza Rahimova\n+998977778899');
  assert.equal(bare.name, 'Dilnoza Rahimova');
  assert.equal(bare.phone, '+998977778899');
});

test('forma botining raqamlangan formati (#telegram ... Telegram uchun tayyor)', () => {
  const sample = (region: string, name: string, phone: string) =>
    `#telegram

🧾 Nomi: Lid viloyatlar (Mirzobek Bozorov)
📝 Ma'lumotlar:
    1. Qaysi viloyatdansiz?: ${region}
    2. Full name: ${name}
    3. Phone number: ${phone}
ℹ️ Manba: Instagram
📆 Sana: 18-10-2026 18:25:57

✅ Telegram uchun tayyor`;

  const a = parseLeadText(sample('Xorazm urganch', 'شاه', '+998971060820'));
  assert.equal(a.name, 'شاه');
  assert.equal(a.phone, '+998971060820');
  assert.deepEqual(a.phones, ['+998971060820']);
  assert.deepEqual(
    a.fields.map((f) => `${f.key}=${f.value}`),
    ['Forma=Lid viloyatlar (Mirzobek Bozorov)', 'Viloyat=Xorazm urganch', 'Manba=Instagram', 'Sana=18-10-2026 18:25:57'],
  );

  const b = parseLeadText(sample('Кашкадарё', 'Акмал Халиков', '914646111'));
  assert.equal(b.name, 'Акмал Халиков');
  assert.equal(b.phone, '+998914646111');
  assert.equal(b.fields.find((f) => f.key === 'Viloyat')?.value, 'Кашкадарё');

  const fancy = '❮꯭✯꯭➣꯭𝐀𖠷꯭𝐋𖠷꯭𝐢𖠷꯭✵꯭𝐌꯭𖠷𝐀꯭𖠷꯭𝐅𖠷꯭꯭𝐈꯭꯭𖠷꯭𝐀꯭➢꯭❲꯭꯭❳꯭';
  const c = parseLeadText(sample('Namangan', fancy, '+998956686040'));
  assert.equal(c.phone, '+998956686040');
  assert.ok(c.name && c.name.length > 0);
});

test('qidiruv tokenlari', () => {
  const tokens = buildSearchTokens({ seq: 1024, name: 'Aziz Karimov', phones: ['+998901234567'], telegramUsername: null });
  for (const t of ['1024', 'az', 'aziz', 'kar', '998901234567', '901234567', '1234567', '4567']) assert.ok(tokens.includes(t), t);
  assert.equal(searchTokenFor('+998 90 123 45 67'), '998901234567');
  assert.equal(searchTokenFor('90 123 45 67'), '901234567');
  assert.equal(searchTokenFor('#1024'), '1024');
  assert.equal(searchTokenFor('Karimov'), 'karimov');
});
