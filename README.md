# Lidex — Telegram lidlar boshqaruvi

Telegram guruhlarga tushadigan lidlarni avtomatik yig'ib, xodimlarga taqsimlaydigan va rahbarlarga to'liq nazorat beradigan tizim.

- **Bot** — guruhdagi lidlarni o'qiydi, xodimga push-bildirishnoma yuboradi, eslatadi, ogohlantiradi.
- **Telegram Mini App** — xodim (operator) paneli: lidlar, rangli statuslar, eslatmalar, xabarlar, statistika, qo'llanma.
- **Admin panel** — katta xodimlar uchun (login/parol): dashboard, har bir lid tarixi, xodimlar faolligi, ogohlantirish yuborish.

## Imkoniyatlar

**Lidlarni yig'ish**
- Bot qo'shilgan har bir Telegram guruh/kanaldan lidlarni o'qish; guruh admin tasdiqlagandan keyin faollashadi
- Matndan ism, telefon (+998 formatlar), Telegram username va boshqa maydonlarni (Manzil, Kurs…) avtomatik ajratish
- Telefonsiz oddiy suhbat xabarlari e'tiborsiz qoldiriladi
- **Userbot** rejimi — lidlar guruhga BOSHQA BOT orqali tushsa ham o'qiladi (Telegram botlari bir-birini ko'rmaydi)
- **HTTP API** — sayt formasi, Tilda va boshqa tizimlardan to'g'ridan-to'g'ri lid qabul qilish
- Takroriy raqamni aniqlash va avvalgi xodimga biriktirish

**Taqsimlash** — navbatma-navbat (round-robin), eng kam yuklangan xodimga yoki qo'lda. Faqat botga ulangan, faol va "lid qabul qilyapman" holatidagi xodimlarga.

**Statuslar (har birining rangi)**

| Status | Rang | Eslatma |
|---|---|---|
| 🔵 Yangi | ko'k | SLA: belgilangan daqiqada javob berilmasa — xodimga, 3× kechiksa — adminlarga ogohlantirish |
| ⚪️ Ko'tarmadi | kulrang | N soatdan keyin qayta qo'ng'iroq eslatmasi |
| 🟡 Keyinga qoldirildi | sariq | Sana tanlansa — aynan o'sha kuni/vaqtda; sanasiz — har 2 kunda |
| 🟢 Javob berildi — HA dedi | yashil | Muvaffaqiyatli |
| 🟠 Javob berildi — YO'Q dedi | to'q sariq | Rad etdi |
| 🔴 Bekor qilindi | qizil | — |

Yakuniy statuslar "Statusni tahrirlash" orqali o'zgartiriladi; har bir o'zgarish tarixda saqlanadi.

**Xodim kirishi** — admin xodim yaratadi → tizim `LX-XXXX-XXXX` kalit va bir bosishda kirish havolasini beradi → kalit bitta Telegram akkauntga bog'lanadi. Xodim faqat o'z guruh(lar)idagi, o'ziga biriktirilgan lidlarni ko'radi.

**Yangi xodim uchun** — 6 bosqichli interaktiv qo'llanma (onboarding), "Boshlang'ich yo'l xaritasi" (roadmap) va doimiy "Qo'llanma" sahifasi.

**Admin panel** — dashboard (KPI, kunlik grafik, status taqsimoti, xodimlar samaradorligi, javob vaqti), lidlar jadvali (filtr, qidiruv, CSV eksport), lid kartasi (to'liq tarix, qayta biriktirish, status, 🚩 belgilash, xodimga lid bilan bog'langan xabar/ogohlantirish), xodimlar (kalit, faollik, ochiq lidlarni boshqalarga taqsimlash), guruhlar (sozlamalar, lid sinovi, API manzili), xabarlar (yetkazildi/o'qildi/tasdiqlandi), faollik jurnali, adminlar va rollar (superadmin / guruhga cheklangan admin), real vaqt (Socket.IO), qorong'i rejim.

**Avtomatik** — ertalabki dayjest (xodimga bugungi reja, adminlarga kechagi hisobot), tungi soatlarda (21:00–08:00) eslatmalar ertalabga suriladi.

## Texnologiyalar

Node.js 20+ · TypeScript · Express 5 · grammY (Telegram Bot API) · GramJS (userbot) · Socket.IO · **Firebase Firestore** · React 18 · Vite · Tailwind CSS · TanStack Query

## Tez boshlash (lokal)

```bash
npm install
cp .env.example .env          # DEV_AUTH=true qiling — Mini App'ni brauzerda sinash uchun
npm run seed:demo             # demo guruh, xodimlar va 30 ta lid
npm run dev                   # server :4000 + web :5173
```

- Admin panel: http://localhost:5173/admin — `admin` / `admin12345` (`.env` dagi)
- Mini App (Telegramsiz sinov): http://localhost:5173/app?dev_tg=111

Lokalda ma'lumotlar `server/data/dev-db.json` faylida saqlanadi (`DB_DRIVER=memory`).

## Telegram botni ulash

1. [@BotFather](https://t.me/BotFather) → `/newbot` → tokenni `.env` dagi `BOT_TOKEN` ga yozing.
2. `/setprivacy` → botni tanlang → **Disable** (bot guruhdagi barcha xabarlarni ko'rishi uchun). Yoki botni guruhda admin qiling.
3. Mini App HTTPS talab qiladi: `PUBLIC_URL` ga HTTPS domeningizni yozing (lokalda: `cloudflared tunnel --url http://localhost:4000` yoki ngrok).
4. Botni guruhga qo'shing → Admin panel → Guruhlar → guruhni oching → xodimlarni belgilang → **Faollashtirish**.
5. Guruhda `/chatid` — chat ID va guruh holatini ko'rsatadi.

> **Muhim:** Telegram qoidasiga ko'ra bot guruhdagi boshqa botlarning xabarlarini ko'rmaydi. Lidlar guruhga bot orqali tushsa: (a) userbot rejimini yoqing — `npm run userbot:login`, keyin guruh sozlamasida "Userbot"; (b) manbani API manziliga ulang; yoki (c) kanal ishlating.

## Production

```bash
npm run build && npm start          # bitta port: /admin, /app, /api
# yoki
docker compose up -d --build
```

HTTPS uchun oldiga Caddy/Nginx qo'ying. Bot `BOT_MODE=polling` (oddiy) yoki `webhook` (`WEBHOOK_SECRET` bilan) rejimida ishlaydi. Server doimiy jarayon bo'lishi kerak (bot, scheduler va real vaqt uchun) — VPS, Railway, Render, Cloud Run (min-instances=1) mos; Cloud Functions mos emas.

Firestore ulash: **[docs/FIRESTORE.md](docs/FIRESTORE.md)**. Arxitektura: **[docs/ARXITEKTURA.md](docs/ARXITEKTURA.md)**.

## Skriptlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Server + frontend (hot reload) |
| `npm run build` / `npm start` | Production build va ishga tushirish |
| `npm test` | Parser, ombor va lid oqimi testlari |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run seed:demo` | Demo ma'lumotlar |
| `npm run userbot:login` | Userbot sessiyasini yaratish |
| `npm run firestore:indexes` | Firestore indekslarini deploy qilish |

## Tashqi manbadan lid yuborish (API)

```bash
curl -X POST https://sizning-domen.uz/api/ingest/<GURUH_TOKENI> \
  -H "Content-Type: application/json" \
  -d '{"name":"Aziz","phone":"+998901234567","text":"Izoh","fields":{"Manzil":"Toshkent"}}'
```

Token admin paneldagi guruh sahifasida. `application/x-www-form-urlencoded` ham qabul qilinadi.
