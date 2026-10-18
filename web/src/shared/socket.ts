import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

export function connectSocket(auth: { kind: 'admin' | 'employee'; token?: string | null }): Socket {
  return io({ path: '/socket.io', auth, transports: ['websocket', 'polling'], reconnectionDelayMax: 10_000 });
}

/** Socket ulanishi va hodisalarga obuna */
export function useSocket(
  auth: { kind: 'admin' | 'employee'; token?: string | null } | null,
  handlers: Record<string, (payload: never) => void>,
) {
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

  return connected;
}
