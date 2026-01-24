import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { CsvSettings } from '../../providers/data/types';

export function CsvPage() {
  const data = useData();
  const [s, setS] = useState<CsvSettings>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.getCsvSettings()
      .then(setS)
      .catch((e) => {
        console.error(e);
        setStatus(String(e?.message ?? e));
      });
  }, [data]);

  async function save() {
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

  return (
    <div className="stack">
      <Card title="CSV Import / Export" right={<Button variant="primary" onClick={save}>Save</Button>}>
        <div className="grid2">
          <div className="stack">
            <label className="label">Path separator</label>
            <select
              className="textarea"
              value={s.pathSeparator ?? 'backslash'}
              onChange={(e) => setS({ ...s, pathSeparator: (e.target.value as any) })}
            >
              <option value="backslash">Backslash (Devices\Outlets\TR Duplex)</option>
              <option value="slash">Slash (Devices/Outlets/TR Duplex)</option>
            </select>
          </div>

          <div className="stack">
            <label className="label">Boolean format</label>
            <select
              className="textarea"
              value={s.boolFormat ?? 'truefalse'}
              onChange={(e) => setS({ ...s, boolFormat: (e.target.value as any) })}
            >
              <option value="truefalse">true/false</option>
              <option value="yesno">yes/no</option>
            </select>
          </div>

          <div className="stack">
            <label className="label">Labor time format</label>
            <select
              className="textarea"
              value={s.laborTimeFormat ?? 'decimal_hours'}
              onChange={(e) => setS({ ...s, laborTimeFormat: (e.target.value as any) })}
            >
              <option value="decimal_hours">Decimal hours (1.5 = 1h 30m)</option>
            </select>
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}

        <div className="mt" />
        <div className="row">
          <Button disabled title="Coming soon">Export Materials</Button>
          <Button disabled title="Coming soon">Export Assemblies</Button>
          <Button disabled title="Coming soon">Export Estimates (backup)</Button>
        </div>
        <div className="row mt">
          <Button disabled title="Coming soon">Import Materials</Button>
          <Button disabled title="Coming soon">Import Assemblies</Button>
        </div>

        <ul className="bullets mt">
          <li>Exports: Materials, Assemblies, Estimates (backup)</li>
          <li>Imports: Materials, Assemblies (no estimate imports)</li>
          <li>Categories/subcategories are auto-created from CSV</li>
          <li>Labor time uses decimal hours in CSV and converts on import/export</li>
          <li>App-owned items cannot be exported line-by-line; export must be bulk summary if present</li>
        </ul>
      </Card>
    </div>
  );
}

