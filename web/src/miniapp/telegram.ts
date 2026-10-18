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
  onEvent?(event: string, cb: () => void): void;
  setBottomBarColor?(c: string): void;
  BackButton: TgButton;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

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
