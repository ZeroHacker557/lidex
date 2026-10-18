import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import type { Employee } from '../../shared/types';
import { Button, errorText } from '../../shared/ui';
import { api } from '../session';
import { haptic } from '../telegram';

export function KeyScreen({
  initData,
  firstName,
  onSuccess,
}: {
  initData: string;
  firstName: string;
  onSuccess: (token: string, employee: Employee) => void;
}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // LX-XXXX-XXXX formatiga avtomatik keltirish
  const onChange = (v: string) => {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LX/, '').slice(0, 8);
    setKey(raw.length > 4 ? `LX-${raw.slice(0, 4)}-${raw.slice(4)}` : raw ? `LX-${raw}` : '');
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; employee: Employee }>('/auth/key', { initData, key });
      onSuccess(res.token, res.employee);
    } catch (e) {
      haptic.error();
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <KeyRound className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Salom{firstName ? `, ${firstName}` : ''}!</h1>
      <p className="mt-2 text-[15px] text-muted">
        Panelga kirish uchun rahbaringiz bergan <b className="text-fg">kirish kalitini</b> kiriting. Kalit faqat bir marta kiritiladi va
        Telegram akkauntingizga bog'lanadi.
      </p>
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.length >= 12) void submit();
        }}
      >
        <input
          autoFocus
          value={key}
          onChange={(e) => onChange(e.target.value)}
          placeholder="LX-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="input h-14 text-center font-mono text-xl tracking-[0.2em]"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="mt-4 w-full" loading={busy} disabled={key.length < 12}>
          Kirish
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">Kalitingiz yo'qmi? Rahbaringiz uni admin paneldan yaratib beradi.</p>
    </div>
  );
}
