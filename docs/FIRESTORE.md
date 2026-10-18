# Firestore'ni ulash

Hozir loyiha lokal JSON ombor (`DB_DRIVER=memory`) bilan ishlaydi. Kod Firestore uchun tayyor: `server/src/db/firestore.ts`. Ulash uchun quyidagilar kerak.

## Sizdan kerak bo'ladigan narsalar

| # | Nima | Qayerdan |
|---|------|----------|
| 1 | **Firebase loyiha** (Project ID) | [console.firebase.google.com](https://console.firebase.google.com) → Add project |
| 2 | **Firestore Database** (Native mode) | Build → Firestore Database → Create database. Region: `europe-west` (O'zbekistonga yaqin) — keyin o'zgartirib bo'lmaydi |
| 3 | **Service account kaliti (JSON)** | Project settings → Service accounts → *Generate new private key* |
| 4 | **Blaze tarif** (ixtiyoriy, lekin tavsiya) | Bepul Spark limiti: kuniga 50 000 o'qish / 20 000 yozish. Kichik jamoaga yetadi; dashboard ko'p ochilsa — Blaze |
| 5 | **Firebase CLI** (indekslar uchun) | `npm i -g firebase-tools` → `firebase login` |

## Qadamlar

1. Service account JSON faylini loyiha ildiziga `firebase-service-account.json` nomi bilan qo'ying (u `.gitignore` da — gitga tushmaydi).
2. `.env` ni o'zgartiring:
   ```env
   DB_DRIVER=firestore
   FIREBASE_PROJECT_ID=sizning-project-id
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```
   Hosting panelida fayl qo'yib bo'lmasa — JSON matnini base64 qilib `FIREBASE_SERVICE_ACCOUNT=` ga yozing:
   `node -e "console.log(Buffer.from(require('fs').readFileSync('firebase-service-account.json')).toString('base64'))"`
3. **Indekslarni deploy qiling** (bir marta va har safar `firestore.indexes.json` o'zgarganda):
   ```bash
   firebase use --add        # loyihani tanlang
   firebase deploy --only firestore:indexes,firestore:rules
   ```
   Indekslar 2–10 daqiqada quriladi. Indeks yetishmasa server logida `Firestore indeksi kerak` va Firebase havolasi chiqadi — havolani ochib "Create" bosish kifoya.
4. Serverni qayta ishga tushiring. Birinchi ishga tushishda `ADMIN_USERNAME` / `ADMIN_PASSWORD` dan superadmin yaratiladi.

## Xavfsizlik

- `firestore.rules` mijozlar uchun hamma narsani yopadi — ma'lumotlarga faqat server (Admin SDK) kiradi. Brauzer Firestore'ga to'g'ridan-to'g'ri ulanmaydi.
- Service account kaliti — to'liq kirish huquqi. Faqat serverda saqlang.

## Kolleksiyalar

| Kolleksiya | Mazmuni |
|---|---|
| `admins` | Katta xodimlar (login, bcrypt parol, rol, guruhlar) |
| `groups` | Telegram guruhlar / API manbalar va ularning sozlamalari |
| `employees` | Operatorlar (kalit hash, Telegram ID, guruhlar, onboarding) |
| `leads` | Lidlar (status, eslatma vaqti, SLA belgilari, qidiruv tokenlari) |
| `events` | Har bir harakat jurnali (kim, qachon, nimani o'zgartirdi) |
| `messages` | Admin → xodim xabarlari (yetkazildi / o'qildi / tasdiqlandi) |
| `counters` | Lid raqamlari (#1001…) va tizim belgilari |

Bir Firebase loyihada staging va production'ni ajratish uchun `FIRESTORE_PREFIX=staging_` ishlating.

## Mavjud ma'lumotni ko'chirish

Lokal sinov ma'lumotlari (`server/data/dev-db.json`) avtomatik ko'chirilmaydi — production toza bazadan boshlanadi. Kerak bo'lsa ko'chirish skriptini alohida yozish mumkin.
