import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { BrandingSettings } from '../../providers/data/types';

export function BrandingPage() {
  const data = useData();
  const [s, setS] = useState<BrandingSettings>({});

  useEffect(() => {
    data.getBrandingSettings().then(setS).catch(console.error);
  }, [data]);

  return (
    <div className="stack">
      <Card title="Branding & PDF Details" right={<Button variant="primary" onClick={() => data.saveBrandingSettings(s)}>Save</Button>}>
        <div className="grid2">
          <div className="stack">
            <label className="label">Company Name</label>
            <Input value={s.companyName ?? ''} onChange={(e) => setS({ ...s, companyName: e.target.value })} />
          </div>
          <div className="stack">
            <label className="label">Logo Upload</label>
            <div className="muted">Upload wiring will use Supabase Storage later. Logo appears on Estimate PDF.</div>
          </div>
          <div className="stack">
            <label className="label">License Information</label>
            <Input value={s.licenseInfo ?? ''} onChange={(e) => setS({ ...s, licenseInfo: e.target.value })} />
          </div>
          <div className="stack">
            <label className="label">Warranty / Terms (short)</label>
            <Input value={s.warrantyInfo ?? ''} onChange={(e) => setS({ ...s, warrantyInfo: e.target.value })} />
          </div>
        </div>
        <div className="muted small mt">
          Later we can support multi-page terms/warranty PDFs.
        </div>
      </Card>
    </div>
  );
}
