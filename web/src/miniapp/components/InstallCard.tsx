import clsx from 'clsx';
import { CircleCheckBig, Copy, ExternalLink, EllipsisVertical, Share, Smartphone, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Logo, useToast } from '../../shared/ui';
import { openSiteInBrowser, promptInstall, siteUrl, useInstallState } from '../pwa';
import { haptic, insideTelegram } from '../telegram';

/**
 * "Telefonga ilova sifatida o'rnatish" — sayt (PWA) orqali.
 * O'rnatilgan ilova bir marta "Telegram orqali kirish" bilan ulanadi va keyin doim o'z hisobida ochiladi.
 */
export function InstallCard({ big = false }: { big?: boolean }) {
  const toast = useToast();
  const state = useInstallState();

  const install = async () => {
    haptic.tap();
    if (await promptInstall()) {
      haptic.success();
      toast("Lidex telefoningizga o'rnatildi");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl());
      haptic.success();
      toast('Havola nusxalandi');
    } catch {
      toast(siteUrl(), 'info');
    }
  };

  const installed = state === 'installed';

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
            {installed ? "Lidex ilova sifatida ochilgan" : "Telefonga ilova sifatida o'rnatish"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {installed
              ? "Bosh ekrandagi Lidex belgisidan oching — o'z hisobingizda darhol ochiladi."
              : "Bosh ekranda Lidex belgisi paydo bo'ladi. Bir marta Telegram orqali tasdiqlaysiz, keyin kalit ham, kod ham so'ralmaydi."}
          </p>
        </div>
      </div>

      {installed ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-good">
          <CircleCheckBig className="h-4 w-4" /> O'rnatilgan
        </p>
      ) : state === 'prompt' ? (
        <Button size={big ? 'lg' : 'md'} className="mt-4 w-full" onClick={install}>
          <Smartphone className="h-4 w-4" /> Telefonga o'rnatish
        </Button>
      ) : state === 'telegram' ? (
        <>
          <Hint>
            {insideTelegram ? (
              <>
                Telegram ichida o'rnatib bo'lmaydi. Saytni <b className="text-fg">Chrome</b> yoki <b className="text-fg">Safari</b>da oching va o'sha yerda
                o'rnating.
              </>
            ) : (
              <>
                Sayt Telegram ichida ochildi. Yuqoridagi <EllipsisVertical className="inline h-3.5 w-3.5 align-[-2px]" /> menyusidan{' '}
                <b className="text-fg">"Brauzerda ochish"</b> ni tanlang (Chrome yoki Safari).
              </>
            )}
          </Hint>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {insideTelegram ? (
              <Button size="md" onClick={openSiteInBrowser}>
                <ExternalLink className="h-4 w-4" /> Brauzerda ochish
              </Button>
            ) : null}
            <Button size="md" variant="secondary" className={insideTelegram ? '' : 'col-span-2'} onClick={copy}>
              <Copy className="h-4 w-4" /> Havolani nusxalash
            </Button>
          </div>
        </>
      ) : state === 'ios' ? (
        <Hint>
          <Step n={1}>
            Safari pastidagi <Share className="inline h-4 w-4 align-[-3px] text-brand" /> <b className="text-fg">Ulashish</b> tugmasini bosing
          </Step>
          <Step n={2}>
            <SquarePlus className="inline h-4 w-4 align-[-3px] text-brand" /> <b className="text-fg">"Bosh ekranga qo'shish"</b> ni tanlang
          </Step>
          <Step n={3}>
            <b className="text-fg">"Qo'shish"</b> ni bosing — bosh ekranda Lidex paydo bo'ladi
          </Step>
        </Hint>
      ) : (
        <Hint>
          <Step n={1}>
            Brauzer menyusini oching: <EllipsisVertical className="inline h-4 w-4 align-[-3px] text-brand" />
          </Step>
          <Step n={2}>
            <b className="text-fg">"Ilovani o'rnatish"</b> yoki <b className="text-fg">"Bosh ekranga qo'shish"</b> ni tanlang
          </Step>
        </Hint>
      )}
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="mt-4 space-y-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-fg/80">{children}</div>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="flex gap-2.5">
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">{n}</span>
      <span>{children}</span>
    </p>
  );
}
