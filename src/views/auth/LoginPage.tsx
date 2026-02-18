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
      <h1 style={{ marginBottom: 12 }}>FieldLedger</h1>
      <p style={{ marginTop: 0, opacity: 0.8, marginBottom: 16 }}>
        {mode === 'signin'
          ? 'Sign in to continue.'
          : 'Request access by creating a login (you will be able to use the app once approved).'}
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
            {busy ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Request Access'}
          </Button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                lineHeight: 1,
              }}
            >
              {mode === 'signin' ? 'Request access' : 'Back to sign in'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}



