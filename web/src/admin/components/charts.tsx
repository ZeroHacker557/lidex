import { useState } from 'react';
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from '@shared/statuses';
import { shortDay } from '../../shared/format';

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
  const H = 200;
  const padL = 32;
  const padB = 24;
  const max = niceMax(Math.max(1, ...data.map((d) => d.total)));
  const ticks = [0, max / 2, max];
  const slot = 100 / Math.max(1, data.length);
  const y = (v: number) => (v / max) * (H - padB - 8);
  const h = hover !== null ? data[hover] : null;
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 10 ? 2 : 1;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SUCCESS }} /> HA dedi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-muted/30" /> Boshqa statuslar
        </span>
      </div>
      <div className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {/* Y o'qi va to'r chiziqlari */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: padB + y(t) }}>
            <span className="w-[28px] pr-1 text-right text-[11px] tabular-nums text-muted">{t}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        <div className="absolute bottom-0 right-0 top-0" style={{ left: padL }}>
          {data.map((d, i) => {
            const other = d.total - d.success;
            return (
              <div
                key={d.date}
                className="absolute bottom-0 top-0 flex cursor-default flex-col items-center"
                style={{ left: `${i * slot}%`, width: `${slot}%` }}
                onMouseEnter={() => setHover(i)}
              >
                {hover === i && <div className="absolute inset-x-0.5 bottom-[24px] top-0 rounded-md bg-surface-2" />}
                <div className="absolute flex w-full flex-col items-center" style={{ bottom: padB }}>
                  <div className="flex w-[60%] max-w-[24px] flex-col gap-[2px]">
                    {other > 0 && <div className="rounded-t bg-muted/30" style={{ height: y(other) - (d.success ? 2 : 0) }} />}
                    {d.success > 0 && (
                      <div className={other > 0 ? '' : 'rounded-t'} style={{ height: y(d.success), backgroundColor: SUCCESS }} />
                    )}
                  </div>
                </div>
                {i % labelEvery === 0 && (
                  <span className="absolute bottom-0 whitespace-nowrap text-[11px] text-muted">{shortDay(d.date)}</span>
                )}
              </div>
            );
          })}
        </div>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-line bg-surface p-3 text-[12px] shadow-pop"
            style={{
              left: `calc(${padL}px + ${Math.min((hover + 0.5) * slot, 78)}% - ${hover * slot > 50 ? 180 : -12}px)`,
            }}
          >
            <p className="mb-1.5 font-semibold">{shortDay(h.date)}</p>
            <Row label="Jami lid" value={h.total} />
            <Row label="HA dedi" value={h.success} color={SUCCESS} />
            <Row label="YO'Q dedi" value={h.rejected} color={STATUS_META.rejected.color} />
            <Row label="Bekor" value={h.cancelled} color={STATUS_META.cancelled.color} />
            <Row label="Ochiq / jarayonda" value={h.total - h.success - h.rejected - h.cancelled} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-fg">{value}</span>
    </div>
  );
}

/** Status taqsimoti: har bir qator yorliq + son + foiz bilan (rang yolg'iz emas) */
export function StatusBreakdown({ byStatus, onPick }: { byStatus: Record<LeadStatus, number>; onPick?: (s: LeadStatus) => void }) {
  const total = LEAD_STATUSES.reduce((a, s) => a + byStatus[s], 0);
  const max = Math.max(1, ...LEAD_STATUSES.map((s) => byStatus[s]));
  return (
    <ul className="space-y-3">
      {LEAD_STATUSES.map((s) => {
        const m = STATUS_META[s];
        const v = byStatus[s];
        return (
          <li key={s}>
            <button className="block w-full text-left" onClick={() => onPick?.(s)} disabled={!onPick}>
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
                <span className="tabular-nums">
                  <b>{v}</b> <span className="text-muted">· {total ? Math.round((v / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: m.color }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
