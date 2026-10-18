import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { shortDay } from '../../shared/format';
import { ease } from '../../shared/motion';
import { STATUS_ICON } from '../../shared/statusIcons';

export interface DailyPoint {
  date: string;
  total: number;
  success: number;
  rejected: number;
  cancelled: number;
}

const SUCCESS = STATUS_META.success.color;

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Kunlik lidlar: ustun = jami lid; pastki qismi — "HA dedi" (yashil), qolgani — neytral.
 * Ikki seriya yorug'lik bo'yicha farqlanadi (rang ko'rlikda ham o'qiladi); tafsilot — tooltipda.
 */
export function DailyChart({ data }: { data: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 240;
  const padL = 34;
  const padB = 26;
  const plot = H - padB - 10;
  const max = niceMax(Math.max(1, ...data.map((d) => d.total)));
  const ticks = [0, max / 2, max];
  const slot = 100 / Math.max(1, data.length);
  const y = (v: number) => (v / max) * plot;
  const h = hover !== null ? data[hover] : null;
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 10 ? 2 : 1;
  const totalAll = data.reduce((a, d) => a + d.total, 0);
  const successAll = data.reduce((a, d) => a + d.success, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[12.5px] font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: SUCCESS }} /> HA dedi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-brand/30" /> Boshqa statuslar
          </span>
        </div>
        <p className="text-[12.5px] text-muted">
          Jami <b className="tabular text-fg">{totalAll}</b> · HA <b className="tabular text-fg">{successAll}</b>
        </p>
      </div>
      <div className="relative select-none" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: padB + y(t) - 6 }}>
            <span className="tabular w-[30px] pr-2 text-right text-[11px] text-muted">{t}</span>
            <span className="h-px flex-1 bg-line/70" />
          </div>
        ))}
        <div className="absolute bottom-0 right-0 top-0" style={{ left: padL }}>
          {data.map((d, i) => {
            const other = d.total - d.success;
            return (
              <div
                key={d.date}
                className="absolute bottom-0 top-0 flex flex-col items-center"
                style={{ left: `${i * slot}%`, width: `${slot}%` }}
                onMouseEnter={() => setHover(i)}
              >
                <AnimatePresence>
                  {hover === i && (
                    <motion.div
                      layoutId="chart-hover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-x-1 rounded-xl bg-brand/[0.06]"
                      style={{ bottom: padB, top: 0 }}
                    />
                  )}
                </AnimatePresence>
                <div className="absolute flex w-full justify-center" style={{ bottom: padB }}>
                  <div className="flex w-[58%] max-w-[28px] flex-col justify-end gap-[2px]">
                    {other > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(2, y(other) - (d.success ? 2 : 0)) }}
                        transition={{ duration: 0.7, ease, delay: 0.05 + i * 0.025 }}
                        className="rounded-t-md bg-brand/30"
                        style={{ borderBottomLeftRadius: d.success ? 0 : undefined, borderBottomRightRadius: d.success ? 0 : undefined }}
                      />
                    )}
                    {d.success > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: y(d.success) }}
                        transition={{ duration: 0.7, ease, delay: i * 0.025 }}
                        className={other > 0 ? '' : 'rounded-t-md'}
                        style={{ backgroundColor: SUCCESS }}
                      />
                    )}
                  </div>
                </div>
                {i % labelEvery === 0 && <span className="absolute bottom-0 whitespace-nowrap text-[11px] font-medium text-muted">{shortDay(d.date)}</span>}
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {h && hover !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute top-0 z-10 w-48 rounded-2xl border border-line/70 bg-surface/95 p-3.5 text-[12.5px] shadow-lift backdrop-blur"
              style={{ left: `calc(${padL}px + ${(hover + 0.5) * slot}% - ${hover * slot > 55 ? 204 : -16}px)` }}
            >
              <p className="mb-2 font-display text-[13.5px] font-bold">{shortDay(h.date)}</p>
              <Row label="Jami lid" value={h.total} strong />
              <Row label="HA dedi" value={h.success} color={SUCCESS} />
              <Row label="YO'Q dedi" value={h.rejected} color={STATUS_META.rejected.color} />
              <Row label="Bekor" value={h.cancelled} color={STATUS_META.cancelled.color} />
              <Row label="Jarayonda" value={h.total - h.success - h.rejected - h.cancelled} color={STATUS_META.new.color} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ label, value, color, strong }: { label: string; value: number; color?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className={`tabular text-fg ${strong ? 'font-extrabold' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}

/** Status taqsimoti: har bir qator ikonka + yorliq + son + foiz bilan (rang yolg'iz emas) */
export function StatusBreakdown({ byStatus, onPick }: { byStatus: Record<LeadStatus, number>; onPick?: (s: LeadStatus) => void }) {
  const total = LEAD_STATUSES.reduce((a, s) => a + byStatus[s], 0);
  const max = Math.max(1, ...LEAD_STATUSES.map((s) => byStatus[s]));
  return (
    <ul className="space-y-1">
      {LEAD_STATUSES.map((s, i) => {
        const m = STATUS_META[s];
        const Icon = STATUS_ICON[s];
        const v = byStatus[s];
        return (
          <li key={s}>
            <button className="group block w-full rounded-xl p-2 text-left transition-colors enabled:hover:bg-surface-2/70" onClick={() => onPick?.(s)} disabled={!onPick}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.color}1a`, color: m.color }}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </span>
                  {m.label}
                </span>
                <span className="tabular">
                  <b>{v}</b> <span className="text-muted">· {total ? Math.round((v / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(v / max) * 100}%` }}
                  transition={{ duration: 0.8, ease, delay: 0.1 + i * 0.05 }}
                  style={{ backgroundColor: m.color }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
