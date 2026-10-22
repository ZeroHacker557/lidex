import { createContext, useContext } from 'react';
import { createApi, type ApiClient } from '../shared/api';
import type { Employee } from '../shared/types';
import { insideTelegram } from './telegram';

// Telegram ichida token har ochilishda initData orqali yangidan olinadi (sessionStorage).
// Sayt / o'rnatilgan ilovada esa qurilmada saqlanadi — keyingi safar avtomatik kiriladi.
const store: Storage = insideTelegram ? sessionStorage : localStorage;
const KEY = insideTelegram ? 'lx_emp_token' : 'lx_emp_web_token';

let token: string | null = read();
let onLogout: (() => void) | null = null;

function read(): string | null {
  try {
    return store.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) store.setItem(KEY, t);
    else store.removeItem(KEY);
  } catch {
    /* xususiy rejim */
  }
}
export const getToken = () => token;
export function setLogoutHandler(fn: () => void) {
  onLogout = fn;
}

export const api: ApiClient = createApi('/api/app', {
  token: () => token,
  onUnauthorized: () => onLogout?.(),
});

export interface Session {
  employee: Employee;
  token: string;
  refresh: () => void;
}

export const SessionCtx = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('Session yo\'q');
  return s;
}
