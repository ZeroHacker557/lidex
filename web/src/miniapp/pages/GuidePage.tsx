import { ArrowLeft } from 'lucide-react';
import { GUIDE_STEPS } from '../guide';
import { useBackButton } from '../hooks';
import { insideTelegram } from '../telegram';

export function GuidePage() {
  const back = useBackButton();
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-4">
      <div className="flex items-center gap-2">
        {!insideTelegram && (
          <button onClick={back} className="-ml-1 rounded-full p-1" aria-label="Orqaga">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-[22px] font-bold">Qo'llanma</h1>
      </div>
      <p className="mt-1 text-sm text-muted">Lidex bilan ishlash bo'yicha to'liq yo'riqnoma</p>
      <div className="mt-4 space-y-3">
        {GUIDE_STEPS.map((s, i) => (
          <section key={i} className="card p-4">
            <h2 className="mb-2 flex items-center gap-2 text-[16px] font-semibold">
              <span className="text-xl">{s.emoji}</span> {s.title}
            </h2>
            <div className="text-[14px] leading-relaxed">{s.body}</div>
          </section>
        ))}
        <section className="card p-4 text-[14px] leading-relaxed">
          <h2 className="mb-2 text-[16px] font-semibold">❓ Ko'p beriladigan savollar</h2>
          <p className="font-medium">Lid menga kelmayapti?</p>
          <p className="mb-3 text-muted">Profil bo'limida "Lid qabul qilish" yoqilganini tekshiring. Muammo davom etsa rahbaringizga yozing.</p>
          <p className="font-medium">Telefonim almashdi / yangi Telegram akkaunt</p>
          <p className="mb-3 text-muted">Rahbaringizdan yangi kalit so'rang — eski bog'lanish bekor qilinadi.</p>
          <p className="font-medium">Xato status qo'ydim</p>
          <p className="text-muted">Lidni oching va "Statusni tahrirlash" orqali to'g'rilang. Izohda sababini yozing.</p>
        </section>
      </div>
    </div>
  );
}
