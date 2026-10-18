import type { EventType, LeadStatus } from '../../../shared/statuses.js';
import { COL, db, type Lead, type LeadEvent, type WithId } from '../db/index.js';
import { logger } from '../logger.js';
import { emitToAdmins } from './realtime.js';

export interface Actor {
  type: 'employee' | 'admin' | 'system';
  id: string | null;
  name: string;
}

export const SYSTEM: Actor = { type: 'system', id: null, name: 'Tizim' };

// Ketma-ket yozilgan hodisalar bir xil millisekundga tushsa ham tarix tartibi saqlanishi uchun
let lastEventMs = 0;
function monotonicNow(): Date {
  const now = Math.max(Date.now(), lastEventMs + 1);
  lastEventMs = now;
  return new Date(now);
}

export async function logEvent(
  lead: Pick<WithId<Lead>, 'id' | 'seq' | 'groupId' | 'assignedEmployeeId'>,
  actor: Actor,
  type: EventType,
  extra: { fromStatus?: LeadStatus | null; toStatus?: LeadStatus | null; text?: string | null; meta?: Record<string, unknown> | null } = {},
): Promise<WithId<LeadEvent>> {
  const event: LeadEvent = {
    leadId: lead.id,
    leadSeq: lead.seq,
    groupId: lead.groupId,
    employeeId: lead.assignedEmployeeId,
    actorType: actor.type,
    actorId: actor.id,
    actorName: actor.name,
    type,
    fromStatus: extra.fromStatus ?? null,
    toStatus: extra.toStatus ?? null,
    text: extra.text ?? null,
    meta: extra.meta ?? null,
    createdAt: monotonicNow(),
  };
  try {
    const id = await db().create(COL.events, event);
    const saved = { ...event, id };
    emitToAdmins(lead.groupId, 'activity', saved);
    return saved;
  } catch (err) {
    logger.error({ err, type, leadId: lead.id }, 'Event yozishda xato');
    return { ...event, id: '' };
  }
}
