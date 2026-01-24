import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { CompanySettings } from '../../providers/data/types';

export function CompanySetupPage() {
  const data = useData();
  const [s, setS] = useState<CompanySettings>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.getCompanySettings()
      .then(setS)
      .catch((e) => {
        console.error(e);
        setStatus(String(e?.message ?? e));
      });
  }, [data]);

  async function save() {
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

  return (
    <div className="stack">
      <Card title="Company Setup" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="grid2">
          <div className="stack">
            <label className="label">Company Name</label>
            <Input value={s.companyName ?? ''} onChange={(e) => setS({ ...s, companyName: e.target.value })} />
          </div>

          <div className="stack">
            <label className="label">Starting Estimate Number</label>
            <Input
              value={s.startingEstimateNumber?.toString() ?? ''}
              onChange={(e) => setS({ ...s, startingEstimateNumber: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 100"
            />
          </div>

          <div className="stack">
            <label className="label">Purchase Tax % (cost side)</label>
            <Input
              value={s.purchaseTaxPct?.toString() ?? ''}
              onChange={(e) => setS({ ...s, purchaseTaxPct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 8.25"
            />
          </div>

          <div className="stack">
            <label className="label">Misc Material %</label>
            <Input
              value={s.miscMaterialPct?.toString() ?? ''}
              onChange={(e) => setS({ ...s, miscMaterialPct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 5"
            />
          </div>

          <div className="stack">
            <label className="label">Processing Fee %</label>
            <Input
              value={s.processingFeePct?.toString() ?? ''}
              onChange={(e) => setS({ ...s, processingFeePct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 3"
            />
          </div>

          <div className="stack">
            <label className="label">Minimum Labor Minutes</label>
            <Input
              value={s.minLaborMinutes?.toString() ?? ''}
              onChange={(e) => setS({ ...s, minLaborMinutes: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 15"
            />
          </div>

          <div className="stack">
            <label className="label">Estimate Validity (days)</label>
            <Input
              value={s.estimateValidityDays?.toString() ?? ''}
              onChange={(e) => setS({ ...s, estimateValidityDays: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="e.g. 30"
            />
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}

        <div className="muted small mt">
          This page is intentionally minimal scaffolding: it loads and saves company-scoped settings. Pricing behavior is unchanged.
        </div>
      </Card>
    </div>
  );
}

