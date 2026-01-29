import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, AssemblyItem, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';
import { computeAssemblyPricing } from '../../providers/data/pricing';

type AssemblyMaterialRow = {
  itemId: string;
  materialId: string;
  quantity: number;
  rawItem: any;
  material?: Material | null;
};

function normalizeAssemblyResponse(resp: any): {
  assembly: Assembly;
  items: AssemblyItem[];
  appOverride?: any | null;
} | null {
  if (!resp) return null;

  // Preferred shape per IDataProvider
  if (resp.assembly && Array.isArray(resp.items)) {
    return {
      assembly: resp.assembly as Assembly,
      items: (resp.items ?? []) as AssemblyItem[],
      appOverride: resp.appOverride ?? null,
    };
  }

  // Legacy/alternate shape used by older providers:
  // { ...assemblyFields, items: [...] }
  const { items, ...rest } = resp;
  const asm = rest as Assembly;
  const normalizedItems: AssemblyItem[] = Array.isArray(items)
    ? items.map((it: any, idx: number) => ({
        ...it,
        // Normalize to `type` for UI
        type: (it.type ?? it.item_type ?? it.itemType ?? 'material') as any,
        material_id: it.material_id ?? it.materialId ?? null,
        assembly_id: it.assembly_id ?? asm.id,
        name: it.name ?? '',
        quantity: Number(it.quantity ?? 1) || 1,
        labor_minutes: Number(it.labor_minutes ?? 0) || 0,
        sort_order: Number(it.sort_order ?? idx) || 0,
      }))
    : [];

  return { assembly: asm, items: normalizedItems, appOverride: resp.appOverride ?? null };
}

