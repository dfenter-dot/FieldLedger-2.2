import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Material } from '../../providers/data/types';
import { useDialogs } from '../../providers/dialogs/DialogContext';

export function MaterialEditorPage() {
  const { materialId } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { confirm } = useDialogs();

  const [m, setM] = useState<Material | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!materialId) return;
    data
      .getMaterial(materialId)
      .then(setM)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data, materialId]);

  async function save() {
    if (!m) return;
    try {
      setStatus('Saving...');
      const saved = await data.upsertMaterial(m);
      setM(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function remove() {
    if (!m) return;
    try {
      // eslint-disable-next-line no-restricted-globals
      const ok = await confirm({
        title: 'Delete Material',
        message: 'Delete this material?',
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      setStatus('Deleting...');
      await data.deleteMaterial(m.id);
      nav(-1);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  if (!m) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Material • ${m.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Name</label>
            <Input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </div>

          <div className="stack">
            <label className="label">Unit Cost</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(m.unit_cost ?? 0)}
              onChange={(e) =>
                setM({ ...m, unit_cost: e.target.value === '' ? 0 : Number(e.target.value) })
              }
            />
          </div>

          <div className="stack">
            <label className="label">Labor Minutes</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(m.labor_minutes ?? 0)}
              onChange={(e) =>
                setM({ ...m, labor_minutes: e.target.value === '' ? 0 : Number(e.target.value) })
              }
            />
          </div>

          <div className="stack">
            <label className="label">Taxable</label>
            <Toggle checked={!!m.taxable} onChange={(v) => setM({ ...m, taxable: v })} />
          </div>

          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <Input
              value={m.description ?? ''}
              onChange={(e) => setM({ ...m, description: e.target.value })}
            />
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

