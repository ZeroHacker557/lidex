import clsx from 'clsx';
import { Bell, Inbox, List, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSummary } from '../hooks';
import { haptic } from '../telegram';

export function BottomNav() {
  const { data } = useSummary();
  const items = [
    { to: '/', label: 'Lidlar', icon: List, badge: data?.byStatus.new ?? 0, end: true },
    { to: '/reminders', label: 'Eslatmalar', icon: Bell, badge: data?.dueToday ?? 0 },
    { to: '/messages', label: 'Xabarlar', icon: Inbox, badge: data?.unreadMessages ?? 0 },
    { to: '/profile', label: 'Profil', icon: UserRound, badge: 0 },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-xl">
        {items.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => haptic.select()}
            className={({ isActive }) =>
              clsx('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted')
            }
          >
            <span className="relative">
              <Icon className="h-6 w-6" strokeWidth={2} />
              {badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
