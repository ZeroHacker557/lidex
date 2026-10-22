import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LeadStatus } from '@shared/statuses';
import { api } from './session';
import { tg } from './telegram';

export interface Summary {
  byStatus: Record<LeadStatus, number>;
  active: number;
  total: number;
  dueToday: number;
  unreadMessages: number;
  /** Sana tanlanganda — shu kun bo'yicha sonlar */
  day: { date: string; byStatus: Record<LeadStatus, number>; active: number; total: number } | null;
}

export function useSummary(date?: string | null) {
  // Hisoblagichlar (Yangi, eslatma, xabar) — har 10 soniyada; ilova qayta ochilganda darhol
  return useQuery({
    queryKey: ['summary', date ?? 'all'],
    queryFn: () => api.get<Summary>('/summary', { date: date ?? undefined }),
    refetchInterval: 10_000,
    staleTime: 0,
  });
}

/** Telegram BackButton: ichki sahifalarda ko'rsatiladi */
export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const back = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(back);
    return () => {
      tg!.BackButton.offClick(back);
      tg!.BackButton.hide();
    };
  }, [navigate, location.key]);
  return () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
}
