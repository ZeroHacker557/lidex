import { Smartphone } from 'lucide-react';

export function NoTelegram() {
  const dev = import.meta.env.DEV;
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <Smartphone className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold">Panelni Telegram orqali oching</h1>
      <p className="mt-2 text-[15px] text-muted">
        Bu sahifa Telegram Mini App sifatida ishlaydi. Botga kiring va <b>"Panel"</b> tugmasini bosing.
      </p>
      {dev && (
        <p className="mt-6 rounded-xl bg-surface p-3 text-left text-[13px] text-muted">
          🛠 Lokal sinov: serverda <code>DEV_AUTH=true</code> qilib, manzilga <code>?dev_tg=111</code> qo'shing.
        </p>
      )}
    </div>
  );
}
