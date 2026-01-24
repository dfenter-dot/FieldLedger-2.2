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
  const [unitCostText, setUnitCostText] = useState('');
  const [customCostText, setCustomCostText] = useState('');
  const [laborHoursText, setLaborHoursText] = useState('');
  const [laborMinutesText, setLaborMinutesText] = useState('');
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  useEffect(() => {
    if (!materialId) return;
    data
      .getMaterial(materialId)
      .then((mat) => {
        setM(mat);
        setUnitCostText(mat.unit_cost === null || mat.unit_cost === undefined ? '' : String(mat.unit_cost));
        setCustomCostText(mat.custom_cost === null || mat.custom_cost === undefined ? '' : String(mat.custom_cost));
        const lm = Number(mat.labor_minutes ?? 0) || 0;
        const h = Math.floor(lm / 60);
        const min = Math.round(lm % 60);
        setLaborHoursText(mat.labor_minutes == null ? '' : String(h));
        setLaborMinutesText(mat.labor_minutes == null ? '' : String(min));
      })
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data, materialId]);

  useEffect(() => {
    data.listJobTypes().then(setJobTypes).catch(console.error);
  }, [data]);

  async function save() {
    if (!m) return;
    try {
      setStatus('Saving...');
      const unit_cost = unitCostText.trim() === '' ? 0 : Number(unitCostText);
      const custom_cost = customCostText.trim() === '' ? null : Number(customCostText);
      const lh = laborHoursText.trim() === '' ? null : Number(laborHoursText);
      const lm = laborMinutesText.trim() === '' ? null : Number(laborMinutesText);
      const labor_minutes = (Number.isFinite(lh as any) ? Number(lh) : 0) * 60 + (Number.isFinite(lm as any) ? Number(lm) : 0);
      const payload: Material = {
        ...m,
        unit_cost: Number.isFinite(unit_cost) ? unit_cost : 0,
        custom_cost: Number.isFinite(custom_cost as any) ? (custom_cost as any) : null,
        use_custom_cost: Boolean(m.use_custom_cost),
        labor_minutes: Number.isFinite(labor_minutes) ? labor_minutes : 0,
      };
      const saved = await data.upsertMaterial(payload);
      setM(saved);
      setUnitCostText(saved.unit_cost === null || saved.unit_cost === undefined ? '' : String(saved.unit_cost));
      setCustomCostText(saved.custom_cost === null || saved.custom_cost === undefined ? '' : String(saved.custom_cost));
      const savedLm = Number(saved.labor_minutes ?? 0) || 0;
      const sh = Math.floor(savedLm / 60);
      const smin = Math.round(savedLm % 60);
      setLaborHoursText(saved.labor_minutes == null ? '' : String(sh));
      setLaborMinutesText(saved.labor_minutes == null ? '' : String(smin));
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
            <label className="label">SKU / Part #</label>
            <Input value={m.sku ?? ''} onChange={(e) => setM({ ...m, sku: e.target.value })} />
          </div>

          <div className="stack">
            <label className="label">Base Cost ($)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={unitCostText}
              onChange={(e) => setUnitCostText(e.target.value)}
            />
          </div>

          <div className="stack">
            <label className="label">Custom Cost ($)</label>
            <Input type="text" inputMode="decimal" value={customCostText} onChange={(e) => setCustomCostText(e.target.value)} />
          </div>

          <div className="stack">
            <label className="label">Use Custom Cost</label>
            <Toggle checked={!!m.use_custom_cost} onChange={(v) => setM({ ...m, use_custom_cost: v })} label={m.use_custom_cost ? 'Yes' : 'No'} />
          </div>

          <div className="stack">
            <label className="label">Labor Time (Hours)</label>
            <Input type="text" inputMode="numeric" value={laborHoursText} onChange={(e) => setLaborHoursText(e.target.value)} />
          </div>

          <div className="stack">
            <label className="label">Labor Time (Minutes)</label>
            <Input type="text" inputMode="numeric" value={laborMinutesText} onChange={(e) => setLaborMinutesText(e.target.value)} />
          </div>

          <div className="stack">
            <label className="label">Job Type</label>
            <select className="input" value={m.job_type_id ?? ''} onChange={(ev) => setM({ ...m, job_type_id: ev.target.value || null })}>
              <option value="">(Select)</option>
              {jobTypes
                .filter((j: any) => j.enabled !== false)
                .map((jt: any) => (
                  <option key={jt.id} value={jt.id}>
                    {jt.name}
                  </option>
                ))}
            </select>
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

