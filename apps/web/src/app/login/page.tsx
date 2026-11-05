'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.send('/api/auth/login', 'POST', { password });
      location.href = '/';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/static/assets/sun.svg" alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="brand-name">SIES College of Management Studies</span>
            <span className="brand-sub">Certificate Studio</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <label className="field">
          Password
          <input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <div className="alert">{error}</div> : null}
        <button className="btn btn-primary" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
