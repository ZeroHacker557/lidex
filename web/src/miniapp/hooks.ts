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
}

export function useSummary() {
  return useQuery({ queryKey: ['summary'], queryFn: () => api.get<Summary>('/summary'), refetchInterval: 60_000 });
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
