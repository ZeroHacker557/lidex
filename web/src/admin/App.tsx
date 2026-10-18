import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { AdminUser } from '../shared/types';
import { FullScreenLoader } from '../shared/ui';
import { api, setAdminUnauthorized } from './api';
import { AdminCtx, type AdminSession } from './context';
import { Layout } from './Layout';
import { ActivityPage } from './pages/ActivityPage';
import { AdminsPage } from './pages/AdminsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { GroupsPage } from './pages/GroupsPage';
import { GuidePage } from './pages/GuidePage';
import { LeadsPage } from './pages/LeadsPage';
import { LoginPage } from './pages/LoginPage';
import { MessagesPage } from './pages/MessagesPage';
import { SettingsPage } from './pages/SettingsPage';

export function AdminApp() {
  const qc = useQueryClient();
  const [loggedOut, setLoggedOut] = useState(false);
  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<{ admin: AdminUser; botUsername: string | null }>('/auth/me'),
    retry: false,
    enabled: !loggedOut,
  });

  useEffect(() => {
    setAdminUnauthorized(() => {
      qc.clear();
      setLoggedOut(true);
    });
  }, [qc]);

  const session: AdminSession | null = useMemo(
    () =>
      me.data && !loggedOut
        ? {
            admin: me.data.admin,
            botUsername: me.data.botUsername,
            isSuper: me.data.admin.role === 'superadmin',
            logout: async () => {
              await api.post('/auth/logout').catch(() => undefined);
              qc.clear();
              setLoggedOut(true);
            },
          }
        : null,
    [me.data, loggedOut, qc],
  );

  if (me.isPending && !loggedOut) return <FullScreenLoader />;
  if (!session)
    return (
      <LoginPage
        onLogin={async () => {
          setLoggedOut(false);
          await qc.invalidateQueries({ queryKey: ['auth-me'] });
        }}
      />
    );

  return (
    <AdminCtx.Provider value={session}>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {session.isSuper && <Route path="/admins" element={<AdminsPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AdminCtx.Provider>
  );
}
