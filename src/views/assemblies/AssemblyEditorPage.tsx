import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Assembly } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';

export function AssemblyEditorPage() {
  const { assemblyId, libraryType } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();
  const { confirm } = useDialogs();

  const [a, setA] = useState<Assembly | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!assemblyId) return;
    data.getAssembly(assemblyId)
      .then(setA)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data, assemblyId]);

  async function save() {
    if (!a) return;
    try {
      setStatus('Saving...');
      const saved = await data.upsertAssembly(a);
      setA(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function remove() {
    if (!a) return;
    try {
      // eslint-disable-next-line no-restricted-globals
      const ok = await confirm({
        title: 'Delete Assembly',
        message: 'Delete this assembly?',
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      setStatus('Deleting...');
      await data.deleteAssembly(a.id);
      nav('/assemblies');
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  if (!a) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Assembly • ${a.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
            <Button variant="primary" onClick={save}>Save</Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Name</label>
            <Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />
          </div>

          <div className="stack">
            <label className="label">Labor Minutes</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(a.labor_minutes ?? 0)}
              onChange={(e) => setA({ ...a, labor_minutes: e.target.value === '' ? 0 : Number(e.target.value) })}
            />
          </div>

          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <Input value={a.description ?? ''} onChange={(e) => setA({ ...a, description: e.target.value })} />
          </div>
        </div>

        <div className="row mt">
          <Button
            onClick={() => {
              setMode({ type: 'add-materials-to-assembly', assemblyId: a.id });
              nav(`/materials/${libraryType ?? 'user'}`);
            }}
          >
            Add Materials
          </Button>
          <div className="muted small">
            Material picking + quantity editing will be wired next. This page saves core assembly fields now.
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Items">
        <div className="list">
          {(a.items ?? []).map((it) => (
            <div key={it.id} className="listRow">
              <div className="listMain">
                <div className="listTitle">{it.material_id}</div>
                <div className="listSub">Qty: {it.quantity}</div>
              </div>
            </div>
          ))}
          {(a.items ?? []).length === 0 ? <div className="muted">No items yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}

