import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';
import { computeAssemblyPricing } from '../../providers/data/pricing';

type AssemblyMaterialRow = {
  itemId: string;
  materialId: string;
  quantity: number;
  material?: Material | null;
};

export function AssemblyEditorPage() {
  const { assemblyId, libraryType } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();
  const dialogs = useDialogs();

  const [a, setA] = useState<Assembly | null>(null);
  const [status, setStatus] = useState('');
  const [laborMinutesText, setLaborMinutesText] = useState('');
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, jts] = await Promise.all([data.getCompanySettings(), data.listJobTypes()]);
        if (!cancelled) {
          setCompanySettings(s);
          setJobTypes(jts);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!assemblyId) return;
    data
      .getAssembly(assemblyId)
      .then((asm) => {
        setA(asm);
        setLaborMinutesText(asm?.labor_minutes == null ? '' : String(asm.labor_minutes));
      })
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [assemblyId, data]);

  const materialRows = useMemo<AssemblyMaterialRow[]>(() => {
    const items = a?.items ?? [];
    return items
      .filter((it: any) => !!it.material_id)
      .map((it: any) => ({
        itemId: it.id,
        materialId: it.material_id,
        quantity: Number(it.quantity ?? 1) || 1,
      }));
  }, [a?.items]);

  const [materialCache, setMaterialCache] = useState<Record<string, Material | null>>({});

  useEffect(() => {
    // Fetch missing materials for display.
    const missing = materialRows
      .map((r) => r.materialId)
      .filter((id) => materialCache[id] === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const next: Record<string, Material | null> = {};
      for (const id of missing) {
        try {
          next[id] = await data.getMaterial(id);
        } catch {
          next[id] = null;
        }
      }
      if (!cancelled) setMaterialCache((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [data, materialRows, materialCache]);

  const totals = useMemo(() => {
    if (!a || !companySettings) return null;
    const jobTypesById = Object.fromEntries(jobTypes.map((j) => [j.id, j]));
    return computeAssemblyPricing({
      assembly: a,
      materialsById: materialCache,
      jobTypesById,
      companySettings,
    });
  }, [a, companySettings, jobTypes, materialCache]);

  async function save(next: Assembly) {
    try {
      setStatus('Saving…');
      const saved = await data.upsertAssembly(next);
      setA(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function saveAll() {
    if (!a) return;
    const lm = laborMinutesText.trim() === '' ? 0 : Number(laborMinutesText);
    await save({
      ...a,
      labor_minutes: Number.isFinite(lm) ? lm : 0,
    } as any);
  }

  async function duplicate() {
    if (!a) return;
    try {
      setStatus('Duplicating…');
      const copy = await data.upsertAssembly({
        ...a,
        id: crypto.randomUUID?.() ?? `asm_${Date.now()}`,
        name: `${a.name} (Copy)`,
        created_at: new Date().toISOString(),
      } as any);
      nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${copy.id}`);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function remove() {
    if (!a) return;
    const ok = await dialogs.confirm({
      title: 'Delete Assembly',
      message: 'Delete this assembly? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      setStatus('Deleting…');
      await data.deleteAssembly(a.id);
      nav(-1);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function updateItemQuantity(itemId: string, quantity: number) {
    if (!a) return;
    const nextItems = (a.items ?? []).map((it: any) => (it.id === itemId ? { ...it, quantity } : it));
    await save({ ...a, items: nextItems } as any);
  }

  async function removeItem(itemId: string) {
    if (!a) return;
    const nextItems = (a.items ?? []).filter((it: any) => it.id !== itemId);
    await save({ ...a, items: nextItems } as any);
  }

  if (!a) return <div className="muted">Loading…</div>;

  async function applyAdminRules() {
    if (!a || !a.use_admin_rules) return;
    try {
      setStatus('Applying rules...');
      const rules = await data.listAdminRules();
      const match = rules
        .filter((r) => r.enabled && r.applies_to === 'assembly' && (r.match_text ?? '').trim().length > 0)
        .sort((x, y) => x.priority - y.priority)
        .find((r) => (a.name ?? '').toLowerCase().includes(String(r.match_text).toLowerCase()));
      if (match?.set_job_type_id) {
        const saved = await data.upsertAssembly({ ...a, job_type_id: match.set_job_type_id } as any);
        setA(saved as any);
        setStatus('Rules applied.');
      } else {
        setStatus('No matching rules.');
      }
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  return (
    <div className="stack">
      <Card
        title={`Assembly • ${a.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
            <Button onClick={duplicate}>Duplicate</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            {a.use_admin_rules ? <Button onClick={applyAdminRules}>Apply Changes</Button> : null}
            <Button variant="primary" onClick={saveAll}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Assembly Name</label>
            <Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value } as any)} />
          </div>

          <div className="stack">
            <label className="label">Use Admin Rules</label>
            <Toggle
              checked={Boolean(a.use_admin_rules)}
              onChange={(v) => setA({ ...a, use_admin_rules: v } as any)}
              label={a.use_admin_rules ? 'Yes (locks job type)' : 'No'}
            />
          </div>

          <div className="stack">
            <label className="label">Job Type</label>
            <select
              className="input"
              disabled={Boolean(a.use_admin_rules)}
              value={a.job_type_id ?? ''}
              onChange={(ev) => setA({ ...a, job_type_id: ev.target.value || null } as any)}
            >
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
            <label className="label">Customer Supplies Materials</label>
            <select
              className="input"
              value={String(Boolean(a.customer_supplies_materials))}
              onChange={(ev) => setA({ ...a, customer_supplies_materials: ev.target.value === 'true' } as any)}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          <div className="stack">
            <label className="label">Assembly Labor Minutes</label>
            <Input type="text" inputMode="decimal" value={laborMinutesText} onChange={(e) => setLaborMinutesText(e.target.value)} />
          </div>

          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <Input value={a.description ?? ''} onChange={(e) => setA({ ...a, description: e.target.value } as any)} />
          </div>
        </div>

        <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              setMode({ type: 'add-materials-to-assembly', assemblyId: a.id });
              nav('/materials/user');
            }}
          >
            Add From Materials
          </Button>
        </div>

        <div className="mt">
          <div className="muted small">Materials</div>
          <div className="list">
            {materialRows.map((r) => {
              const mat = materialCache[r.materialId];
              return (
                <div key={r.itemId} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{mat?.name ?? `Material ${r.materialId}`}</div>
                    <div className="listSub">{mat?.description ?? '—'}</div>
                  </div>
                  <div className="listRight" style={{ gap: 8 }}>
                    <Input
                      style={{ width: 90 }}
                      type="text"
                      inputMode="numeric"
                      value={String(r.quantity)}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value || 1));
                        if (Number.isFinite(q)) updateItemQuantity(r.itemId, q);
                      }}
                    />
                    <Button variant="danger" onClick={() => removeItem(r.itemId)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
            {materialRows.length === 0 ? <div className="muted">No materials added yet.</div> : null}
          </div>
        </div>

        {totals ? (
          <div className="mt">
            <div className="muted small">Cost & Pricing Breakdown</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="pill">Actual Labor: {Math.round(totals.labor_minutes_actual)} min</div>
              <div className="pill">Expected Labor: {Math.round(totals.labor_minutes_expected)} min</div>
              <div className="pill">Material Cost: ${totals.material_cost.toFixed(2)}</div>
              <div className="pill">Material Price: ${totals.material_price.toFixed(2)}</div>
              <div className="pill">Labor Price: ${totals.labor_price.toFixed(2)}</div>
              <div className="pill">Total: ${totals.total.toFixed(2)}</div>
              {totals.gross_margin_target_percent != null ? (
                <div className="pill">Target GM: {totals.gross_margin_target_percent.toFixed(0)}%</div>
              ) : null}
              {totals.gross_margin_expected_percent != null ? (
                <div className="pill">Expected GM: {totals.gross_margin_expected_percent.toFixed(0)}%</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt muted small">Totals will appear after Company Setup loads.</div>
        )}

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

