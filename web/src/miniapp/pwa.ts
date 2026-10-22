// Sayt sifatida ochilganda: telefonga ilova (PWA) sifatida o'rnatish
import { useSyncExternalStore } from 'react';
import { insideTelegram, tg } from './telegram';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const ua = navigator.userAgent;
export const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Telegram'ning ichki brauzeri (o'rnatish imkoni yo'q — tashqi brauzerda ochish kerak) */
export const inTelegramBrowser = !insideTelegram && /telegram/i.test(ua);

/** Bosh ekrandagi belgidan ochilgan (o'rnatilgan ilova) */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Saytning xodimlar ilovasi manzili */
export const siteUrl = () => `${location.origin}/app/`;

export function initPwa() {
  if (insideTelegram) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // o'zimizning "Telefonga o'rnatish" tugmamiz ko'rsatadi
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => undefined);
  }
}

/**
 * installed — o'rnatilgan / ilovadan ochilgan; prompt — brauzer o'rnatish oynasini ko'rsata oladi;
 * ios — Safari: Ulashish → Bosh ekranga qo'shish; telegram — avval brauzerda ochish kerak; manual — brauzer menyusi orqali
 */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'telegram' | 'manual';

function snapshot(): InstallState {
  if (insideTelegram || inTelegramBrowser) return 'telegram';
  if (installedNow || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS) return 'ios';
  return 'manual';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
  );
}

/** Brauzerning o'rnatish oynasi. true — foydalanuvchi o'rnatdi */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === 'accepted') installedNow = true;
  emit();
  return outcome === 'accepted';
}

/** Saytni tashqi brauzerda ochish (Telegram Mini App ichidan) */
export function openSiteInBrowser() {
  if (tg) tg.openLink(siteUrl());
  else window.open(siteUrl(), '_blank');
}
