import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Button, errorText } from '../../shared/ui';
import { api } from '../api';

export function LoginPage({ onLogin }: { onLogin: () => void | Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/login', { username, password });
      await onLogin();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7 shadow-pop">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Lidex</h1>
            <p className="text-[13px] text-muted">Boshqaruv paneli</p>
          </div>
        </div>
        <label className="label" htmlFor="u">
          Login
        </label>
        <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        <label className="label mt-4" htmlFor="p">
          Parol
        </label>
        <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} disabled={!username || !password}>
          <LockKeyhole className="h-4 w-4" /> Kirish
        </Button>
        <p className="mt-5 text-center text-[12px] text-muted">Faqat katta xodimlar uchun. Login va parolni superadmin beradi.</p>
      </form>
    </div>
  );
}
