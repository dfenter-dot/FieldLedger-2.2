import React, { useState } from 'react';

import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Input } from '../../ui/components/Input';
import { useAuth } from '../../providers/auth/AuthContext';

export function LoginPage() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'signin'
          ? await signInWithPassword(email.trim(), password)
          : await signUpWithPassword(email.trim(), password);
      if (!res.ok) setError(res.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <img
          src="/branding/fieldledger-logo.png"
          alt="FieldLedger"
          style={{ height: 56, width: 'auto', display: 'block' }}
        />
      </div>
      <p style={{ marginTop: 0, opacity: 0.8, marginBottom: 16 }}>
        {mode === 'signin' ? 'Sign in to continue.' : 'Create your account to continue.'}
      </p>

      <Card>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Password</div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
            />
          </div>
          {error ? (
            <div style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.3 }}>{error}</div>
          ) : null}

          <Button onClick={submit} disabled={busy || !email.trim() || password.length < 6}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.85 }}
            >
              {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}


