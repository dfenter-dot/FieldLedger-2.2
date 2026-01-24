import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { CompanySettings } from '../../providers/data/types';

export function CompanySetupPage() {
  const data = useData();
  const [s, setS] = useState<CompanySettings | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.getCompanySettings()
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
      const saved = await data.saveCompanySettings(s);
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
      <Card title="Company Setup" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="grid2">
          <div className="stack">
            <label className="label">Technician Average Wage ($/hr)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={s.technician_hourly_rate_avg == null ? '' : String(s.technician_hourly_rate_avg)}
              onChange={(e) => setS({ ...s, technician_hourly_rate_avg: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Estimate Validity (Days)</label>
            <Input
              type="text"
              inputMode="numeric"
              value={s.estimate_validity_days == null ? '' : String(s.estimate_validity_days)}
              onChange={(e) => setS({ ...s, estimate_validity_days: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Starting Estimate Number</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(s.starting_estimate_number ?? '')}
              onChange={(e) => setS({ ...s, starting_estimate_number: e.target.value === '' ? 0 : Number(e.target.value) })}
              placeholder="e.g. 1000"
            />
          </div>

          <div className="stack">
            <label className="label">Minimum Labor Minutes</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(s.min_labor_minutes ?? '')}
              onChange={(e) => setS({ ...s, min_labor_minutes: e.target.value === '' ? 0 : Number(e.target.value) })}
              placeholder="e.g. 15"
            />
          </div>
          <div className="stack">
            <label className="label">Material Purchase Tax (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={s.material_tax_percent == null ? '' : String(s.material_tax_percent)}
              onChange={(e) => setS({ ...s, material_tax_percent: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Material Miscellaneous (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={s.material_misc_percent == null ? '' : String(s.material_misc_percent)}
              onChange={(e) => setS({ ...s, material_misc_percent: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Processing Fee (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={s.processing_fee_percent == null ? '' : String(s.processing_fee_percent)}
              onChange={(e) => setS({ ...s, processing_fee_percent: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Default Discount (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={s.default_discount_percent == null ? '' : String(s.default_discount_percent)}
              onChange={(e) => setS({ ...s, default_discount_percent: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}

        <div className="muted small mt">
          Company settings are company-scoped under RLS. This page loads and saves the existing company_settings row.
        </div>
      </Card>
    </div>
  );
}

