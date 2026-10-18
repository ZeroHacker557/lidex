import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
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
import { ease, spring } from '../shared/motion';
import { useSocket } from '../shared/socket';
import type { Lead } from '../shared/types';
import { Avatar, Logo, useToast } from '../shared/ui';
import { api } from './api';
import { AlertsPanel, type Alerts } from './components/AlertsPanel';
import { LeadDrawerHost } from './components/LeadDrawer';
import { useAdmin } from './context';

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
        toast(`Yangi lid #${lead.seq} — ${lead.groupTitle}`, 'info');
      },
      'lead:updated': (lead: Lead) => {
        void qc.invalidateQueries({ queryKey: ['leads'] });
        void qc.invalidateQueries({ queryKey: ['lead', lead.id] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      },
      activity: () => void qc.invalidateQueries({ queryKey: ['activity'] }),
      alert: (a: { text: string }) => {
        void qc.invalidateQueries({ queryKey: ['alerts'] });
        toast(a.text, 'error');
      },
      'message:updated': () => void qc.invalidateQueries({ queryKey: ['messages'] }),
      'employee:updated': () => void qc.invalidateQueries({ queryKey: ['employees'] }),
      'group:updated': () => {
        void qc.invalidateQueries({ queryKey: ['groups'] });
        void qc.invalidateQueries({ queryKey: ['alerts'] });
      },
    },
  );

  const sections = [
    {
      title: 'Asosiy',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/leads', label: 'Lidlar', icon: ListChecks },
        { to: '/employees', label: 'Xodimlar', icon: UsersRound },
        { to: '/groups', label: 'Guruhlar', icon: Workflow },
      ],
    },
    {
      title: 'Nazorat',
      items: [
        { to: '/messages', label: 'Xabarlar', icon: Mail },
        { to: '/activity', label: 'Faollik jurnali', icon: Activity },
        ...(isSuper ? [{ to: '/admins', label: 'Adminlar', icon: ShieldCheck }] : []),
      ],
    },
    {
      title: 'Boshqa',
      items: [
        { to: '/guide', label: "Qo'llanma", icon: BookOpen },
        { to: '/settings', label: 'Sozlamalar', icon: Settings },
      ],
    },
  ];
  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <Logo className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-[19px] font-extrabold leading-none tracking-tight">Lidex</p>
          <p className="mt-1 text-[11.5px] font-medium text-muted">Lidlar boshqaruvi</p>
        </div>
      </div>
      <nav className="thin-scroll flex-1 space-y-5 overflow-y-auto px-3 pt-2">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted/70">{s.title}</p>
            <div className="space-y-0.5">
              {s.items.map(({ to, label, icon: Icon }) => {
                const active = isActive(to);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors',
                      active ? 'text-brand' : 'text-fg/65 hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    {active && (
                      <motion.span layoutId="side-active" transition={spring} className="absolute inset-0 rounded-xl bg-brand/10 ring-1 ring-inset ring-brand/15">
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-x-[13px] -translate-y-1/2 rounded-r-full bg-brand" />
                      </motion.span>
                    )}
                    <Icon className="relative h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                    <span className="relative">{label}</span>
                    {to === '/' && alertCount > 0 && (
                      <span className="relative ml-auto rounded-full bg-red-500 px-1.5 text-[10.5px] font-bold leading-[18px] text-white">{alertCount}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3">
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2/70 p-2.5 ring-1 ring-line/60">
          <Avatar name={admin.fullName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{admin.fullName}</p>
            <p className="text-[11.5px] text-muted">{isSuper ? 'Superadmin' : 'Admin'}</p>
          </div>
          <button onClick={logout} className="rounded-xl p-2 text-muted transition hover:bg-surface hover:text-danger" title="Chiqish">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] border-r border-line/70 bg-surface lg:block">{sidebar}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-pop" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={spring}>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/60 bg-bg/75 px-4 backdrop-blur-xl lg:px-8">
          <button className="rounded-xl p-2 hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-white">
              <Logo className="h-4 w-4" />
            </span>
            <span className="font-display font-extrabold">Lidex</span>
          </div>
          <div className="flex-1" />
          <span
            className={clsx(
              'hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold sm:inline-flex',
              live ? 'bg-emerald-500/10 text-good' : 'bg-surface-2 text-muted',
            )}
          >
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500" />}
              <span className={clsx('relative h-2 w-2 rounded-full', live ? 'bg-emerald-500' : 'bg-slate-400')} />
            </span>
            {live ? 'Real vaqtda' : 'Avto-yangilanish'}
          </span>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setAlertsOpen(true)}
            className={clsx(
              'relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition',
              alertCount ? 'bg-red-500/10 text-danger hover:bg-red-500/15' : 'text-muted hover:bg-surface-2',
            )}
          >
            <TriangleAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Diqqat talab</span>
            {alertCount > 0 && (
              <motion.span key={alertCount} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={spring} className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-[18px] text-white">
                {alertCount}
              </motion.span>
            )}
          </motion.button>
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease }}
            className="mx-auto max-w-[1440px] px-4 py-7 lg:px-8"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      <LeadDrawerHost />
      <AnimatePresence>
        {alertsOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAlertsOpen(false)} />
            <motion.div
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-pop"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={spring}
            >
              <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
                <h3 className="flex items-center gap-2.5 font-display text-[17px] font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-danger">
                    <TriangleAlert className="h-4 w-4" />
                  </span>
                  Diqqat talab qiladi
                </h3>
                <button onClick={() => setAlertsOpen(false)} className="rounded-xl p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="thin-scroll flex-1 overflow-y-auto">
                <AlertsPanel data={alerts.data} onNavigate={() => setAlertsOpen(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
