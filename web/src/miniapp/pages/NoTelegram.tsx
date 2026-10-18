import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { ease } from '../../shared/motion';

export function NoTelegram() {
  const dev = import.meta.env.DEV;
  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="mesh pointer-events-none absolute inset-0" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative flex flex-col items-center">
        <div className="mb-6 flex h-20 w-20 animate-float items-center justify-center rounded-[26px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_18px_40px_-12px_rgb(14_165_233)]">
          <Send className="h-9 w-9 -translate-x-0.5" />
        </div>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight">Panelni Telegram orqali oching</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Bu sahifa Telegram Mini App sifatida ishlaydi. Botga kiring va <b className="text-fg">"Panel"</b> tugmasini bosing.
        </p>
        {dev && (
          <p className="mt-6 rounded-2xl bg-surface p-3.5 text-left text-[13px] text-muted ring-1 ring-line">
            Lokal sinov: serverda <code className="font-semibold text-fg">DEV_AUTH=true</code> qilib, manzilga <code className="font-semibold text-fg">?dev_tg=111</code> qo'shing.
          </p>
        )}
      </motion.div>
    </div>
  );
}
