import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  Workflow,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSocket } from '../shared/socket';
import type { Lead } from '../shared/types';
import { Avatar, useToast } from '../shared/ui';
import { api } from './api';
import { AlertsPanel, type Alerts } from './components/AlertsPanel';
import { useAdmin } from './context';
import { LeadDrawerHost } from './components/LeadDrawer';

export function Layout({ children }: { children: ReactNode }) {
  const { admin, isSuper, logout } = useAdmin();
  const qc = useQueryClient();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const location = useLocation();

  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api.get<Alerts>('/alerts'), refetchInterval: 60_000 });
  const alertCount = alerts.data
    ? alerts.data.escalated.length + alerts.data.unassigned.length + alerts.data.overdue.length + alerts.data.pendingGroups.length
    : 0;

  const live = useSocket(
    { kind: 'admin' },
    {
      'lead:new': (lead: Lead) => {
        void qc.invalidateQueries({ queryKey: ['leads'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
        toast(`🆕 Yangi lid #${lead.seq} — ${lead.groupTitle}`, 'info');
      },
      'lead:updated': (lead: Lead) => {
        void qc.invalidateQueries({ queryKey: ['leads'] });
        void qc.invalidateQueries({ queryKey: ['lead', lead.id] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      },
      activity: () => void qc.invalidateQueries({ queryKey: ['activity'] }),
      alert: (a: { text: string }) => {
        void qc.invalidateQueries({ queryKey: ['alerts'] });
        toast(`⚠️ ${a.text}`, 'error');
      },
      'message:updated': () => void qc.invalidateQueries({ queryKey: ['messages'] }),
      'employee:updated': () => void qc.invalidateQueries({ queryKey: ['employees'] }),
      'group:updated': () => {
        void qc.invalidateQueries({ queryKey: ['groups'] });
        void qc.invalidateQueries({ queryKey: ['alerts'] });
      },
    },
  );

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/leads', label: 'Lidlar', icon: ListChecks },
    { to: '/employees', label: 'Xodimlar', icon: UsersRound },
    { to: '/groups', label: 'Guruhlar', icon: Workflow },
    { to: '/messages', label: 'Xabarlar', icon: Mail },
    { to: '/activity', label: 'Faollik jurnali', icon: Activity },
    ...(isSuper ? [{ to: '/admins', label: 'Adminlar', icon: ShieldCheck }] : []),
    { to: '/guide', label: "Qo'llanma", icon: BookOpen },
    { to: '/settings', label: 'Sozlamalar', icon: Settings },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
        <img src="/favicon.svg" className="h-8 w-8" alt="" />
        <div>
          <p className="text-[17px] font-bold leading-none">Lidex</p>
          <p className="mt-0.5 text-[11px] text-muted">Lidlar boshqaruvi</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition',
                isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl p-2">
          <Avatar name={admin.fullName} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{admin.fullName}</p>
            <p className="text-[11px] text-muted">{isSuper ? 'Superadmin' : 'Admin'}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" title="Chiqish">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-fade-in bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
          <button className="rounded-lg p-1.5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span
            className={clsx(
              'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium sm:inline-flex',
              live ? 'bg-emerald-500/10 text-emerald-600' : 'bg-surface-2 text-muted',
            )}
          >
            <span className={clsx('h-2 w-2 rounded-full', live ? 'animate-pulse2 bg-emerald-500' : 'bg-slate-400')} />
            {live ? 'Real vaqt' : 'Ulanmoqda…'}
          </span>
          <button
            onClick={() => setAlertsOpen(true)}
            className={clsx(
              'relative inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium',
              alertCount ? 'bg-red-500/10 text-red-600' : 'text-muted hover:bg-surface-2',
            )}
          >
            <TriangleAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Diqqat talab</span>
            {alertCount > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{alertCount}</span>}
          </button>
        </header>
        <main key={location.pathname} className="mx-auto max-w-[1400px] animate-fade-in px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>

      <LeadDrawerHost />
      {alertsOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAlertsOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-semibold">Diqqat talab qiladi</h3>
              <button onClick={() => setAlertsOpen(false)} className="rounded-lg p-1.5 hover:bg-surface-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AlertsPanel data={alerts.data} onNavigate={() => setAlertsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
