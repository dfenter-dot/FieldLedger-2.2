import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { CsvSettings } from '../../providers/data/types';

export function CsvPage() {
  const data = useData();
  const [s, setS] = useState<CsvSettings | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.getCsvSettings()
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
      const saved = await data.saveCsvSettings(s);
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
      <Card title="CSV Import / Export" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="stack">
          <Toggle
            checked={s.allow_material_import}
            onChange={(v) => setS({ ...s, allow_material_import: v })}
            label="Allow material CSV import"
          />
          <Toggle
            checked={s.allow_assembly_import}
            onChange={(v) => setS({ ...s, allow_assembly_import: v })}
            label="Allow assembly CSV import"
          />
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}

        <div className="muted small mt">
          CSV formatting options can be added later. These toggles map directly to csv_settings columns.
        </div>
      </Card>
    </div>
  );
}

