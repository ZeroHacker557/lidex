import clsx from 'clsx';
import { CircleCheckBig, MonitorSmartphone, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Logo, useToast } from '../../shared/ui';
import { addToHomeScreen, haptic, homeScreenStatus, type HomeScreenStatus } from '../telegram';

/**
 * "Telefonga ilova sifatida o'rnatish" — bosh ekranda Lidex belgisi paydo bo'ladi.
 * Belgi Mini App'ni Telegram ichida ochadi, shuning uchun xodim o'z Telegram akkaunti bilan avtomatik kiradi.
 */
export function InstallCard({ big = false, autoPrompt = false }: { big?: boolean; autoPrompt?: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<HomeScreenStatus | 'loading'>('loading');

  useEffect(() => {
    let alive = true;
    void homeScreenStatus().then((s) => {
      if (!alive) return;
      setStatus(s);
      // Bot'dagi "Telefonga o'rnatish" tugmasidan kelinganda — darhol taklif oynasi
      if (autoPrompt && (s === 'missed' || s === 'unknown')) install();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = () => {
    haptic.tap();
    const ok = addToHomeScreen(() => {
      haptic.success();
      setStatus('added');
      toast("Lidex bosh ekranga qo'shildi");
    });
    if (!ok) setStatus('unsupported');
  };

  if (status === 'loading') return null;

  return (
    <section className={clsx('card overflow-hidden shadow-soft', big ? 'p-6' : 'p-4')}>
      <div className="flex items-start gap-3.5">
        <span
          className={clsx(
            'flex shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow',
            big ? 'h-16 w-16' : 'h-11 w-11',
          )}
        >
          <Logo className={big ? 'h-8 w-8' : 'h-5 w-5'} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={clsx('font-display font-bold', big ? 'text-[20px]' : 'text-[15.5px]')}>
            {status === 'added' ? "Lidex telefoningizga o'rnatilgan" : "Telefonga ilova sifatida o'rnatish"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {status === 'added'
              ? "Bosh ekrandagi Lidex belgisini bossangiz, panel darhol ochiladi."
              : "Bosh ekranda Lidex belgisi paydo bo'ladi — bir bosishda ochiladi. Kalit qayta so'ralmaydi: Telegram akkauntingiz orqali avtomatik kirasiz."}
          </p>
        </div>
      </div>

      {status === 'added' ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-good">
          <CircleCheckBig className="h-4 w-4" /> O'rnatilgan
        </p>
      ) : status === 'unsupported' ? (
        <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-fg/80">
          <p className="flex items-center gap-2 font-semibold">
            <MonitorSmartphone className="h-4 w-4 text-muted" /> Bu qurilmada mavjud emas
          </p>
          <p className="mt-1 text-muted">
            Panelni <b className="text-fg">telefondagi Telegram ilovasidan</b> oching va Telegram'ni oxirgi versiyaga yangilang. Kompyuter
            versiyasida bu imkoniyat yo'q.
          </p>
        </div>
      ) : (
        <Button size={big ? 'lg' : 'md'} className="mt-4 w-full" onClick={install}>
          <Smartphone className="h-4 w-4" /> Bosh ekranga qo'shish
        </Button>
      )}
    </section>
  );
}
