// Telegram WebApp SDK uchun yupqa qatlam (Telegramdan tashqarida ham xatosiz ishlaydi)

interface TgButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  setText?(t: string): void;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; username?: string }; start_param?: string };
  colorScheme: 'light' | 'dark';
  platform: string;
  version: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  enableClosingConfirmation?(): void;
  disableVerticalSwipes?(): void;
  isVersionAtLeast?(v: string): boolean;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  showConfirm?(msg: string, cb: (ok: boolean) => void): void;
  onEvent?(event: string, cb: (...args: never[]) => void): void;
  offEvent?(event: string, cb: (...args: never[]) => void): void;
  addToHomeScreen?(): void;
  checkHomeScreenStatus?(cb: (status: HomeScreenStatus) => void): void;
  setBottomBarColor?(c: string): void;
  BackButton: TgButton;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export const tg: TgWebApp | null = window.Telegram?.WebApp?.initData !== undefined ? window.Telegram!.WebApp! : null;

export const insideTelegram = !!tg?.initData;

const BG = { light: '#f4f5f9', dark: '#0a0c13' } as const;

/** Telegram yorug'/qorong'i rejimiga moslashish: o'z dizayn tokenlarimiz + Telegram sarlavha rangi */
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  // Telegram'dan tashqarida SDK har doim "light" qaytaradi — u holda tizim sozlamasiga qaraymiz
  const scheme = tg?.initData ? tg.colorScheme : darkQuery.matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = scheme;
  try {
    tg?.setHeaderColor?.(BG[scheme]);
    tg?.setBackgroundColor?.(BG[scheme]);
    if (tg?.isVersionAtLeast?.('7.10')) tg.setBottomBarColor?.(BG[scheme]);
  } catch {
    /* eski versiyalar */
  }
}

export function initTelegram() {
  applyTheme();
  darkQuery.addEventListener('change', applyTheme);
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.onEvent?.('themeChanged', applyTheme);
  try {
    if (tg.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes?.();
  } catch {
    /* eski versiyalar */
  }
}

/** initData: Telegram ichida — haqiqiy; lokal dev rejimida — ?dev_tg=123 */
export function getInitData(): string | null {
  if (tg?.initData) return tg.initData;
  const dev = new URLSearchParams(location.search).get('dev_tg') ?? sessionStorage.getItem('lx_dev_tg');
  if (dev) {
    sessionStorage.setItem('lx_dev_tg', dev);
    return `dev:${dev}`;
  }
  return null;
}

/** Mini App qayta faollashganda (fon rejimidan qaytganda) chaqiriladi */
export function onAppActivated(cb: () => void): () => void {
  const onVisible = () => document.visibilityState === 'visible' && cb();
  document.addEventListener('visibilitychange', onVisible);
  tg?.onEvent?.('activated', cb);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    (tg as unknown as { offEvent?: (e: string, c: () => void) => void } | null)?.offEvent?.('activated', cb);
  };
}

export const haptic = {
  success: () => tg?.HapticFeedback?.notificationOccurred('success'),
  error: () => tg?.HapticFeedback?.notificationOccurred('error'),
  warning: () => tg?.HapticFeedback?.notificationOccurred('warning'),
  tap: () => tg?.HapticFeedback?.impactOccurred('light'),
  select: () => tg?.HapticFeedback?.selectionChanged(),
};

export function openTelegramUser(username: string) {
  const url = `https://t.me/${username}`;
  if (tg) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

// ---------- Bosh ekranga ilova sifatida qo'shish (Telegram 8.0+) ----------

/** Joriy holat: added — o'rnatilgan, missed — hali yo'q, unsupported — bu qurilma/versiyada mavjud emas */
export function homeScreenStatus(): Promise<HomeScreenStatus> {
  return new Promise((resolve) => {
    if (!tg?.initData || !tg.checkHomeScreenStatus || !tg.isVersionAtLeast?.('8.0')) return resolve('unsupported');
    const timer = setTimeout(() => resolve('unknown'), 2500);
    try {
      tg.checkHomeScreenStatus((status) => {
        clearTimeout(timer);
        resolve(status);
      });
    } catch {
      clearTimeout(timer);
      resolve('unsupported');
    }
  });
}

/** Telegram'ning "Bosh ekranga qo'shish" oynasini ochadi. Qo'shilganda onAdded chaqiriladi */
export function addToHomeScreen(onAdded?: () => void): boolean {
  if (!tg?.addToHomeScreen || !tg.isVersionAtLeast?.('8.0')) return false;
  if (onAdded) {
    const handler = () => {
      tg?.offEvent?.('homeScreenAdded', handler);
      onAdded();
    };
    tg.onEvent?.('homeScreenAdded', handler);
  }
  tg.addToHomeScreen();
  return true;
}
