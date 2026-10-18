import { LEAD_STATUSES, OPEN_STATUSES, type LeadStatus } from '../../../shared/statuses.js';
import { COL, db, type Employee, type Filter, type Lead, type WithId } from '../db/index.js';
import { addDays, localDateKey, startOfLocalDay } from '../lib/time.js';
import { onlineEmployeeIds } from './realtime.js';

/** Firestore `in` 30 tadan ko'p qiymat qabul qilmaydi */
export function scopeFilter(groupIds: string[] | null, groupId?: string | null): Filter[] {
  if (groupId) return [['groupId', '==', groupId]];
  if (groupIds) return [['groupId', 'in', groupIds.length ? groupIds.slice(0, 30) : ['__none__']]];
  return [];
}

export interface DashboardInput {
  scope: Filter[];
  from: Date;
  to: Date;
  employees: WithId<Employee>[];
}

async function countByStatus(where: Filter[]): Promise<Record<LeadStatus, number>> {
  const counts = await Promise.all(LEAD_STATUSES.map((s) => db().count(COL.leads, { where: [...where, ['status', '==', s]] })));
  return Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, counts[i]])) as Record<LeadStatus, number>;
}

export async function dashboard({ scope, from, to, employees }: DashboardInput) {
  const range: Filter[] = [...scope, ['createdAt', '>=', from], ['createdAt', '<', to]];

  // Kunlik dinamika (maks. 31 kun)
  const days: Date[] = [];
  for (let d = startOfLocalDay(from); d < to && days.length < 31; d = addDays(d, 1)) days.push(d);

  const [byStatus, response, openNow, overdueReminders, unassigned, flagged, daily, perEmployee] = await Promise.all([
    countByStatus(range),
    db().aggregate(COL.leads, { where: range }, { avg: 'responseSeconds' }),
    db().count(COL.leads, { where: [...scope, ['status', 'in', OPEN_STATUSES]] }),
    // Belgilangan sanasi o'tib ketgan, lekin hali ishlanmagan lidlar
    db().count(COL.leads, {
      where: [...scope, ['status', '==', 'postponed'], ['postponedUntil', '<', new Date()]],
    }),
    db().count(COL.leads, { where: [...scope, ['assignedEmployeeId', '==', null], ['status', 'in', OPEN_STATUSES]] }),
    db().count(COL.leads, { where: [...scope, ['flagged', '==', true]] }),
    Promise.all(
      days.map(async (d) => {
        const w: Filter[] = [...scope, ['createdAt', '>=', d], ['createdAt', '<', addDays(d, 1)]];
        const [total, success, rejected, cancelled] = await Promise.all([
          db().count(COL.leads, { where: w }),
          db().count(COL.leads, { where: [...w, ['status', '==', 'success']] }),
          db().count(COL.leads, { where: [...w, ['status', '==', 'rejected']] }),
          db().count(COL.leads, { where: [...w, ['status', '==', 'cancelled']] }),
        ]);
        return { date: localDateKey(d), total, success, rejected, cancelled };
      }),
    ),
    employeeStats(employees, range),
  ]);

  const total = LEAD_STATUSES.reduce((a, s) => a + byStatus[s], 0);
  return {
    range: { from, to },
    total,
    byStatus,
    conversion: total ? Math.round((byStatus.success / total) * 100) : 0,
    avgResponseSeconds: response.avg,
    openNow,
    overdueReminders,
    unassigned,
    flagged,
    daily,
    employees: perEmployee,
  };
}

export async function employeeStats(employees: WithId<Employee>[], range: Filter[]) {
  const online = onlineEmployeeIds();
  const rows = await Promise.all(
    employees.map(async (e) => {
      const where: Filter[] = [...range, ['assignedEmployeeId', '==', e.id]];
      const [byStatus, response, openNow, lateNew] = await Promise.all([
        countByStatus(where),
        db().aggregate(COL.leads, { where }, { avg: 'responseSeconds' }),
        db().count(COL.leads, { where: [['assignedEmployeeId', '==', e.id], ['status', 'in', OPEN_STATUSES]] }),
        db().count(COL.leads, {
          where: [
            ['assignedEmployeeId', '==', e.id],
            ['status', '==', 'new'],
            ['slaNotifiedAt', '!=', null],
          ],
        }),
      ]);
      const total = LEAD_STATUSES.reduce((a, s) => a + byStatus[s], 0);
      return {
        id: e.id,
        fullName: e.fullName,
        isActive: e.isActive,
        acceptingLeads: e.acceptingLeads,
        bound: !!e.telegramId,
        online: online.has(e.id),
        lastSeenAt: e.lastSeenAt,
        total,
        byStatus,
        conversion: total ? Math.round((byStatus.success / total) * 100) : 0,
        avgResponseSeconds: response.avg,
        openNow,
        lateNew,
      };
    }),
  );
  return rows.sort((a, b) => b.total - a.total);
}

export function leadsCsv(leads: WithId<Lead>[], employeeNames: Map<string, string>): string {
  const head = ['#', 'Sana', 'Guruh', 'Ism', 'Telefon', 'Status', 'Xodim', 'Eslatma', 'Javob vaqti (daq)', 'Izoh', "Qo'shimcha"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmt = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '');
  const rows = leads.map((l) =>
    [
      l.seq,
      fmt(l.createdAt),
      l.groupTitle,
      l.name,
      l.phone,
      l.status,
      l.assignedEmployeeId ? employeeNames.get(l.assignedEmployeeId) ?? '' : '',
      fmt(l.postponedUntil),
      l.responseSeconds != null ? Math.round(l.responseSeconds / 60) : '',
      l.lastNote,
      l.fields.map((f) => `${f.key}: ${f.value}`).join(' | '),
    ]
      .map(cell)
      .join(','),
  );
  return '﻿' + [head.join(','), ...rows].join('\n');
}
