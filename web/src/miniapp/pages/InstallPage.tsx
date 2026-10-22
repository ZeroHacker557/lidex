import { KeyRound, MousePointerClick, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui';
import { InstallCard } from '../components/InstallCard';
import { useBackButton } from '../hooks';
import { PageTitle } from './ui';

const STEPS = [
  { icon: Smartphone, title: "Bosh ekranga qo'shish", text: "Quyidagi tugmani bosing va Telegram oynasida tasdiqlang." },
  { icon: MousePointerClick, title: 'Belgini bosing', text: "Telefoningiz bosh ekranida Lidex belgisi paydo bo'ladi." },
  { icon: KeyRound, title: 'Avtomatik kirish', text: "Kalit qayta so'ralmaydi — Telegram akkauntingiz orqali o'z hisobingizga kirasiz." },
];

/** Bot'dagi "📲 Telefonga o'rnatish" tugmasi shu sahifani ochadi */
export function InstallPage() {
  const back = useBackButton();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-12 pt-5">
      <PageTitle title="Ilovani o'rnatish" subtitle="Lidex'ni telefoningizga ilova sifatida qo'shing" onBack={back} />
      <InstallCard big autoPrompt />
      <section className="card p-4 shadow-soft">
        <ol className="space-y-3.5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <s.icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">
                  {i + 1}. {s.title}
                </span>
                <span className="text-[13px] text-muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Button variant="secondary" className="w-full" onClick={() => navigate('/', { replace: true })}>
        Lidlarga o'tish
      </Button>
    </div>
  );
}
