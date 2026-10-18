import { parse as parseCookie } from 'cookie';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { COL, db, type Admin, type Employee } from '../db/index.js';
import { verifyToken, type AdminClaims, type EmployeeClaims } from '../lib/security.js';
import { emitToAdmins, rooms, setIo } from '../services/realtime.js';
import { ADMIN_COOKIE } from './middleware.js';

export function attachSocket(server: HttpServer) {
  const io = new Server(server, { path: '/socket.io', serveClient: false, cors: { origin: false } });

  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth as { token?: string; kind?: 'admin' | 'employee' };
      if (auth.kind === 'employee' && auth.token) {
        const claims = verifyToken<EmployeeClaims>(auth.token, 'employee');
        const emp = claims ? await db().get<Employee>(COL.employees, claims.sub) : null;
        if (!emp || !emp.isActive || emp.telegramId !== claims!.tg) return next(new Error('unauthorized'));
        socket.data.employee = { id: emp.id, groupIds: emp.groupIds };
        return next();
      }
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      const token = cookies[ADMIN_COOKIE] ?? auth.token;
      const claims = token ? verifyToken<AdminClaims>(token, 'admin') : null;
      const admin = claims ? await db().get<Admin>(COL.admins, claims.sub) : null;
      if (!admin || !admin.isActive) return next(new Error('unauthorized'));
      socket.data.admin = { id: admin.id, role: admin.role, groupIds: admin.groupIds };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const emp = socket.data.employee as { id: string; groupIds: string[] } | undefined;
    const admin = socket.data.admin as { id: string; role: string; groupIds: string[] } | undefined;
    if (emp) {
      socket.join(rooms.employee(emp.id));
      emitToAdmins(emp.groupIds[0] ?? null, 'employee:updated', { id: emp.id, online: true });
      socket.on('disconnect', () => {
        db()
          .update(COL.employees, emp.id, { lastSeenAt: new Date() })
          .catch(() => undefined);
        emitToAdmins(emp.groupIds[0] ?? null, 'employee:updated', { id: emp.id, online: false });
      });
    } else if (admin) {
      if (admin.role === 'superadmin') socket.join(rooms.allAdmins);
      else for (const g of admin.groupIds) socket.join(rooms.adminGroup(g));
    }
  });

  setIo(io);
  return io;
}
