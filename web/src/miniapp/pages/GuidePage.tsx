import { motion } from 'framer-motion';
import { CircleHelp } from 'lucide-react';
import { ease } from '../../shared/motion';
import { GUIDE_STEPS } from '../guide';
import { useBackButton } from '../hooks';
import { PageTitle } from './ui';

const FAQ = [
  { q: 'Lid menga kelmayapti?', a: "Profil bo'limida \"Lid qabul qilish\" yoqilganini tekshiring. Muammo davom etsa rahbaringizga yozing." },
  { q: 'Telefonim almashdi / yangi Telegram akkaunt', a: "Rahbaringizdan yangi kalit so'rang — eski bog'lanish bekor qilinadi." },
  { q: "Xato status qo'ydim", a: "Lidni oching va \"Statusni tahrirlash\" orqali to'g'rilang. Izohda sababini yozing." },
];

export function GuidePage() {
  const back = useBackButton();
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-5">
      <PageTitle title="Qo'llanma" subtitle="Lidex bilan ishlash bo'yicha to'liq yo'riqnoma" onBack={back} />
      <div className="mt-5 space-y-3">
        {GUIDE_STEPS.map((s, i) => (
          <motion.section
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease }}
            className="card p-4 shadow-soft"
          >
            <h2 className="mb-2.5 flex items-center gap-2.5 font-display text-[16px] font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}b3)` }}>
                <s.icon className="h-[18px] w-[18px]" />
              </span>
              {s.title}
            </h2>
            <div className="text-[14px] leading-relaxed text-fg/85">{s.body}</div>
          </motion.section>
        ))}
        <section className="card p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-[16px] font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <CircleHelp className="h-[18px] w-[18px]" />
            </span>
            Ko'p beriladigan savollar
          </h2>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl bg-surface-2/70 px-3.5 py-3 text-[14px]">
                <summary className="cursor-pointer list-none font-semibold">{f.q}</summary>
                <p className="mt-1.5 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
