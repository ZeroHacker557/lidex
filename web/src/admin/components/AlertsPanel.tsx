import { Link } from 'react-router-dom';
import { smartDate, timeAgo } from '../../shared/format';
import type { Lead } from '../../shared/types';
import { Empty, Spinner, StatusBadge } from '../../shared/ui';
import { useOpenLead } from './common';

export interface Alerts {
  escalated: Lead[];
  unassigned: Lead[];
  overdue: Lead[];
  flagged: Lead[];
  pendingGroups: Array<{ id: string; title: string; chatId: number | null; createdAt: string }>;
  employeeIssues: Array<{ id: string; fullName: string; issue: 'not_bound' | 'bot_blocked' }>;
}

export function AlertsPanel({ data, onNavigate }: { data?: Alerts; onNavigate?: () => void }) {
  const openLead = useOpenLead();
  if (!data)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  const total =
    data.escalated.length + data.unassigned.length + data.overdue.length + data.pendingGroups.length + data.employeeIssues.length;
  if (!total) return <Empty title="Hammasi joyida ✅" text="Kechikayotgan yoki e'tibor talab qiladigan narsa yo'q" />;

  const LeadRow = ({ lead, meta }: { lead: Lead; meta: string }) => (
    <button
      onClick={() => {
        openLead(lead.id);
        onNavigate?.();
      }}
      className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">
          #{lead.seq} {lead.name ?? lead.phone}
        </p>
        <p className="truncate text-[12px] text-muted">
          {lead.groupTitle} · {meta}
        </p>
      </div>
      <StatusBadge status={lead.status} size="sm" short />
    </button>
  );

  return (
    <div className="divide-y divide-line">
      {data.pendingGroups.length > 0 && (
        <Section title="Tasdiqlash kutayotgan guruhlar" count={data.pendingGroups.length}>
          {data.pendingGroups.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} onClick={onNavigate} className="block px-5 py-2.5 hover:bg-surface-2">
              <p className="text-[14px] font-medium">{g.title}</p>
              <p className="text-[12px] text-muted">Bot qo'shildi {timeAgo(g.createdAt)} — faollashtiring</p>
            </Link>
          ))}
        </Section>
      )}
      {data.escalated.length > 0 && (
        <Section title="🚨 Uzoq vaqt javobsiz" count={data.escalated.length}>
          {data.escalated.map((l) => (
            <LeadRow key={l.id} lead={l} meta={`${timeAgo(l.createdAt)} tushgan`} />
          ))}
        </Section>
      )}
      {data.unassigned.length > 0 && (
        <Section title="Biriktirilmagan lidlar" count={data.unassigned.length}>
          {data.unassigned.map((l) => (
            <LeadRow key={l.id} lead={l} meta={timeAgo(l.createdAt)} />
          ))}
        </Section>
      )}
      {data.overdue.length > 0 && (
        <Section title="Eslatma sanasi o'tgan" count={data.overdue.length}>
          {data.overdue.map((l) => (
            <LeadRow key={l.id} lead={l} meta={`muddat: ${smartDate(l.postponedUntil)}`} />
          ))}
        </Section>
      )}
      {data.employeeIssues.length > 0 && (
        <Section title="Xodimlar bilan muammo" count={data.employeeIssues.length}>
          {data.employeeIssues.map((e) => (
            <Link key={e.id} to={`/employees/${e.id}`} onClick={onNavigate} className="block px-5 py-2.5 hover:bg-surface-2">
              <p className="text-[14px] font-medium">{e.fullName}</p>
              <p className="text-[12px] text-muted">{e.issue === 'not_bound' ? 'Hali botga kalit bilan kirmagan' : 'Botni bloklagan — xabarlar yetib bormaydi'}</p>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="py-2">
      <h4 className="flex items-center gap-2 px-5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
        {title} <span className="rounded-full bg-surface-2 px-1.5">{count}</span>
      </h4>
      {children}
    </section>
  );
}
