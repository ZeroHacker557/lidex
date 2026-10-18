import { COL, db, type Admin, type Employee, type Lead, type MessageType, type StaffMessage, type WithId } from '../db/index.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { logEvent, type Actor } from './events.js';
import { notifyStaffMessage } from './notify.js';
import { emitToAdmins, emitToEmployee } from './realtime.js';

export async function sendStaffMessage(
  admin: WithId<Admin>,
  input: { employeeId: string; text: string; type: MessageType; leadId?: string | null },
): Promise<WithId<StaffMessage>> {
  const text = input.text.trim().slice(0, 2000);
  if (!text) throw badRequest("Xabar matni bo'sh");
  const emp = await db().get<Employee>(COL.employees, input.employeeId);
  if (!emp) throw notFound('Xodim topilmadi');
  if (admin.role !== 'superadmin' && !emp.groupIds.some((g) => admin.groupIds.includes(g))) throw forbidden();

  let lead: WithId<Lead> | null = null;
  if (input.leadId) {
    lead = await db().get<Lead>(COL.leads, input.leadId);
    if (!lead) throw notFound('Lid topilmadi');
  }

  const message: StaffMessage = {
    adminId: admin.id,
    adminName: admin.fullName,
    employeeId: emp.id,
    leadId: lead?.id ?? null,
    leadSeq: lead?.seq ?? null,
    leadName: lead?.name ?? null,
    type: input.type,
    text,
    createdAt: new Date(),
    deliveredAt: null,
    readAt: null,
    ackAt: null,
    replyText: null,
  };
  const id = await db().create(COL.messages, message);
  const saved: WithId<StaffMessage> = { ...message, id };

  const delivered = await notifyStaffMessage(emp, saved);
  if (delivered) {
    saved.deliveredAt = new Date();
    await db().update(COL.messages, id, { deliveredAt: saved.deliveredAt });
  }
  if (lead) {
    const actor: Actor = { type: 'admin', id: admin.id, name: admin.fullName };
    await logEvent(lead, actor, 'admin_message', { text, meta: { messageId: id, type: input.type } });
  }
  emitToEmployee(emp.id, 'message:new', saved);
  emitToAdmins(lead?.groupId ?? emp.groupIds[0] ?? null, 'message:updated', saved);
  return saved;
}

export async function markMessageRead(employeeId: string, messageId: string, ack?: { replyText?: string | null }) {
  const m = await db().get<StaffMessage>(COL.messages, messageId);
  if (!m || m.employeeId !== employeeId) throw notFound('Xabar topilmadi');
  const now = new Date();
  const patch: Partial<StaffMessage> = {};
  if (!m.readAt) patch.readAt = now;
  if (ack && !m.ackAt) {
    patch.ackAt = now;
    patch.replyText = ack.replyText?.trim().slice(0, 1000) || null;
  }
  if (!Object.keys(patch).length) return m;
  await db().update(COL.messages, messageId, patch);
  const updated = { ...m, ...patch };
  emitToEmployee(employeeId, 'message:updated', updated);
  const emp = await db().get<Employee>(COL.employees, employeeId);
  emitToAdmins(emp?.groupIds[0] ?? null, 'message:updated', updated);
  return updated;
}
