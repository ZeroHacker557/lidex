import { createApi } from '../shared/api';

let onUnauthorized: (() => void) | null = null;
export function setAdminUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

export const api = createApi('/api/admin', { onUnauthorized: () => onUnauthorized?.() });
