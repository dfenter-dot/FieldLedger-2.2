import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { SaveButton, SaveUiState } from '../../ui/components/SaveButton';
import { useData } from '../../providers/data/DataContext';
import type { Material } from '../../providers/data/types';
import { useDialogs } from '../../providers/dialogs/DialogContext';

export function MaterialEditorPage() {
  const { materialId, libraryType } = useParams();
  const data = useData();
  // NOTE: DataContext value can change identity between renders in this codebase.
  // If we depend on `data` in editor hydration effects, a new identity can trigger
  // a refetch that overwrites in-progress edits (appearing like inputs "revert").
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const nav = useNavigate();
  const { confirm } = useDialogs();

  const [isOwner, setIsOwner] = useState(false);
  const isAppLibrary = (libraryType ?? '') === 'app';

  const [m, setM] = useState<Material | null>(null);
  const [status, setStatus] = useState<string>('');
  const [saveUi, setSaveUi] = useState<SaveUiState>('idle');
  const [unitCostText, setUnitCostText] = useState('');
  const [customCostText, setCustomCostText] = useState('');
  const [laborHoursText, setLaborHoursText] = useState('');
  const [laborMinutesText, setLaborMinutesText] = useState('');
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  useEffect(() => {
    if (!materialId) return;

    (async () => {
      try {
        const base = await dataRef.current.getMaterial(materialId);
        if (!base) {
          setM(null);
          return;
        }

        // IMPORTANT:
        // For app-owned materials, the per-company override row is the source of truth for
        // custom_cost / use_custom_cost / job_type_id / taxable. Some flows reload the base
        // material without merging the override, causing the UI to "snap back".
        let merged: any = { ...base };
        if (isAppLibrary && !isOwner) {
          try {
            const ov = await (dataRef.current as any).getAppMaterialOverride?.(materialId);
            if (ov) {
              if (ov.custom_cost !== undefined) merged.custom_cost = ov.custom_cost;
              if (ov.use_custom_cost !== undefined) merged.use_custom_cost = ov.use_custom_cost;
              if (ov.job_type_id !== undefined) merged.job_type_id = ov.job_type_id;
              if (ov.taxable !== undefined) merged.taxable = ov.taxable;
            }
          } catch {
            // ignore; show base
          }
        }

        setM(merged);
        setUnitCostText(merged.base_cost === null || merged.base_cost === undefined ? '' : String(merged.base_cost));
        setCustomCostText(merged.custom_cost === null || merged.custom_cost === undefined ? '' : String(merged.custom_cost));
        const lm = Number(merged.labor_minutes ?? 0) || 0;
        const h = Math.floor(lm / 60);
        const min = Math.round(lm % 60);
        setLaborHoursText(merged.labor_minutes == null ? '' : String(h));
        setLaborMinutesText(merged.labor_minutes == null ? '' : String(min));
      } catch (e) {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      }
    })();
  }, [materialId, isOwner, isAppLibrary]);

  useEffect(() => {
    data.listJobTypes().then(setJobTypes).catch(console.error);
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        const owner = await (data as any).isAppOwner?.();
        setIsOwner(Boolean(owner));
      } catch {
        setIsOwner(false);
      }
    })();
  }, [data]);

  async function save() {
    if (!m || !materialId) return;
    try {
      setSaveUi('saving');
      setStatus('Saving...');

      const laborOnly = Boolean((m as any).labor_only);

      // If the user leaves Base Cost blank, do NOT overwrite the existing value.
      const base_cost = laborOnly ? 0 : (unitCostText.trim() === '' ? Number((m as any).base_cost ?? 0) : Number(unitCostText));
      const custom_cost = laborOnly ? null : (customCostText.trim() === '' ? null : Number(customCostText));

      const lh = laborHoursText.trim() === '' ? null : Number(laborHoursText);
      const lm = laborMinutesText.trim() === '' ? null : Number(laborMinutesText);
      const labor_minutes =
        (Number.isFinite(lh as any) ? Number(lh) : 0) * 60 +
        (Number.isFinite(lm as any) ? Number(lm) : 0);

      // App Materials (normal companies): save ONLY overrides
      if (isAppLibrary && !isOwner) {
        // NOTE: App materials are global (company_id = null). Companies store their
        // own overrides in app_material_overrides scoped by current_company_id().
        // Do NOT pass (materialId, patch) here; upsertAppMaterialOverride expects
        // a single object matching the table schema.
        const patch: any = {
          material_id: materialId,
          job_type_id: m.job_type_id ?? null,
          taxable: Boolean(m.taxable),
          custom_cost: Number.isFinite(custom_cost as any) ? (custom_cost as any) : null,
          use_custom_cost: Boolean(m.use_custom_cost),
        };

        await (data as any).upsertAppMaterialOverride(patch);

        // refresh merged view (force-merge override after save)
        const refreshedBase = await data.getMaterial(materialId);
        let refreshed: any = refreshedBase ? { ...refreshedBase } : null;
        try {
          const ov = await (data as any).getAppMaterialOverride?.(materialId);
          if (ov && refreshed) {
            if (ov.custom_cost !== undefined) refreshed.custom_cost = ov.custom_cost;
            if (ov.use_custom_cost !== undefined) refreshed.use_custom_cost = ov.use_custom_cost;
            if (ov.job_type_id !== undefined) refreshed.job_type_id = ov.job_type_id;
            if (ov.taxable !== undefined) refreshed.taxable = ov.taxable;
          }
        } catch {
          // ignore
        }

        if (refreshed) {
          setM(refreshed);
          setUnitCostText(refreshed.base_cost === null || refreshed.base_cost === undefined ? '' : String(refreshed.base_cost));
          setCustomCostText(refreshed.custom_cost === null || refreshed.custom_cost === undefined ? '' : String(refreshed.custom_cost));
        }

        const savedLm = Number(refreshed?.labor_minutes ?? 0) || 0;
        const sh = Math.floor(savedLm / 60);
        const smin = Math.round(savedLm % 60);
        setLaborHoursText(refreshed?.labor_minutes == null ? '' : String(sh));
        setLaborMinutesText(refreshed?.labor_minutes == null ? '' : String(smin));

        setStatus('Saved.');
        setTimeout(() => setStatus(''), 1500);
        setSaveUi('saved');
        setTimeout(() => setSaveUi('idle'), 1200);
        return;
      }

      // User Materials + App Owner edit path
      const payload: Material = {
        ...m,
        labor_only: laborOnly,
        taxable: laborOnly ? false : Boolean(m.taxable),
        use_custom_cost: laborOnly ? false : Boolean(m.use_custom_cost),
        // Persist to the actual DB-backed field.
        base_cost: Number.isFinite(base_cost) ? base_cost : Number((m as any).base_cost ?? 0),
        custom_cost: Number.isFinite(custom_cost as any) ? (custom_cost as any) : null,
        labor_minutes: Number.isFinite(labor_minutes) ? labor_minutes : 0,
      };

      const saved = await data.upsertMaterial(payload);
      setM(saved);
      setUnitCostText(saved.base_cost === null || saved.base_cost === undefined ? '' : String(saved.base_cost));
      setCustomCostText(saved.custom_cost === null || saved.custom_cost === undefined ? '' : String(saved.custom_cost));
      const savedLm = Number(saved.labor_minutes ?? 0) || 0;
      const sh = Math.floor(savedLm / 60);
      const smin = Math.round(savedLm % 60);
      setLaborHoursText(saved.labor_minutes == null ? '' : String(sh));
      setLaborMinutesText(saved.labor_minutes == null ? '' : String(smin));
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
      setSaveUi('saved');
      setTimeout(() => setSaveUi('idle'), 1200);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
      setSaveUi('error');
      setTimeout(() => setSaveUi('idle'), 1500);
    }
  }

  async function remove() {
    if (isAppLibrary && !isOwner) {
      setStatus('App materials cannot be deleted by companies.');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
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

  const readOnlyBase = isAppLibrary && !isOwner;

  if (!m) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Material • ${m.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Close ✕</Button>
            {isAppLibrary && !isOwner ? null : (
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
            )}
            <SaveButton state={saveUi} onClick={save} />
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Name</label>
            <Input value={m.name} disabled={readOnlyBase || Boolean((m as any).labor_only)} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </div>

          <div className="stack">
            <label className="label">SKU / Part #</label>
            <Input value={m.sku ?? ''} disabled={readOnlyBase} onChange={(e) => setM({ ...m, sku: e.target.value })} />
          </div>

          
<div className="stack">
  <label className="label">Labor Only</label>
  <Toggle
    checked={Boolean((m as any).labor_only)}
    onChange={(v) => {
      // When labor-only, material cost inputs are irrelevant.
      setM({ ...m, labor_only: Boolean(v), taxable: v ? false : m.taxable, use_custom_cost: v ? false : m.use_custom_cost });
      if (v) {
        setUnitCostText('0');
        setCustomCostText('');
      }
    }}
    label={(m as any).labor_only ? 'Yes' : 'No'}
  />
  <div className="muted small">Use for dispatch/diagnostics/troubleshooting — contributes labor only, no material cost/markup.</div>
</div>

<div className="stack">
            <label className="label">Base Cost ($)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={unitCostText}
              disabled={readOnlyBase || Boolean((m as any).labor_only)}
              onChange={(e) => setUnitCostText(e.target.value)}
            />
          </div>

          <div className="stack">
            <label className="label">Custom Cost ($)</label>
            <Input type="text" inputMode="decimal" value={customCostText} onChange={(e) => setCustomCostText(e.target.value)} />
          </div>

          <div className="stack">
            <label className="label">Use Custom Cost</label>
            <Toggle checked={!!m.use_custom_cost} disabled={Boolean((m as any).labor_only)} onChange={(v) => setM({ ...m, use_custom_cost: v })} label={m.use_custom_cost ? 'Yes' : 'No'} />
          </div>

          <div className="stack">
            <label className="label">Labor Time (Hours)</label>
            <Input type="text" inputMode="numeric" value={laborHoursText} disabled={readOnlyBase} onChange={(e) => setLaborHoursText(e.target.value)} />
          </div>

          <div className="stack">
            <label className="label">Labor Time (Minutes)</label>
            <Input type="text" inputMode="numeric" value={laborMinutesText} disabled={readOnlyBase} onChange={(e) => setLaborMinutesText(e.target.value)} />
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
            <textarea className="input textarea" value={m.description ?? ''} disabled={readOnlyBase} onChange={(e) => setM({ ...m, description: e.target.value })} />
          </div>
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}








