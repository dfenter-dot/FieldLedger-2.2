import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Toggle } from '../../ui/components/Toggle';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { JobType } from '../../providers/data/types';

export function JobTypesPage() {
  const data = useData();
  const [rows, setRows] = useState<JobType[]>([]);

  useEffect(() => {
    data.listJobTypes().then(setRows).catch(console.error);
  }, [data]);

  return (
    <div className="stack">
      <Card title="Job Types" right={<Button variant="primary">Create Job Type</Button>}>
        <div className="muted">Job types drive margin, efficiency (flat rate), and hourly vs flat-rate mode.</div>
      </Card>

      <Card title="List">
        <div className="stack">
          {rows.map((jt) => (
            <div key={jt.id} className="rowBetween">
              <div className="stack" style={{ flex: 1 }}>
                <div className="row">
                  <strong>{jt.name}</strong>
                  {jt.isDefault ? <span className="pill gold">Default</span> : null}
                  {!jt.enabled ? <span className="pill">Disabled</span> : null}
                </div>
                <div className="row">
                  <span className="pill">{jt.mode === 'flat' ? 'Flat Rate' : 'Hourly'}</span>
                  <span className="pill">GM: {jt.grossMarginPct}%</span>
                  <span className="pill">Eff: {jt.efficiencyPct}%</span>
                  <span className="pill">{jt.allowDiscount ? 'Discounts allowed' : 'No discounts'}</span>
                </div>
              </div>
              <div className="row">
                <Button>Set Default</Button>
                <Button>Edit</Button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <div className="muted">No job types yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}
