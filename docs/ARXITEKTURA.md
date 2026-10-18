# Arxitektura

```
 Telegram guruh / kanal ──► Bot (grammY) ─┐
 Guruhdagi boshqa botlar ──► Userbot (GramJS)┼──► ingestLead() ──► Firestore
 Sayt / Tilda / CRM ──► POST /api/ingest/:token ┘        │ parse → dedupe → taqsimlash
                                                          ├──► Bot push xodimga (tezkor tugmalar)
                                                          └──► Socket.IO → Mini App + Admin panel
 Scheduler (har daqiqa): eslatmalar · SLA ogohlantirish · eskalatsiya · ertalabki dayjest
```

## Papkalar

```
shared/statuses.ts       statuslar, ranglar, sozlamalar — server va web uchun yagona manba
server/src/
  config.ts              .env tekshiruvi (zod)
  db/store.ts            ombor interfeysi (Firestore semantikasi)
  db/firestore.ts        Firestore implementatsiyasi (firebase-admin)
  db/memory.ts           lokal JSON implementatsiya (dev/test)
  db/models.ts           hujjat turlari
  lib/parser.ts          xabardan ism/telefon/maydonlarni ajratish, qidiruv tokenlari
  lib/security.ts        kalitlar, JWT, Telegram initData HMAC tekshiruvi
  services/leads.ts      lid qabul qilish, taqsimlash, status, qayta biriktirish
  services/notify.ts     bot orqali bildirishnomalar
  services/stats.ts      dashboard agregatsiyalari (count/avg so'rovlari)
  bot/                   grammY: guruhlar, kalit bilan kirish, tezkor status tugmalari
  userbot/               GramJS: boshqa botlar yozgan xabarlarni o'qish
  scheduler/             eslatma, SLA, dayjest
  http/routes/app.ts     Mini App API (/api/app)
  http/routes/admin*.ts  Admin API (/api/admin)
  http/routes/ingest.ts  Tashqi manbalar (/api/ingest/:token)
web/
  app.html  → src/miniapp   Telegram Mini App
  admin.html → src/admin    Admin panel
```

## Xavfsizlik

- Xodim kaliti serverda faqat HMAC-hash ko'rinishida saqlanadi; admin uni faqat yaratilganda ko'radi. Kalitni taxmin qilishga limit (10 daqiqada 6 urinish).
- Mini App so'rovlari Telegram `initData` HMAC imzosi bilan tasdiqlanadi (24 soat), so'ng 7 kunlik JWT.
- Admin: bcrypt parol, httpOnly cookie (12 soat), login limit (15 daqiqada 10), rollar: superadmin / guruhga cheklangan admin.
- Xodim faqat o'ziga biriktirilgan lidni ko'radi va o'zgartiradi (server tomonda tekshiriladi).
- Firestore qoidalari mijozlar uchun yopiq; faqat server kiradi.

## Real vaqt

Socket.IO xonalari: `emp:<id>` (xodim), `adm:all` (superadminlar), `adm:g:<groupId>` (guruh adminlari). Hodisalar: `lead:new`, `lead:updated`, `lead:removed`, `message:new`, `message:updated`, `activity`, `alert`, `employee:updated`, `group:updated`.

## Kengaytirish g'oyalari (MVP'dan keyin)

- Redis adapter bilan Socket.IO va scheduler'ni bir nechta serverga kengaytirish (hozir bitta instans)
- To'liq matnli qidiruv (Algolia / Typesense) — hozir ism prefikslari, telefon bo'laklari va lid raqami bo'yicha
- IP-telefoniya integratsiyasi (qo'ng'iroq yozuvlari), SMS
- Lid manbalari bo'yicha UTM/kampaniya analitikasi
