import { STATUS_META, LEAD_STATUSES } from '@shared/statuses';
import { Card, PageHeader } from '../components/common';
import { useAdmin } from '../context';

export function GuidePage() {
  const { botUsername } = useAdmin();
  const bot = botUsername ? `@${botUsername}` : 'bot';
  const steps = [
    {
      t: 'Botni guruhga qo\'shing',
      d: `${bot} ni lidlar tushadigan Telegram guruhga qo'shing va admin qiling. Guruh "Guruhlar" bo'limida "Tasdiqlash kutilmoqda" bo'lib chiqadi.`,
    },
    { t: 'Xodimlarni yarating', d: '"Xodimlar" → "Xodim qo\'shish". Ism va guruhni tanlang — tizim LX-XXXX-XXXX ko\'rinishidagi kirish kalitini va bir bosishda kirish havolasini beradi.' },
    { t: 'Kalitni xodimga bering', d: 'Tayyor matnni nusxalab xodimga yuboring. Xodim havolani ochib Start bossa yoki kalitni botga yuborsa — panelga ulanadi. Kalit bitta Telegram akkauntga bog\'lanadi.' },
    { t: 'Guruhni sozlang va faollashtiring', d: 'Guruhni oching: xodimlarni belgilang, taqsimlash usulini (navbatma-navbat / eng kam yuklangan / qo\'lda), javob muddati (SLA) va eslatma intervallarini tanlang, "Faollashtirish" ni bosing.' },
    { t: 'Sinab ko\'ring', d: 'Guruh sahifasidagi "Lidni sinash" orqali namuna xabar yuboring — tizim ism/telefonni qanday ajratishi va kimga biriktirishini ko\'rasiz.' },
    { t: 'Nazorat qiling', d: 'Dashboard, Lidlar va Faollik jurnalida har bir lid, status, vaqt va xodim harakatini real vaqtda kuzating. "Diqqat talab" paneli kechikayotgan lidlarni ko\'rsatadi.' },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Qo'llanma" subtitle="Tizimni ishga tushirish va kundalik nazorat" />
      <div className="space-y-5">
        <Card title="🚀 Boshlash: 6 qadam">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-brand-fg">{i + 1}</span>
                <div>
                  <p className="font-semibold">{s.t}</p>
                  <p className="mt-0.5 text-[14px] text-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="🎨 Statuslar">
          <div className="grid gap-2 sm:grid-cols-2">
            {LEAD_STATUSES.map((s) => (
              <div key={s} className="flex gap-3 rounded-xl p-3" style={{ backgroundColor: `${STATUS_META[s].color}12` }}>
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                <div>
                  <p className="text-[14px] font-semibold">{STATUS_META[s].label}</p>
                  <p className="text-[13px] text-muted">{STATUS_META[s].description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🔔 Avtomatik eslatmalar va ogohlantirishlar">
          <ul className="list-disc space-y-2 pl-5 text-[14px]">
            <li><b>Yangi lid</b> — xodimga darhol bot orqali push-xabar (tezkor status tugmalari bilan).</li>
            <li><b>SLA</b> — yangi lidga belgilangan daqiqada javob berilmasa xodim ogohlantiriladi; 3 barobar kechiksa — adminlarga (panel + Telegram).</li>
            <li><b>Keyinga qoldirildi (sana bilan)</b> — o'sha kuni/vaqtda eslatma; ishlanmasa har kuni takrorlanadi.</li>
            <li><b>Keyinga qoldirildi (sanasiz)</b> — har N kunda (standart 2) eslatma.</li>
            <li><b>Ko'tarmadi</b> — N soatdan keyin qayta qo'ng'iroq eslatmasi.</li>
            <li><b>Ertalabki dayjest</b> — har kuni ertalab xodimga bugungi reja, Telegram ulagan adminlarga kechagi hisobot.</li>
            <li>Tungi soatlarda (21:00–08:00) avtomatik eslatmalar ertalabga suriladi.</li>
          </ul>
        </Card>

        <Card title="✉️ Xodimni ogohlantirish">
          <p className="text-[14px] text-muted">
            Lid kartasida "Xodimga xabar" yoki xodim sahifasida "Xabar / ogohlantirish" tugmasini bosing. Xabar lidga biriktiriladi, xodimga Telegram
            orqali yetkaziladi va uning panelidagi "Xabarlar" bo'limida saqlanadi. Siz xabar yetkazilgani, o'qilgani va "Tushundim" bosilganini ko'rasiz.
            Lidni 🚩 <b>belgilash</b> ham mumkin — xodim uni qizil ogohlantirish bilan ko'radi.
          </p>
        </Card>

        <Card title="⚠️ Muhim: boshqa botlar yozgan lidlar">
          <p className="text-[14px] text-muted">
            Telegram qoidasiga ko'ra bot guruhdagi <b>boshqa botlarning</b> xabarlarini ko'rmaydi. Agar lidlar guruhga sayt yoki boshqa bot orqali tushsa:
            (1) guruh sozlamasida <b>Userbot</b> rejimini yoqing (server .env da userbot sozlangan bo'lishi kerak), yoki (2) manbani to'g'ridan-to'g'ri
            <b> API manzili</b>ga ulang, yoki (3) guruh o'rniga <b>kanal</b> ishlating (bot kanal admini bo'lsa barcha postlarni ko'radi).
          </p>
        </Card>
      </div>
    </div>
  );
}
