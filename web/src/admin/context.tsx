import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { AdminUser, Employee, Group } from '../shared/types';
import { api } from './api';

export interface AdminSession {
  admin: AdminUser;
  botUsername: string | null;
  isSuper: boolean;
  logout: () => void;
}

export const AdminCtx = createContext<AdminSession | null>(null);
export function useAdmin(): AdminSession {
  const s = useContext(AdminCtx);
  if (!s) throw new Error('Admin session yo\'q');
  return s;
}

export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: () => api.get<{ items: Group[] }>('/groups'), select: (d) => d.items });
}

export function useEmployees(groupId?: string) {
  return useQuery({
    queryKey: ['employees', groupId ?? 'all'],
    queryFn: () => api.get<{ items: Employee[] }>('/employees', { groupId }),
    select: (d) => d.items,
  });
}
