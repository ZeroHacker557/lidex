import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;

/** Sahifa paydo bo'lishi: yumshoq yuqoriga siljish + shaffoflik */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.32, ease }}
    >
      {children}
    </motion.div>
  );
}

export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease } },
};

/** Ro'yxat — elementlar ketma-ket paydo bo'ladi */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const C = motion[as];
  return (
    <C className={className} variants={listVariants} initial="hidden" animate="show">
      {children}
    </C>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const C = motion[as];
  return (
    <C className={className} variants={itemVariants} layout="position">
      {children}
    </C>
  );
}

/** Raqam o'zgarganda silliq sanab chiqadi */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ') }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease });
    return () => controls.stop();
  }, [value, mv, reduce]);
  return <motion.span className="tabular">{text}</motion.span>;
}

/** Muvaffaqiyat belgisi: chiziladigan ✓ */
export function CheckDraw({ size = 56, color = '#16a34a' }: { size?: number; color?: string }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 52 52" initial="hidden" animate="show">
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke={color}
        strokeWidth="3"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.45, ease } } }}
      />
      <motion.path
        d="M15 27 l7 7 l15 -16"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.3, duration: 0.35, ease } } }}
      />
    </motion.svg>
  );
}
