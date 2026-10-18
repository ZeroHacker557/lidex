import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Page } from '../shared/motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../shared/api';
import { useSocket } from '../shared/socket';
import type { Employee, Lead, StaffMessage } from '../shared/types';
import { ErrorBox, FullScreenLoader, useToast } from '../shared/ui';
import { BottomNav } from './components/BottomNav';
import { GuidePage } from './pages/GuidePage';
import { KeyScreen } from './pages/KeyScreen';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadsPage } from './pages/LeadsPage';
import { MessagesPage } from './pages/MessagesPage';
import { NoTelegram } from './pages/NoTelegram';
import { Onboarding } from './pages/Onboarding';
import { ProfilePage } from './pages/ProfilePage';
import { RemindersPage } from './pages/RemindersPage';
import { api, SessionCtx, setLogoutHandler, setToken, type Session } from './session';
import { getInitData, haptic, tg } from './telegram';

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-telegram' }
  | { kind: 'need-key'; initData: string; firstName: string }
  | { kind: 'ready'; token: string; employee: Employee }
  | { kind: 'error'; error: unknown };

interface AuthResponse {
  token?: string;
  employee?: Employee;
  needKey?: boolean;
  user?: { firstName: string };
}

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const authenticate = useCallback(async () => {
    const initData = getInitData();
    if (!initData) return setPhase({ kind: 'no-telegram' });
    try {
      const res = await api.post<AuthResponse>('/auth', { initData });
      if (res.token && res.employee) {
        setToken(res.token);
        setPhase({ kind: 'ready', token: res.token, employee: res.employee });
      } else {
        setPhase({ kind: 'need-key', initData, firstName: res.user?.firstName ?? '' });
      }
    } catch (error) {
      setPhase({ kind: 'error', error });
    }
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      setToken(null);
      setAttempt((n) => n + 1);
    });
    void authenticate();
  }, [authenticate, attempt]);

  if (phase.kind === 'loading') return <FullScreenLoader label="Yuklanmoqda..." />;
  if (phase.kind === 'no-telegram') return <NoTelegram />;
  if (phase.kind === 'error')
    return (
      <div className="pt-10">
        <ErrorBox error={phase.error} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  if (phase.kind === 'need-key')
    return (
      <KeyScreen
        initData={phase.initData}
        firstName={phase.firstName}
        onSuccess={(token, employee) => {
          setToken(token);
          haptic.success();
          setPhase({ kind: 'ready', token, employee });
        }}
      />
    );
  return (
    <Ready
      token={phase.token}
      employee={phase.employee}
      onEmployee={(employee) => setPhase({ kind: 'ready', token: phase.token, employee })}
      onLogout={() => {
        setToken(null);
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function Ready({
  token,
  employee,
  onEmployee,
  onLogout,
}: {
  token: string;
  employee: Employee;
  onEmployee: (e: Employee) => void;
  onLogout: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const refresh = useCallback(() => {
    api
      .get<{ employee: Employee }>('/me')
      .then((r) => onEmployee(r.employee))
      .catch((e) => e instanceof ApiError && e.status === 401 && onLogout());
  }, [onEmployee, onLogout]);

  const session: Session = useMemo(() => ({ employee, token, refresh }), [employee, token, refresh]);

  // Telegram start_param orqali kelgan bo'lsa (t.me/bot/app?startapp=lead_ID)
  useEffect(() => {
    const sp = tg?.initDataUnsafe.start_param;
    if (sp?.startsWith('lead_')) navigate(`/lead/${sp.slice(5)}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['leads'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['reminders'] });
  }, [qc]);

  useSocket(
    { kind: 'employee', token },
    {
      'lead:new': (lead: Lead) => {
        invalidate();
        haptic.warning();
        toast(`🆕 Yangi lid #${lead.seq}: ${lead.name ?? lead.phone ?? ''}`, 'info');
      },
      'lead:updated': (lead: Lead) => {
        qc.setQueryData(['lead', lead.id], (old: { lead: Lead } | undefined) => (old ? { ...old, lead } : old));
        invalidate();
      },
      'lead:removed': () => invalidate(),
      'message:new': (m: StaffMessage) => {
        void qc.invalidateQueries({ queryKey: ['messages'] });
        void qc.invalidateQueries({ queryKey: ['summary'] });
        haptic.warning();
        toast(m.type === 'warning' ? `⚠️ Ogohlantirish: ${m.adminName}` : `✉️ Yangi xabar: ${m.adminName}`, 'info');
      },
      'message:updated': () => void qc.invalidateQueries({ queryKey: ['messages'] }),
      'employee:updated': (p: { loggedOut?: boolean }) => (p.loggedOut ? onLogout() : refresh()),
    },
  );

  if (!employee.onboardingDone) {
    return (
      <SessionCtx.Provider value={session}>
        <Onboarding
          onDone={async () => {
            await api.patch('/me', { onboardingDone: true }).catch(() => undefined);
            onEmployee({ ...employee, onboardingDone: true });
          }}
        />
      </SessionCtx.Provider>
    );
  }

  const nested = location.pathname.startsWith('/lead/') || location.pathname.startsWith('/guide');

  return (
    <SessionCtx.Provider value={session}>
      <div className={nested ? '' : 'pb-28'}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Page><LeadsPage /></Page>} />
            <Route path="/reminders" element={<Page><RemindersPage /></Page>} />
            <Route path="/messages" element={<Page><MessagesPage /></Page>} />
            <Route
              path="/profile"
              element={<Page><ProfilePage onReplayOnboarding={() => onEmployee({ ...employee, onboardingDone: false })} /></Page>}
            />
            <Route path="/guide" element={<Page><GuidePage /></Page>} />
            <Route path="/lead/:id" element={<Page><LeadDetailPage /></Page>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      <AnimatePresence>{!nested && <BottomNav />}</AnimatePresence>
    </SessionCtx.Provider>
  );
}
