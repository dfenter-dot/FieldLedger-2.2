import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { CompanySettings } from '../../providers/data/types';

type Tier = { min: number; max: number; markup_percent: number };
type Wage = { name: string; wage: number };

function toNum(raw: string, fallback = 0) {
  const s = (raw ?? '').trim();
  if (s === '') return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function avgWage(wages: Wage[]) {
  const w = wages.map((x) => Number(x.wage)).filter((x) => Number.isFinite(x) && x > 0);
  if (w.length === 0) return 0;
  return w.reduce((a, b) => a + b, 0) / w.length;
}

export function CompanySetupPage() {
  const data = useData();
  const [s, setS] = useState<CompanySettings | null>(null);
  const [status, setStatus] = useState<string>('');

  // CompanySettings numeric drafts (string while typing)
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Tier drafts (array aligned to tiers)
  const [tierDrafts, setTierDrafts] = useState<Array<{ min: string; max: string; markup_percent: string }>>([]);

  // Wage drafts (array aligned to wages)
  const [wageDrafts, setWageDrafts] = useState<string[]>([]);

  useEffect(() => {
    data
      .getCompanySettings()
      .then((cs) => {
        setS(cs);

        // Initialize numeric drafts from loaded settings
        setDraft((prev) => ({
          ...prev,
          workdays_per_week: cs.workdays_per_week != null ? String(cs.workdays_per_week) : '',
          work_hours_per_day: cs.work_hours_per_day != null ? String(cs.work_hours_per_day) : '',
          technicians: cs.technicians != null ? String(cs.technicians) : '',
          vacation_days_per_year: cs.vacation_days_per_year != null ? String(cs.vacation_days_per_year) : '',
          sick_days_per_year: cs.sick_days_per_year != null ? String(cs.sick_days_per_year) : '',
          estimate_validity_days: cs.estimate_validity_days != null ? String(cs.estimate_validity_days) : '',
          starting_estimate_number: cs.starting_estimate_number != null ? String(cs.starting_estimate_number) : '',
          min_billable_labor_minutes_per_job:
            cs.min_billable_labor_minutes_per_job != null ? String(cs.min_billable_labor_minutes_per_job) : '',
          material_purchase_tax_percent:
            cs.material_purchase_tax_percent != null ? String(cs.material_purchase_tax_percent) : '',
          misc_material_percent: cs.misc_material_percent != null ? String(cs.misc_material_percent) : '',
          default_discount_percent: cs.default_discount_percent != null ? String(cs.default_discount_percent) : '',
          processing_fee_percent: cs.processing_fee_percent != null ? String(cs.processing_fee_percent) : '',
        }));

        const tiers = Array.isArray(cs.material_markup_tiers) ? (cs.material_markup_tiers as any as Tier[]) : [];
        setTierDrafts(
          tiers.map((t) => ({
            min: t.min != null ? String(t.min) : '',
            max: t.max != null ? String(t.max) : '',
            markup_percent: t.markup_percent != null ? String(t.markup_percent) : '',
          }))
        );

        const wages = Array.isArray(cs.technician_wages) ? (cs.technician_wages as any as Wage[]) : [];
        setWageDrafts(wages.map((w) => (w.wage != null ? String(w.wage) : '')));
      })
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

  function onDraftChange(key: keyof CompanySettings, value: string) {
    setDraft((d) => ({ ...d, [key as string]: value }));
  }

  function commitNum<K extends keyof CompanySettings>(key: K, fallback = 0) {
    if (!s) return;
    const raw = (draft[key as string] ?? '').trim();
    const num = toNum(raw, fallback);
    setS({ ...s, [key]: num as any });
    // keep draft as typed, but normalize if it's a clean number
    setDraft((d) => ({ ...d, [key as string]: raw === '' ? '' : String(num) }));
  }

  function ensureWagesRowCount(targetCount: number) {
    if (!s) return;
    const cur = Array.isArray(s.technician_wages) ? (s.technician_wages as any as Wage[]) : [];
    const next = [...cur];

    while (next.length < targetCount) next.push({ name: `Tech ${next.length + 1}`, wage: 0 });
    if (next.length > targetCount) next.length = targetCount;

    setS({ ...s, technician_wages: next as any });

    // keep wageDrafts aligned
    setWageDrafts((prev) => {
      const out = [...prev];
      while (out.length < targetCount) out.push('');
      if (out.length > targetCount) out.length = targetCount;
      return out;
    });
  }

  function commitAllDraftsIntoSettings(): CompanySettings {
    if (!s) throw new Error('No company settings loaded');

    // Start from existing settings, then override numeric keys from drafts
    const next: CompanySettings = { ...s };

    // Commit the known numeric fields
    const numericKeys: Array<keyof CompanySettings> = [
      'workdays_per_week',
      'work_hours_per_day',
      'technicians',
      'vacation_days_per_year',
      'sick_days_per_year',
      'estimate_validity_days',
      'starting_estimate_number',
      'min_billable_labor_minutes_per_job',
      'material_purchase_tax_percent',
      'misc_material_percent',
      'default_discount_percent',
      'processing_fee_percent',
    ];

    for (const k of numericKeys) {
      const raw = (draft[k as string] ?? '').trim();
      // integers vs decimals: we keep decimals where it makes sense. For count fields, floor.
      if (k === 'technicians' || k === 'workdays_per_week' || k === 'vacation_days_per_year' || k === 'sick_days_per_year' || k === 'estimate_validity_days' || k === 'starting_estimate_number' || k === 'min_billable_labor_minutes_per_job') {
        const val = raw === '' ? 0 : Math.max(0, Math.floor(toNum(raw, 0)));
        (next as any)[k] = val;
        setDraft((d) => ({ ...d, [k as string]: raw === '' ? '' : String(val) }));
      } else {
        const val = toNum(raw, 0);
        (next as any)[k] = val;
        setDraft((d) => ({ ...d, [k as string]: raw === '' ? '' : String(val) }));
      }
    }

    // Commit tier drafts
    const nextTiers: Tier[] = tiers.map((t, idx) => {
      const d = tierDrafts[idx] ?? { min: String(t.min ?? 0), max: String(t.max ?? 0), markup_percent: String(t.markup_percent ?? 0) };
      return {
        min: toNum(d.min, 0),
        max: toNum(d.max, 0),
        markup_percent: toNum(d.markup_percent, 0),
      };
    });
    (next as any).material_markup_tiers = nextTiers;

    // Commit wage drafts
    const nextWages: Wage[] = wages.map((w, idx) => ({
      ...w,
      wage: toNum(wageDrafts[idx] ?? String(w.wage ?? 0), 0),
    }));
    (next as any).technician_wages = nextWages;

    return next;
  }

  async function save() {
    if (!s) return;
    try {
      setStatus('Saving...');

      // Commit any in-progress typing into the settings object before save
      const payload = commitAllDraftsIntoSettings();

      // IMPORTANT: do not rely on saveCompanySettings return value
      await data.saveCompanySettings(payload);

      // Re-fetch from server so UI always reflects persisted data
      const fresh = await data.getCompanySettings();
      setS(fresh);

      // Re-sync drafts to the persisted values
      setDraft((prev) => ({
        ...prev,
        workdays_per_week: fresh.workdays_per_week != null ? String(fresh.workdays_per_week) : '',
        work_hours_per_day: fresh.work_hours_per_day != null ? String(fresh.work_hours_per_day) : '',
        technicians: fresh.technicians != null ? String(fresh.technicians) : '',
        vacation_days_per_year: fresh.vacation_days_per_year != null ? String(fresh.vacation_days_per_year) : '',
        sick_days_per_year: fresh.sick_days_per_year != null ? String(fresh.sick_days_per_year) : '',
        estimate_validity_days: fresh.estimate_validity_days != null ? String(fresh.estimate_validity_days) : '',
        starting_estimate_number: fresh.starting_estimate_number != null ? String(fresh.starting_estimate_number) : '',
        min_billable_labor_minutes_per_job:
          fresh.min_billable_labor_minutes_per_job != null ? String(fresh.min_billable_labor_minutes_per_job) : '',
        material_purchase_tax_percent:
          fresh.material_purchase_tax_percent != null ? String(fresh.material_purchase_tax_percent) : '',
        misc_material_percent: fresh.misc_material_percent != null ? String(fresh.misc_material_percent) : '',
        default_discount_percent: fresh.default_discount_percent != null ? String(fresh.default_discount_percent) : '',
        processing_fee_percent: fresh.processing_fee_percent != null ? String(fresh.processing_fee_percent) : '',
      }));

      const ft = Array.isArray(fresh.material_markup_tiers) ? (fresh.material_markup_tiers as any as Tier[]) : [];
      setTierDrafts(
        ft.map((t) => ({
          min: t.min != null ? String(t.min) : '',
          max: t.max != null ? String(t.max) : '',
          markup_percent: t.markup_percent != null ? String(t.markup_percent) : '',
        }))
      );

      const fw = Array.isArray(fresh.technician_wages) ? (fresh.technician_wages as any as Wage[]) : [];
      setWageDrafts(fw.map((w) => (w.wage != null ? String(w.wage) : '')));

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
        <div className="muted small">
          Defaults and pricing knobs used across Materials / Assemblies / Estimates. Technician wage average drives labor COGS.
        </div>
      </Card>

      <Card title="Defaults">
        <div className="grid2">
          <div className="stack">
            <label className="label">Workdays / Week</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.workdays_per_week ?? ''}
              onChange={(e) => onDraftChange('workdays_per_week', e.target.value)}
              onBlur={() => commitNum('workdays_per_week')}
            />
          </div>

          <div className="stack">
            <label className="label">Work Hours / Day</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.work_hours_per_day ?? ''}
              onChange={(e) => onDraftChange('work_hours_per_day', e.target.value)}
              onBlur={() => commitNum('work_hours_per_day')}
            />
          </div>

          <div className="stack">
            <label className="label">Technicians</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.technicians ?? ''}
              onChange={(e) => onDraftChange('technicians', e.target.value)}
              onBlur={() => {
                // commit and resize wages
                const raw = (draft.technicians ?? '').trim();
                const target = raw === '' ? 0 : Math.max(0, Math.floor(toNum(raw, 0)));
                setS({ ...s, technicians: target as any });
                setDraft((d) => ({ ...d, technicians: raw === '' ? '' : String(target) }));
                ensureWagesRowCount(target);
              }}
            />
          </div>

          <div className="stack">
            <label className="label">Vacation Days / Year</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.vacation_days_per_year ?? ''}
              onChange={(e) => onDraftChange('vacation_days_per_year', e.target.value)}
              onBlur={() => commitNum('vacation_days_per_year')}
            />
          </div>

          <div className="stack">
            <label className="label">Sick/Personal Days / Year</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.sick_days_per_year ?? ''}
              onChange={(e) => onDraftChange('sick_days_per_year', e.target.value)}
              onBlur={() => commitNum('sick_days_per_year')}
            />
          </div>

          <div className="stack">
            <label className="label">Estimate Validity Days</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.estimate_validity_days ?? ''}
              onChange={(e) => onDraftChange('estimate_validity_days', e.target.value)}
              onBlur={() => commitNum('estimate_validity_days')}
            />
          </div>

          <div className="stack">
            <label className="label">Starting Estimate Number</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.starting_estimate_number ?? ''}
              onChange={(e) => onDraftChange('starting_estimate_number', e.target.value)}
              onBlur={() => commitNum('starting_estimate_number')}
            />
          </div>

          <div className="stack">
            <label className="label">Min Billable Labor Minutes / Job</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.min_billable_labor_minutes_per_job ?? ''}
              onChange={(e) => onDraftChange('min_billable_labor_minutes_per_job', e.target.value)}
              onBlur={() => commitNum('min_billable_labor_minutes_per_job')}
            />
          </div>
        </div>
      </Card>

      <Card title="Materials">
        <div className="grid2">
          <div className="stack">
            <label className="label">Material Purchase Tax %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.material_purchase_tax_percent ?? ''}
              onChange={(e) => onDraftChange('material_purchase_tax_percent', e.target.value)}
              onBlur={() => commitNum('material_purchase_tax_percent')}
            />
          </div>

          <div className="stack">
            <label className="label">Misc Material %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.misc_material_percent ?? ''}
              onChange={(e) => onDraftChange('misc_material_percent', e.target.value)}
              onBlur={() => commitNum('misc_material_percent')}
            />
          </div>

          <div className="stack">
            <label className="label">Misc Applies When Customer Supplies Materials</label>
            <Toggle
              checked={Boolean(s.misc_applies_when_customer_supplies)}
              onChange={(v) => setS({ ...s, misc_applies_when_customer_supplies: v })}
              label={s.misc_applies_when_customer_supplies ? 'Yes' : 'No'}
            />
          </div>
        </div>

        <div className="mt stack">
          <div className="rowBetween">
            <strong>Material Markup Tiers</strong>
            <Button
              onClick={() => {
                const nextTiers = [...tiers, { min: 0, max: 0, markup_percent: 0 }];
                setS({ ...s, material_markup_tiers: nextTiers as any });
                setTierDrafts((d) => [...d, { min: '', max: '', markup_percent: '' }]);
              }}
            >
              Add Tier
            </Button>
          </div>
          <div className="muted small">Markup applies after purchase tax. Tier match uses cost-with-tax per-unit.</div>

          <div className="stack">
            {tiers.map((t, idx) => {
              const d = tierDrafts[idx] ?? { min: String(t.min ?? 0), max: String(t.max ?? 0), markup_percent: String(t.markup_percent ?? 0) };
              return (
                <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="muted small">Min</span>
                  <Input
                    style={{ width: 90 }}
                    type="text"
                    inputMode="decimal"
                    value={d.min}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), min: v };
                        return out;
                      });
                    }}
                    onBlur={() => {
                      const min = toNum((tierDrafts[idx]?.min ?? d.min) || '', 0);
                      const next = [...tiers];
                      next[idx] = { ...t, min };
                      setS({ ...s, material_markup_tiers: next as any });
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), min: String(min) };
                        return out;
                      });
                    }}
                  />

                  <span className="muted small">Max</span>
                  <Input
                    style={{ width: 90 }}
                    type="text"
                    inputMode="decimal"
                    value={d.max}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), max: v };
                        return out;
                      });
                    }}
                    onBlur={() => {
                      const max = toNum((tierDrafts[idx]?.max ?? d.max) || '', 0);
                      const next = [...tiers];
                      next[idx] = { ...t, max };
                      setS({ ...s, material_markup_tiers: next as any });
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), max: String(max) };
                        return out;
                      });
                    }}
                  />

                  <span className="muted small">Markup %</span>
                  <Input
                    style={{ width: 90 }}
                    type="text"
                    inputMode="decimal"
                    value={d.markup_percent}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), markup_percent: v };
                        return out;
                      });
                    }}
                    onBlur={() => {
                      const mp = toNum((tierDrafts[idx]?.markup_percent ?? d.markup_percent) || '', 0);
                      const next = [...tiers];
                      next[idx] = { ...t, markup_percent: mp };
                      setS({ ...s, material_markup_tiers: next as any });
                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out[idx] = { ...(out[idx] ?? { min: '', max: '', markup_percent: '' }), markup_percent: String(mp) };
                        return out;
                      });
                    }}
                  />

                  <Button
                    onClick={() => {
                      const next = [...tiers];
                      next.splice(idx, 1);
                      setS({ ...s, material_markup_tiers: next as any });

                      setTierDrafts((prev) => {
                        const out = [...prev];
                        out.splice(idx, 1);
                        return out;
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            {tiers.length === 0 ? <div className="muted">No tiers set.</div> : null}
          </div>
        </div>
      </Card>

      <Card title="Discounts & Fees">
        <div className="grid2">
          <div className="stack">
            <label className="label">Default Discount %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.default_discount_percent ?? ''}
              onChange={(e) => onDraftChange('default_discount_percent', e.target.value)}
              onBlur={() => commitNum('default_discount_percent')}
            />
          </div>
          <div className="stack">
            <label className="label">Processing Fee %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.processing_fee_percent ?? ''}
              onChange={(e) => onDraftChange('processing_fee_percent', e.target.value)}
              onBlur={() => commitNum('processing_fee_percent')}
            />
          </div>
        </div>
      </Card>

      <Card title="Technician Wages">
        <div className="muted small">
          Average wage used for labor COGS calculations: <strong>${avgWage(wages).toFixed(2)}/hr</strong>
        </div>
        <div className="mt stack">
          {wages.map((w, idx) => (
            <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Input
                style={{ minWidth: 180 }}
                value={w.name}
                onChange={(e) => {
                  const next = [...wages];
                  next[idx] = { ...w, name: e.target.value };
                  setS({ ...s, technician_wages: next as any });
                }}
                placeholder="Technician name"
              />
              <Input
                style={{ width: 140 }}
                type="text"
                inputMode="decimal"
                value={wageDrafts[idx] ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setWageDrafts((prev) => {
                    const out = [...prev];
                    out[idx] = v;
                    return out;
                  });
                }}
                onBlur={() => {
                  const val = toNum(wageDrafts[idx] ?? '', 0);
                  const next = [...wages];
                  next[idx] = { ...w, wage: val };
                  setS({ ...s, technician_wages: next as any });
                  setWageDrafts((prev) => {
                    const out = [...prev];
                    out[idx] = (wageDrafts[idx] ?? '').trim() === '' ? '' : String(val);
                    return out;
                  });
                }}
                placeholder="$ / hr"
              />
              <Button
                onClick={() => {
                  const next = [...wages];
                  next.splice(idx, 1);
                  setS({ ...s, technician_wages: next as any });
                  setWageDrafts((prev) => {
                    const out = [...prev];
                    out.splice(idx, 1);
                    return out;
                  });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            onClick={() => {
              const next = [...wages, { name: `Tech ${wages.length + 1}`, wage: 0 }];
              setS({ ...s, technician_wages: next as any });
              setWageDrafts((prev) => [...prev, '']);
            }}
          >
            Add Technician
          </Button>
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
