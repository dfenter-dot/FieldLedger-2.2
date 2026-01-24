import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { CompanySettings } from '../../providers/data/types';

type Tier = { min: number; max: number; markup_percent: number };
type Wage = { name: string; wage: number };

function n(v: any, fallback = 0) {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function avgWage(wages: Wage[]) {
  const w = wages.map((x) => n(x.wage, NaN)).filter((x) => Number.isFinite(x) && x > 0);
  if (w.length === 0) return 0;
  return w.reduce((a, b) => a + b, 0) / w.length;
}

export function CompanySetupPage() {
  const data = useData();
  const [s, setS] = useState<CompanySettings | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data
      .getCompanySettings()
      .then(setS)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  const tiers = useMemo<Tier[]>(
    () => (Array.isArray(s?.material_markup_tiers) ? (s!.material_markup_tiers as any) : []),
    [s]
  );

  const wages = useMemo<Wage[]>(
    () => (Array.isArray(s?.technician_wages) ? (s!.technician_wages as any) : []),
    [s]
  );

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

  function setNum<K extends keyof CompanySettings>(key: K, value: string) {
    if (!s) return;
    setS({ ...s, [key]: value.trim() === '' ? (0 as any) : (Number(value) as any) });
  }

  if (!s) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card title="Company Setup" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="muted small">
          Defaults and pricing knobs used across Materials / Assemblies / Estimates. Technician wage average drives labor COGS.
        </div>
      </Card>

      <Card title="Defaults">
        <div className="grid2">
          <div className="stack">
            <label className="label">Workdays / Week</label>
            <Input type="text" inputMode="numeric" value={String(s.workdays_per_week ?? '')} onChange={(e) => setNum('workdays_per_week', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Work Hours / Day</label>
            <Input type="text" inputMode="numeric" value={String(s.work_hours_per_day ?? '')} onChange={(e) => setNum('work_hours_per_day', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Technicians</label>
            <Input type="text" inputMode="numeric" value={String(s.technicians ?? '')} onChange={(e) => setNum('technicians', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Vacation Days / Year</label>
            <Input type="text" inputMode="numeric" value={String(s.vacation_days_per_year ?? '')} onChange={(e) => setNum('vacation_days_per_year', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Sick/Personal Days / Year</label>
            <Input type="text" inputMode="numeric" value={String(s.sick_days_per_year ?? '')} onChange={(e) => setNum('sick_days_per_year', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Estimate Validity Days</label>
            <Input type="text" inputMode="numeric" value={String(s.estimate_validity_days ?? '')} onChange={(e) => setNum('estimate_validity_days', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Starting Estimate Number</label>
            <Input type="text" inputMode="numeric" value={String(s.starting_estimate_number ?? '')} onChange={(e) => setNum('starting_estimate_number', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Min Billable Labor Minutes / Job</label>
            <Input type="text" inputMode="numeric" value={String(s.min_billable_labor_minutes_per_job ?? '')} onChange={(e) => setNum('min_billable_labor_minutes_per_job', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Materials">
        <div className="grid2">
          <div className="stack">
            <label className="label">Material Purchase Tax %</label>
            <Input type="text" inputMode="decimal" value={String(s.material_purchase_tax_percent ?? '')} onChange={(e) => setNum('material_purchase_tax_percent', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Misc Material %</label>
            <Input type="text" inputMode="decimal" value={String(s.misc_material_percent ?? '')} onChange={(e) => setNum('misc_material_percent', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Misc Applies When Customer Supplies Materials</label>
            <Toggle checked={Boolean(s.misc_applies_when_customer_supplies)} onChange={(v) => setS({ ...s, misc_applies_when_customer_supplies: v })} label={s.misc_applies_when_customer_supplies ? 'Yes' : 'No'} />
          </div>
        </div>

        <div className="mt stack">
          <div className="rowBetween">
            <strong>Material Markup Tiers</strong>
            <Button onClick={() => setS({ ...s, material_markup_tiers: [...tiers, { min: 0, max: 0, markup_percent: 0 }] })}>Add Tier</Button>
          </div>
          <div className="muted small">Markup applies after purchase tax. Tier match uses cost-with-tax per-unit.</div>

          <div className="stack">
            {tiers.map((t, idx) => (
              <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted small">Min</span>
                <Input
                  style={{ width: 90 }}
                  type="text"
                  inputMode="decimal"
                  value={String(t.min)}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...t, min: n(e.target.value, 0) };
                    setS({ ...s, material_markup_tiers: next });
                  }}
                />
                <span className="muted small">Max</span>
                <Input
                  style={{ width: 90 }}
                  type="text"
                  inputMode="decimal"
                  value={String(t.max)}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...t, max: n(e.target.value, 0) };
                    setS({ ...s, material_markup_tiers: next });
                  }}
                />
                <span className="muted small">Markup %</span>
                <Input
                  style={{ width: 90 }}
                  type="text"
                  inputMode="decimal"
                  value={String(t.markup_percent)}
                  onChange={(e) => {
                    const next = [...tiers];
                    next[idx] = { ...t, markup_percent: n(e.target.value, 0) };
                    setS({ ...s, material_markup_tiers: next });
                  }}
                />
                <Button onClick={() => {
                  const next = [...tiers];
                  next.splice(idx, 1);
                  setS({ ...s, material_markup_tiers: next });
                }}>Remove</Button>
              </div>
            ))}
            {tiers.length === 0 ? <div className="muted">No tiers set.</div> : null}
          </div>
        </div>
      </Card>

      <Card title="Discounts & Fees">
        <div className="grid2">
          <div className="stack">
            <label className="label">Default Discount %</label>
            <Input type="text" inputMode="decimal" value={String(s.default_discount_percent ?? '')} onChange={(e) => setNum('default_discount_percent', e.target.value)} />
          </div>
          <div className="stack">
            <label className="label">Processing Fee %</label>
            <Input type="text" inputMode="decimal" value={String(s.processing_fee_percent ?? '')} onChange={(e) => setNum('processing_fee_percent', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Technician Wages">
        <div className="muted small">Average wage used for labor COGS calculations: <strong>${avgWage(wages).toFixed(2)}/hr</strong></div>
        <div className="mt stack">
          {wages.map((w, idx) => (
            <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Input
                style={{ minWidth: 180 }}
                value={w.name}
                onChange={(e) => {
                  const next = [...wages];
                  next[idx] = { ...w, name: e.target.value };
                  setS({ ...s, technician_wages: next });
                }}
                placeholder="Technician name"
              />
              <Input
                style={{ width: 140 }}
                type="text"
                inputMode="decimal"
                value={String(w.wage)}
                onChange={(e) => {
                  const next = [...wages];
                  next[idx] = { ...w, wage: n(e.target.value, 0) };
                  setS({ ...s, technician_wages: next });
                }}
                placeholder="$ / hr"
              />
              <Button onClick={() => {
                const next = [...wages];
                next.splice(idx, 1);
                setS({ ...s, technician_wages: next });
              }}>Remove</Button>
            </div>
          ))}
          <Button onClick={() => setS({ ...s, technician_wages: [...wages, { name: `Tech ${wages.length + 1}`, wage: 0 }] })}>Add Technician</Button>
        </div>
      </Card>

      <Card title="Estimate Footer Blocks">
        <div className="grid2">
          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">License / Credentials Block</label>
            <textarea
              className="input"
              rows={4}
              value={s.company_license_text ?? ''}
              onChange={(e) => setS({ ...s, company_license_text: e.target.value || null })}
              placeholder="Example: Licensed & insured. License #..."
            />
          </div>
          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Warranty / Terms Block</label>
            <textarea
              className="input"
              rows={4}
              value={s.company_warranty_text ?? ''}
              onChange={(e) => setS({ ...s, company_warranty_text: e.target.value || null })}
              placeholder="Example: 1-year workmanship warranty..."
            />
          </div>
        </div>
      </Card>

      {status ? <div className="muted small mt">{status}</div> : null}
    </div>
  );
}

