# Vercel'ga joylash

Vercel serverless platforma: doimiy jarayon yo'q. Shuning uchun Lidex u yerda shunday ishlaydi:

| Qism | Doimiy serverda | Vercel'da |
|---|---|---|
| Telegram bot | polling yoki webhook | **webhook** (birinchi so'rovda avtomatik o'rnatiladi) |
| Real vaqt | Socket.IO | har 15 soniyada avtomatik yangilanish |
| Eslatma / SLA / dayjest | har daqiqada ichki taymer | **`/api/cron/tick`** — tashqi cron chaqiradi |

## 1. Loyihani ulash
1. [vercel.com/new](https://vercel.com/new) → GitHub'dagi `lidex` reponi tanlang → **Import**.
2. Framework: **Other**. Build va Output sozlamalari `vercel.json` dan olinadi — o'zgartirmang.
3. **Environment Variables** → `.env.vercel` faylidagi barcha qatorlarni nusxalab, birinchi maydonga **paste** qiling (Vercel ularni avtomatik ajratadi).
4. **Deploy**.

`PUBLIC_URL` ni yozish shart emas — Vercel production domeni avtomatik olinadi. O'z domeningizni ulasangiz, `PUBLIC_URL=https://domen.uz` qo'shing va qayta deploy qiling.

## 2. Har daqiqalik cron (eslatmalar uchun shart)
Vercel Hobby rejasida cron kuniga 1 marta ishlaydi. Har daqiqa uchun bepul [cron-job.org](https://cron-job.org):
- URL: `https://<sizning-domen>/api/cron/tick?key=<CRON_SECRET>` (`CRON_SECRET` — `.env.vercel` da)
- Jadval: **har 1 daqiqada**

## 3. Tekshirish
- `https://<domen>/api/health` → `{"ok":true,"db":"firestore","bot":true,...}`
- Botga `/start` yozing — javob berishi kerak.
- `https://<domen>/admin` → login.

> ⚠️ Shu bot tokeni bilan lokalda `BOT_MODE=polling` serverni ishga tushirmang — u Vercel webhookini o'chiradi. Lokal sinov uchun alohida test bot yarating.
