import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { BrandingSettings } from '../../providers/data/types';
import { supabase } from '../../supabase/client';

async function toSignedLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  const { data, error } = await supabase.storage.from('company-logos').createSignedUrl(logoPath, 60 * 60);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export function BrandingPage() {
  const data = useData();
  const [s, setS] = useState<BrandingSettings | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const settings = await data.getBrandingSettings();
        setS(settings);
        setLogoPreview(await toSignedLogoUrl(settings.logo_url));
      } catch (e: any) {
        console.error(e);
        setStatus(String(e?.message ?? e));
      }
    })();
  }, [data]);

  async function save() {
    if (!s) return;
    try {
      setStatus('Saving...');
      const saved = await data.saveBrandingSettings(s);
      setS(saved);
      setLogoPreview(await toSignedLogoUrl(saved.logo_url));
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function uploadLogo(file: File) {
    if (!s) return;
    try {
      setStatus('Uploading logo...');
      const companyId = await data.getCurrentCompanyId();
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
      const path = `${companyId}/logo.${ext}`;

      // Replace if exists
      await supabase.storage.from('company-logos').remove([path]).catch(() => void 0);
      const { error: upErr } = await supabase.storage.from('company-logos').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (upErr) throw upErr;

      const saved = await data.saveBrandingSettings({ ...s, logo_url: path });
      setS(saved);
      setLogoPreview(await toSignedLogoUrl(saved.logo_url));
      setStatus('Uploaded.');
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
            <label className="label">Primary Color</label>
            <Input value={s.primary_color ?? ''} onChange={(e) => setS({ ...s, primary_color: e.target.value || null })} placeholder="e.g. #0ea5e9" />
          </div>

          <div className="stack">
            <label className="label">Company Logo</label>
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (f) void uploadLogo(f);
                }}
              />
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ height: 40, borderRadius: 8, border: '1px solid var(--border)' }} />
              ) : (
                <span className="muted small">No logo uploaded.</span>
              )}
            </div>
            <div className="muted small">Stored in Supabase Storage bucket <strong>company-logos</strong> (private). The app uses signed URLs for preview/PDF.</div>
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

