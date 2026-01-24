import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';

export function EstimateEditorPage() {
  const { estimateId } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();
  const { confirm } = useDialogs();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!estimateId) return;

    if (estimateId === 'new') {
      setEstimate({
        id: crypto.randomUUID?.() ?? `est_${Date.now()}`,
        company_id: '' as any,
        estimate_number: 0,
        name: 'New Estimate',
        job_type_id: null,
        items: [],
        created_at: new Date().toISOString(),
      });
      return;
    }

    data.getEstimate(estimateId)
      .then((e) => {
        if (!e) {
          setStatus('Estimate not found.');
          return;
        }
        setEstimate(e);
      })
      .catch((err) => {
        console.error(err);
        setStatus(String((err as any)?.message ?? err));
      });
  }, [data, estimateId]);

  async function save() {
    if (!estimate) return;
    try {
      setStatus('Saving...');
      const saved = await data.upsertEstimate(estimate);
      setEstimate(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function remove() {
    if (!estimate) return;
    // eslint-disable-next-line no-restricted-globals
    const ok = await confirm({
      title: 'Delete Estimate',
      message: 'Delete this estimate?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      setStatus('Deleting...');
      await data.deleteEstimate(estimate.id);
      nav('/estimates');
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  if (!estimate) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Estimate • ${estimate.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav('/estimates')}>Back</Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
            <Button variant="primary" onClick={save}>Save</Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Estimate #</label>
            <Input
              type="number"
              inputMode="decimal"
              value={String(estimate.estimate_number ?? 0)}
              onChange={(e) => setEstimate({ ...estimate, estimate_number: e.target.value === '' ? 0 : Number(e.target.value) })}
            />
          </div>

          <div className="stack">
            <label className="label">Estimate Name</label>
            <Input value={estimate.name} onChange={(e) => setEstimate({ ...estimate, name: e.target.value })} />
          </div>
        </div>

        <div className="row mt">
          <Button onClick={() => { setMode({ type: 'add-materials-to-estimate', estimateId: estimate.id }); nav('/materials/user'); }}>
            Add Materials
          </Button>
          <Button onClick={() => { setMode({ type: 'add-assemblies-to-estimate', estimateId: estimate.id }); nav('/assemblies/user'); }}>
            Add Assemblies
          </Button>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Items">
        <div className="list">
          {(estimate.items ?? []).map((it) => (
            <div key={it.id} className="listRow">
              <div className="listMain">
                <div className="listTitle">{it.material_id ? `Material: ${it.material_id}` : `Assembly: ${it.assembly_id}`}</div>
                <div className="listSub">Qty: {it.quantity}</div>
              </div>
            </div>
          ))}
          {(estimate.items ?? []).length === 0 ? <div className="muted">No items yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}

