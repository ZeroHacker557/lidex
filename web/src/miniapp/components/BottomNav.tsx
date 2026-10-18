import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CircleUser, House, Inbox } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { spring } from '../../shared/motion';
import { useSummary } from '../hooks';
import { haptic } from '../telegram';

export function BottomNav() {
  const { data } = useSummary();
  const { pathname } = useLocation();
  const items = [
    { to: '/', label: 'Lidlar', icon: House, badge: data?.byStatus.new ?? 0 },
    { to: '/reminders', label: 'Eslatmalar', icon: Bell, badge: data?.dueToday ?? 0 },
    { to: '/messages', label: 'Xabarlar', icon: Inbox, badge: data?.unreadMessages ?? 0 },
    { to: '/profile', label: 'Profil', icon: CircleUser, badge: 0 },
  ];
  return (
    <motion.nav
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 90, opacity: 0 }}
      transition={spring}
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-safe"
    >
      <div className="mx-auto mb-3 flex max-w-md items-center gap-1 rounded-[22px] border border-line/70 bg-surface/85 p-1.5 shadow-lift backdrop-blur-xl">
        {items.map(({ to, label, icon: Icon, badge }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => haptic.select()}
              className={clsx(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10.5px] font-semibold transition-colors',
                active ? 'text-brand' : 'text-muted',
              )}
            >
              {active && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-2xl bg-brand/10" />}
              <span className="relative">
                <motion.span animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }} transition={spring} className="block">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </motion.span>
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.span
                      key={badge}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={spring}
                      className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white shadow-[0_0_0_2px_var(--c-surface)]"
                    >
                      {badge > 99 ? '99+' : badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="relative">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </motion.nav>
  );
}
