import { BellRing, Clock3, Palette, PencilLine, Rocket, Zap, type LucideIcon } from 'lucide-react';
import { STATUS_META, type LeadStatus } from '@shared/statuses';
import type { ReactNode } from 'react';
import { STATUS_ICON } from '../shared/statusIcons';

function StatusIconInline({ status }: { status: LeadStatus }) {
  const Icon = STATUS_ICON[status];
  return <Icon className="h-4 w-4" strokeWidth={2.4} />;
}

export interface GuideStep {
  emoji: string;
  icon: LucideIcon;
  color: string;
  title: string;
  body: ReactNode;
}

const ORDER: LeadStatus[] = ['new', 'success', 'rejected', 'no_answer', 'postponed', 'cancelled', 'fake'];

export function StatusLegend() {
  return (
    <ul className="space-y-2">
      {ORDER.map((s) => {
        const m = STATUS_META[s];
        return (
          <li key={s} className="flex items-start gap-3 rounded-2xl p-2.5" style={{ backgroundColor: `${m.color}10` }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${m.color}1f`, color: m.color }}>
              <StatusIconInline status={s} />
            </span>
            <span>
              <span className="block text-[14px] font-semibold" style={{ color: m.color }}>
                {m.label}
              </span>
              <span className="text-[12.5px] text-muted">{m.description}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Yangi xodim uchun bosqichma-bosqich qo'llanma (onboarding va "Qo'llanma" sahifasi) */
export const GUIDE_STEPS: GuideStep[] = [
  {
    emoji: '👋',
    icon: Rocket,
    color: '#5b5bf6',
    title: 'Lidex\'ga xush kelibsiz!',
    body: (
      <p>
        Bu sizning ish panelingiz. Guruhga tushgan har bir lid (mijoz arizasi) avtomatik ravishda <b>sizga biriktiriladi</b> va shu yerda
        paydo bo'ladi. Sizning vazifangiz — mijoz bilan bog'lanib, natijani belgilash.
      </p>
    ),
  },
  {
    emoji: '🔔',
    icon: BellRing,
    color: '#0ea5e9',
    title: 'Bildirishnomalar',
    body: (
      <>
        <p>Yangi lid kelishi bilan bot sizga Telegramda xabar yuboradi. Xabar ostidagi tugmalar bilan statusni darhol belgilash mumkin.</p>
        <p className="mt-2 rounded-xl bg-amber-500/10 p-2.5 text-warn">
          ⚠️ Botni <b>ovozsiz qilmang</b> va bloklamang — aks holda eslatmalar va ogohlantirishlar kelmaydi.
        </p>
      </>
    ),
  },
  {
    emoji: '🎨',
    icon: Palette,
    color: '#a855f7',
    title: 'Statuslar va ranglar',
    body: <StatusLegend />,
  },
  {
    emoji: '⏰',
    icon: Clock3,
    color: '#eab308',
    title: 'Keyinga qoldirish va eslatmalar',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <b>Sana tanlasangiz</b> (masalan 22-sana) — bot aynan o'sha kuni va vaqtda eslatadi.
        </li>
        <li>
          <b>Sanasiz</b> qoldirsangiz — bot har 2 kunda eslatib turadi, status o'zgarguncha.
        </li>
        <li>
          <b>Ko'tarmadi</b> — bot bir necha soatdan keyin qayta qo'ng'iroq qilishni eslatadi.
        </li>
        <li>Barcha eslatmalar "Eslatmalar" bo'limida kun bo'yicha ko'rinadi.</li>
      </ul>
    ),
  },
  {
    emoji: '✏️',
    icon: PencilLine,
    color: '#16a34a',
    title: 'Tahrirlash',
    body: (
      <p>
        Yakunlangan lidlar (🟢 HA dedi, 🟠 YO'Q dedi, 🔴 Bekor) qulflanadi. Agar keyinchalik natija o'zgarsa (masalan mijoz fikrini
        o'zgartirsa), lidni ochib <b>"Statusni tahrirlash"</b> tugmasini bosing. Har bir o'zgarish tarixda saqlanadi.
      </p>
    ),
  },
  {
    emoji: '⚡️',
    icon: Zap,
    color: '#f97316',
    title: 'Tezlik muhim',
    body: (
      <>
        <p>
          Yangi lidga <b>15 daqiqa</b> ichida javob bering. Kechiksangiz bot ogohlantiradi, yanada kechiksangiz — rahbarlarga xabar
          boradi.
        </p>
        <p className="mt-2">
          Rahbarlar har bir lid, status va vaqtni ko'rib turadi hamda sizga lid bo'yicha xabar yozishi mumkin — ular "Xabarlar"
          bo'limiga keladi. O'qib, <b>"Tushundim"</b> tugmasini bosing.
        </p>
      </>
    ),
  },
];

export const ROADMAP: Array<{ key: 'bound' | 'onboarding' | 'firstStatus' | 'firstPostpone' | 'firstNote' | 'firstMessageRead'; title: string; hint: string }> = [
  { key: 'bound', title: 'Kalit bilan tizimga kirish', hint: 'Bajarildi — siz panelga ulangansiz' },
  { key: 'onboarding', title: "Qo'llanmani o'qish", hint: 'Statuslar va eslatmalar qanday ishlashi' },
  { key: 'firstStatus', title: 'Birinchi lidga status qo\'yish', hint: 'Lidni oching, qo\'ng\'iroq qiling va natijani belgilang' },
  { key: 'firstNote', title: 'Izoh yozish', hint: 'Mijoz nima deganini qisqacha yozib qo\'ying' },
  { key: 'firstPostpone', title: 'Lidni keyinga qoldirish', hint: 'Sana tanlang — bot o\'sha kuni eslatadi' },
  { key: 'firstMessageRead', title: "Rahbar xabarini o'qish", hint: '"Xabarlar" bo\'limidagi xabarni tasdiqlang' },
];