function fmtLaborHM(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes || 0)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function AssemblyEditorPage() {
  const { assemblyId, libraryType } = useParams();
  const data = useData();
  const nav = useNavigate();
  const location = useLocation();
  const { setMode } = useSelection();
  const dialogs = useDialogs();

  const [a, setA] = useState<{
    assembly: Assembly;
    items: AssemblyItem[];
    appOverride?: any | null;
  } | null>(null);
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

  async function refreshAssembly(id: string) {
    const raw = await data.getAssembly(id);
    const asm = normalizeAssemblyResponse(raw);
    setA(asm as any);
    const lm = (asm as any)?.assembly?.labor_minutes;
    setLaborMinutesText(lm == null ? '' : String(lm));
  }

  useEffect(() => {
    if (!assemblyId) return;
    refreshAssembly(assemblyId).catch((e) => {
      console.error(e);
      setStatus(String((e as any)?.message ?? e));
    });
    // Also re-fetch when navigating back from picker flows.
  }, [assemblyId, data, location.key]);

  const materialRows = useMemo<AssemblyMaterialRow[]>(() => {
    const items = ((a?.items ?? []) as any[]) ?? [];
    return items
      // Items can come from different providers:
      // - UI-created: { type: 'material', material_id: ... }
      // - Supabase:   { item_type: 'material', material_id: ... }
      .filter((it) => (it.type ?? it.item_type) === 'material' && (it.material_id ?? it.materialId))
      .map((it) => ({
        itemId: it.id,
        materialId: it.material_id ?? it.materialId,
        quantity: Number(it.quantity ?? 1) || 1,
        rawItem: it,
      }));
  }, [a?.items]);

  const blankMaterialRows = useMemo(() => {
    const items = (a?.items ?? []) as any[];
    return items.filter((it) => (it.type ?? it.item_type) === 'blank_material');
  }, [a?.items]);

  const laborRows = useMemo(() => {
    const items = (a?.items ?? []) as any[];
    return items.filter((it) => (it.type ?? it.item_type) === 'labor');
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
    const materialsById = Object.fromEntries(
      Object.entries(materialCache)
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v])
    ) as any;

    return computeAssemblyPricing({
      assembly: a.assembly as any,
      items: (a.items ?? []) as any,
      materialsById,
      jobTypesById,
      companySettings,
    });
  }, [a, companySettings, jobTypes, materialCache]);

  async function save(next: { assembly: Assembly; items: AssemblyItem[] }) {
    try {
      setStatus('Saving…');
      const saved = await data.upsertAssembly({
        assembly: next.assembly,
        items: next.items,
      } as any);
      await refreshAssembly((saved as any).id ?? next.assembly.id);
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
      assembly: {
        ...(a.assembly as any),
        labor_minutes: Number.isFinite(lm) ? lm : 0,
      },
      items: a.items,
    });
  }

  async function duplicate() {
    if (!a) return;
    try {
      setStatus('Duplicating…');
      const newId = crypto.randomUUID?.() ?? `asm_${Date.now()}`;
      const copyAsm: any = {
        ...(a.assembly as any),
        id: newId,
        name: `${a.assembly.name} (Copy)`,
        created_at: new Date().toISOString(),
      };
      const copyItems: any[] = (a.items ?? []).map((it: any) => ({
        ...it,
        id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
        assembly_id: newId,
      }));
      const saved = await data.upsertAssembly({ assembly: copyAsm, items: copyItems } as any);
      nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${(saved as any).id ?? newId}`);
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
      await data.deleteAssembly(a.assembly.id);
      nav(-1);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    if (!a) return;
    const nextItems = (a.items ?? []).map((it: any) => (it.id === itemId ? { ...it, quantity } : it)) as any;
    setA({ ...a, items: nextItems } as any);
  }

  function removeItem(itemId: string) {
    if (!a) return;
    const nextItems = (a.items ?? []).filter((it: any) => it.id !== itemId) as any;
    setA({ ...a, items: nextItems } as any);
  }

  if (!a) return <div className="muted">Loading…</div>;

  async function applyAdminRules() {
    if (!a || !a.assembly.use_admin_rules) return;
    try {
      setStatus('Applying rules...');
      const rules = await data.listAdminRules();
      const match = rules
        .filter((r) => r.enabled && r.applies_to === 'assembly' && (r.match_text ?? '').trim().length > 0)
        .sort((x, y) => x.priority - y.priority)
        .find((r) => (a.assembly.name ?? '').toLowerCase().includes(String(r.match_text).toLowerCase()));
      if (match?.set_job_type_id) {
        await save({
          assembly: { ...(a.assembly as any), job_type_id: match.set_job_type_id },
          items: a.items,
        });
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
        title={`Assembly • ${a.assembly.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
            <Button onClick={duplicate}>Duplicate</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            {a.assembly.use_admin_rules ? <Button onClick={applyAdminRules}>Apply Changes</Button> : null}
            <Button variant="primary" onClick={saveAll}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Assembly Name</label>
            <Input
              value={a.assembly.name}
              onChange={(e) => setA({ ...a, assembly: { ...a.assembly, name: e.target.value } } as any)}
            />
          </div>

          <div className="stack">
            <label className="label">Use Admin Rules</label>
            <Toggle
              checked={Boolean(a.assembly.use_admin_rules)}
              onChange={(v) => setA({ ...a, assembly: { ...a.assembly, use_admin_rules: v } } as any)}
              label={a.assembly.use_admin_rules ? 'Yes (locks job type)' : 'No'}
            />
          </div>

          <div className="stack">
            <label className="label">Job Type</label>
            <select
              className="input"
              disabled={Boolean(a.assembly.use_admin_rules)}
              value={a.assembly.job_type_id ?? ''}
              onChange={(ev) => setA({ ...a, assembly: { ...a.assembly, job_type_id: ev.target.value || null } } as any)}
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
              value={String(Boolean(a.assembly.customer_supplied_materials))}
              onChange={(ev) =>
                setA({
                  ...a,
                  assembly: { ...a.assembly, customer_supplied_materials: ev.target.value === 'true' },
                } as any)
              }
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
            <Input
              value={a.assembly.description ?? ''}
              onChange={(e) => setA({ ...a, assembly: { ...a.assembly, description: e.target.value } } as any)}
            />
          </div>
        </div>

        <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              const lt = libraryType === 'app' ? 'app' : 'user';
              setMode({
                type: 'add-materials-to-assembly',
                assemblyId: a.assembly.id,
                returnTo: `/assemblies/${lt}/${a.assembly.id}`,
              } as any);
              nav('/materials');
            }}
          >
            Add From Materials
          </Button>

          <Button
            onClick={() => {
              if (!a) return;
              const items = [...((a.items ?? []) as any[])];
              items.push({
                id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
                assembly_id: a.assembly.id,
                type: 'blank_material',
                name: 'New Material',
                quantity: 1,
                unit_cost: 0,
                taxable: true,
                labor_minutes: 0,
              });
              setA({ ...a, items } as any);
            }}
          >
            Add Blank Material Line
          </Button>

          <Button
            onClick={() => {
              if (!a) return;
              const items = [...((a.items ?? []) as any[])];
              items.push({
                id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
                assembly_id: a.assembly.id,
                type: 'labor',
                name: 'Labor',
                quantity: 1,
                labor_minutes: 0,
              });
              setA({ ...a, items } as any);
            }}
          >
            Add Labor Line
          </Button>
        </div>

        <div className="mt">
          <div className="muted small">Materials</div>
          <div className="list">
            {materialRows.map((r) => {
              const mat = materialCache[r.materialId];

              // Prefer item overrides when present, otherwise fall back to material fields.
              const it = r.rawItem ?? {};

              const baseCost =
                Number((mat as any)?.base_cost ?? (mat as any)?.unit_cost ?? (mat as any)?.cost ?? 0) || 0;
              const customCostRaw =
                (mat as any)?.custom_cost ?? (mat as any)?.customCost ?? (mat as any)?.override_custom_cost ?? null;
              const customCost = customCostRaw == null ? null : Number(customCostRaw);
              const useCustom = Boolean((mat as any)?.use_custom_cost ?? (mat as any)?.useCustomCost ?? false);
              const materialCost = useCustom && customCost != null && Number.isFinite(customCost) ? customCost : baseCost;

              const overrideCostRaw =
                it.material_cost_override ?? it.material_cost ?? it.cost ?? (it.materialCostOverride ?? null);
              const overrideCost = overrideCostRaw == null ? null : Number(overrideCostRaw);
              const chosenCost = overrideCost != null && Number.isFinite(overrideCost) ? overrideCost : materialCost;

              const taxable = Boolean(it.taxable ?? (mat as any)?.taxable);
              const laborMins =
                Number(
                  it.labor_minutes ??
                    it.laborMinutes ??
                    (Number(it.labor_hours ?? it.laborHours ?? 0) * 60 + Number(it.labor_minutes ?? 0)) ??
                    (mat as any)?.labor_minutes ??
                    (mat as any)?.laborMinutes ??
                    (mat as any)?.labor_time_minutes ??
                    0
                ) || 0;

              const jtId = it.job_type_id ?? (mat as any)?.job_type_id ?? (mat as any)?.jobTypeId ?? null;
              const jtName = jtId ? jobTypes.find((j: any) => j.id === jtId)?.name : null;
              return (
                <div key={r.itemId} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{mat?.name ?? `Material ${r.materialId}`}</div>
                    <div className="listSub">{mat?.description ?? '—'}</div>
                    <div className="listSub">
                      Labor: {fmtLaborHM(laborMins)} • Cost: ${chosenCost.toFixed(2)}
                      {overrideCost != null ? ' (override)' : useCustom ? ' (custom)' : ' (base)'} • Taxable:{' '}
                      {taxable ? 'Yes' : 'No'} • Job Type: {jtName ?? '(None)'}
                    </div>
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

        
        <div className="mt">
          <div className="muted small">Blank Material Lines</div>
          <div className="list">
            {blankMaterialRows.map((it: any) => (
              <div key={it.id} className="listRow">
                <div className="listMain">
                  <Input
                    value={it.name ?? ''}
                    onChange={(e) => {
                      const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, name: e.target.value } : x));
                      setA({ ...a, items: nextItems } as any);
                    }}
                  />
                  <div className="row mt" style={{ gap: 8 }}>
                    <Input
                      style={{ width: 110 }}
                      type="text"
                      inputMode="decimal"
                      value={String(it.unit_cost ?? 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, unit_cost: Number.isFinite(v) ? v : 0 } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                    />
                    <Toggle
                      checked={Boolean(it.taxable)}
                      onChange={(v) => {
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, taxable: v } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                      label={it.taxable ? 'Taxable' : 'Non-taxable'}
                    />
                    <Input
                      style={{ width: 90 }}
                      type="text"
                      inputMode="numeric"
                      value={String(it.quantity ?? 1)}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value || 1));
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, quantity: Number.isFinite(q) ? q : 1 } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                    />
                    <Input
                      style={{ width: 110 }}
                      type="text"
                      inputMode="numeric"
                      value={String(it.labor_minutes ?? 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, labor_minutes: Number.isFinite(v) ? v : 0 } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                    />
                    <Button variant="danger" onClick={() => removeItem(it.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {blankMaterialRows.length === 0 ? <div className="muted">No blank material lines.</div> : null}
          </div>
        </div>

        <div className="mt">
          <div className="muted small">Labor Lines</div>
          <div className="list">
            {laborRows.map((it: any) => (
              <div key={it.id} className="listRow">
                <div className="listMain">
                  <Input
                    value={it.name ?? ''}
                    onChange={(e) => {
                      const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, name: e.target.value } : x));
                      setA({ ...a, items: nextItems } as any);
                    }}
                  />
                  <div className="row mt" style={{ gap: 8 }}>
                    <Input
                      style={{ width: 90 }}
                      type="text"
                      inputMode="numeric"
                      value={String(it.quantity ?? 1)}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value || 1));
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, quantity: Number.isFinite(q) ? q : 1 } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                    />
                    <Input
                      style={{ width: 110 }}
                      type="text"
                      inputMode="numeric"
                      value={String(it.labor_minutes ?? 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, labor_minutes: Number.isFinite(v) ? v : 0 } : x));
                        setA({ ...a, items: nextItems } as any);
                      }}
                    />
                    <Button variant="danger" onClick={() => removeItem(it.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {laborRows.length === 0 ? <div className="muted">No labor lines.</div> : null}
          </div>
        </div>

{totals ? (
          <div className="mt">
            <div className="muted small">Cost & Pricing Breakdown</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="pill">Actual Labor: {Math.round(Number((totals as any).labor_minutes_actual ?? 0))} min</div>
              <div className="pill">Expected Labor: {Math.round(Number((totals as any).labor_minutes_expected ?? 0))} min</div>
              <div className="pill">Material Cost: ${Number((totals as any).material_cost ?? 0).toFixed(2)}</div>
              <div className="pill">Material Price: ${Number((totals as any).material_price ?? 0).toFixed(2)}</div>
              <div className="pill">Labor Price: ${Number((totals as any).labor_price ?? 0).toFixed(2)}</div>
              <div className="pill">Total: ${Number((totals as any).total ?? 0).toFixed(2)}</div>
              {totals.gross_margin_target_percent != null ? (
                <div className="pill">Target GM: {Number((totals as any).gross_margin_target_percent ?? 0).toFixed(0)}%</div>
              ) : null}
              {totals.gross_margin_expected_percent != null ? (
                <div className="pill">Expected GM: {Number((totals as any).gross_margin_expected_percent ?? 0).toFixed(0)}%</div>
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




