import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

export function connectSocket(auth: { kind: 'admin' | 'employee'; token?: string | null }): Socket {
  // Serverless (Vercel) da Socket.IO yo'q — bir necha urinishdan keyin to'xtaydi va so'rovlar bilan yangilanish yoqiladi
  return io({ path: '/socket.io', auth, transports: ['websocket', 'polling'], reconnectionAttempts: 3, reconnectionDelayMax: 10_000 });
}

/** Socket ulanishi va hodisalarga obuna. Ulanmasa — ma'lumotlar har 15 soniyada avtomatik yangilanadi */
export function useSocket(
  auth: { kind: 'admin' | 'employee'; token?: string | null } | null,
  handlers: Record<string, (payload: never) => void>,
) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const ref = useRef(handlers);
  ref.current = handlers;
  const key = auth ? `${auth.kind}:${auth.token ?? ''}` : '';

  useEffect(() => {
    if (!auth) return;
    const s = connectSocket(auth);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.onAny((event: string, payload: unknown) => {
      const h = ref.current[event];
      if (h) h(payload as never);
    });
    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const current = qc.getDefaultOptions();
    qc.setDefaultOptions({ ...current, queries: { ...current.queries, refetchInterval: connected ? false : 15_000 } });
  }, [connected, qc]);

  return connected;
}
