import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { fullDate, timeAgo } from '../../shared/format';
import type { AdminUser } from '../../shared/types';
import { Avatar, Button, ErrorBox, Sheet, Spinner, errorText, useToast } from '../../shared/ui';
import { api } from '../api';
import { Field, PageHeader, Select, Td, Th, Toggle } from '../components/common';
import { useAdmin, useGroups } from '../context';
import { Badge } from './EmployeesPage';

export function AdminsPage() {
  const q = useQuery({ queryKey: ['admins'], queryFn: () => api.get<{ items: AdminUser[] }>('/admins') });
  const groups = useGroups();
  const { admin: me } = useAdmin();
  const [edit, setEdit] = useState<AdminUser | 'new' | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.title]));
  const toggle = useMutation({
    mutationFn: (a: AdminUser) => api.patch(`/admins/${a.id}`, { isActive: !a.isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <div>
      <PageHeader
        title="Adminlar (katta xodimlar)"
        subtitle="Panelga login/parol bilan kiradigan rahbarlar. Oddiy admin faqat o'ziga biriktirilgan guruhlarni ko'radi"
        actions={
          <Button onClick={() => setEdit('new')}>
            <Plus className="h-4 w-4" /> Admin qo'shish
          </Button>
        }
      />
      <div className="card overflow-hidden shadow-card">
        {q.isError && <ErrorBox error={q.error} />}
        {q.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-[14px]">
            <thead className="bg-surface-2/50">
              <tr>
                <Th>Admin</Th>
                <Th>Rol</Th>
                <Th>Guruhlar</Th>
                <Th>Telegram</Th>
                <Th>Oxirgi kirish</Th>
                <Th>Faol</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {q.data?.items.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <Td>
                    <button className="flex items-center gap-2.5 text-left" onClick={() => setEdit(a)}>
                      <Avatar name={a.fullName} size={30} />
                      <span>
                        <span className="block font-medium">{a.fullName}</span>
                        <span className="text-[12px] text-muted">@{a.username}</span>
                      </span>
                    </button>
                  </Td>
                  <Td>{a.role === 'superadmin' ? <Badge tone="blue">Superadmin</Badge> : <Badge tone="gray">Admin</Badge>}</Td>
                  <Td className="text-muted">{a.role === 'superadmin' ? 'Hammasi' : a.groupIds.map((g) => groupName.get(g) ?? '…').join(', ') || '—'}</Td>
                  <Td>{a.telegramLinked ? '✅' : '—'}</Td>
                  <Td className="text-muted" >
                    <span title={a.lastLoginAt ? fullDate(a.lastLoginAt) : ''}>{a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'hali kirmagan'}</span>
                  </Td>
                  <Td>
                    <Toggle checked={a.isActive} disabled={a.id === me.id} onChange={() => toggle.mutate(a)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && <AdminForm admin={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AdminForm({ admin, onClose }: { admin?: AdminUser; onClose: () => void }) {
  const groups = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  const [username, setUsername] = useState(admin?.username ?? '');
  const [fullName, setFullName] = useState(admin?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'superadmin'>(admin?.role ?? 'admin');
  const [groupIds, setGroupIds] = useState<string[]>(admin?.groupIds ?? []);
  const save = useMutation({
    mutationFn: () =>
      admin
        ? api.patch(`/admins/${admin.id}`, { fullName, role, groupIds, ...(password ? { password } : {}) })
        : api.post('/admins', { username, fullName, password, role, groupIds }),
    onSuccess: () => {
      toast('Saqlandi');
      void qc.invalidateQueries({ queryKey: ['admins'] });
      onClose();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title={admin ? 'Adminni tahrirlash' : "Yangi admin"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button loading={save.isPending} disabled={!fullName || (!admin && (!username || password.length < 8))} onClick={() => save.mutate()}>
            Saqlash
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Login">
          <input className="input" value={username} disabled={!!admin} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="F.I.Sh">
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={admin ? 'Yangi parol (o\'zgartirmaslik uchun bo\'sh)' : 'Parol (kamida 8 belgi)'}>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'superadmin')}>
            <option value="admin">Admin — faqat tanlangan guruhlar</option>
            <option value="superadmin">Superadmin — hamma narsa + adminlarni boshqarish</option>
          </Select>
        </Field>
        {role === 'admin' && (
          <Field label="Guruhlar">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {groups.data?.map((g) => (
                <label key={g.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={(e) => setGroupIds((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))}
                  />
                  {g.title}
                </label>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
