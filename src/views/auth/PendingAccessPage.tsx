import { useState } from 'react';

import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { useAuth } from '../../providers/auth/AuthContext';

export function PendingAccessPage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function doSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Access Requested</h1>
      <p style={{ marginTop: 0, opacity: 0.85, marginBottom: 16 }}>
        Your login was created, but this account has not been assigned to a company yet.
      </p>

      <Card>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Signed in as <strong>{user?.email ?? ''}</strong>
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.35 }}>
            Once you are approved, you can sign in and start using FieldLedger.
          </div>
          <Button onClick={doSignOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Back to Login'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

