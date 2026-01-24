import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { BrandingSettings } from '../../providers/data/types';

export function BrandingPage() {
  const data = useData();
  const [s, setS] = useState<BrandingSettings | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.getBrandingSettings()
      .then(setS)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  async function save() {
    if (!s) return;
    try {
      setStatus('Saving...');
      const saved = await data.saveBrandingSettings(s);
      setS(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  if (!s) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card title="Branding" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="grid2">
          <div className="stack">
            <label className="label">Logo URL</label>
            <Input value={s.logo_url ?? ''} onChange={(e) => setS({ ...s, logo_url: e.target.value || null })} placeholder="https://…" />
          </div>
          <div className="stack">
            <label className="label">Primary Color</label>
            <Input value={s.primary_color ?? ''} onChange={(e) => setS({ ...s, primary_color: e.target.value || null })} placeholder="e.g. #0ea5e9" />
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}

        <div className="muted small mt">
          Logo upload wiring (Supabase Storage) can be added later. These fields map directly to branding_settings columns.
        </div>
      </Card>
    </div>
  );
}

