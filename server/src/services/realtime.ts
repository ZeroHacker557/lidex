import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export const rooms = {
  employee: (id: string) => `emp:${id}`,
  /** Superadminlar — barcha guruhlar */
  allAdmins: 'adm:all',
  adminGroup: (groupId: string) => `adm:g:${groupId}`,
};

export type RealtimeEvent =
  | 'lead:new'
  | 'lead:updated'
  | 'lead:removed'
  | 'message:new'
  | 'message:updated'
  | 'activity'
  | 'alert'
  | 'group:updated'
  | 'employee:updated';

export function emitToEmployee(employeeId: string | null | undefined, event: RealtimeEvent, payload: unknown) {
  if (!io || !employeeId) return;
  io.to(rooms.employee(employeeId)).emit(event, payload);
}

/** Superadminlarga va shu guruhga biriktirilgan adminlarga */
export function emitToAdmins(groupId: string | null | undefined, event: RealtimeEvent, payload: unknown) {
  if (!io) return;
  const target = groupId ? io.to(rooms.allAdmins).to(rooms.adminGroup(groupId)) : io.to(rooms.allAdmins);
  target.emit(event, payload);
}

export function onlineEmployeeIds(): Set<string> {
  const out = new Set<string>();
  if (!io) return out;
  for (const room of io.sockets.adapter.rooms.keys()) if (room.startsWith('emp:')) out.add(room.slice(4));
  return out;
}
