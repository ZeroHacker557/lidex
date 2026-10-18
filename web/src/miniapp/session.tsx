import { createContext, useContext } from 'react';
import { createApi, type ApiClient } from '../shared/api';
import type { Employee } from '../shared/types';

let token: string | null = sessionStorage.getItem('lx_emp_token');
let onLogout: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
  if (t) sessionStorage.setItem('lx_emp_token', t);
  else sessionStorage.removeItem('lx_emp_token');
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
