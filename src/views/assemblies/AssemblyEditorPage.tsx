import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getMaterialLaborMinutes(mat: any): number {
  // Support multiple historical field names.
  // Some schemas store hours + minutes.
  const hours = toNum(mat?.labor_hours ?? mat?.labor_time_hours, 0);

  // When hours are present, treat the "minutes" field as the remainder minutes.
  // When hours are NOT present, treat the "minutes" field as total minutes.
  const minsField = mat?.labor_minutes ?? mat?.labor_time_minutes ?? mat?.labor_mins;
  const mins = toNum(minsField, 0);

  if (hours > 0) return Math.max(0, Math.floor(hours * 60 + mins));
  return Math.max(0, Math.floor(mins));
}

function getMaterialUnitCost(mat: any): { chosen: number; usingCustom: boolean } {
  const base = toNum(mat?.base_cost ?? mat?.unit_cost ?? mat?.material_cost, 0);
  const useCustom = Boolean(mat?.use_custom_cost);
  const customRaw = mat?.custom_cost;
  const custom = customRaw == null ? null : toNum(customRaw, null as any);
  if (useCustom && custom != null && Number.isFinite(custom)) return { chosen: custom, usingCustom: true };
  return { chosen: base, usingCustom: false };
}

function fmtLaborHM(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes || 0)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function splitHM(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes || 0)));
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

export function AssemblyEditorPage() {
  const { assemblyId, libraryType } = useParams();
  const data = useData();
  // NOTE: In this codebase, the DataContext value has previously changed identity between renders.
  // That can unintentionally re-trigger effects that include `data` in their dependency array,
  // causing editor state (like the name field) to be overwritten by a fresh fetch.
  // Using a ref keeps the latest provider while keeping the "load on enter / on return" effect stable.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const nav = useNavigate();
  const location = useLocation();
  const { setMode } = useSelection();
  const dialogs = useDialogs();

  const [a, setA] = useState<Assembly | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
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
    const asm = await dataRef.current.getAssembly(id);
    setA(asm);
    setLaborMinutesText(asm?.labor_minutes == null ? '' : String(asm.labor_minutes));
  }

  useEffect(() => {
    if (!assemblyId) return;
    refreshAssembly(assemblyId).catch((e) => {
      console.error(e);
      setStatus(String((e as any)?.message ?? e));
    });
    // Also re-fetch when navigating back from picker flows.
  }, [assemblyId, location.key]);

  const materialRows = useMemo<AssemblyMaterialRow[]>(() => {
    const items = (a?.items ?? []) as any[];
    return items
      // Items can come from different providers:
      // - UI-created: { type: 'material', material_id: ... }
      // - Supabase:   { item_type: 'material', material_id: ... }
      .filter((it) => (it.type ?? it.item_type) === 'material' && (it.material_id ?? it.materialId))
      .map((it) => ({
        itemId: it.id,
        materialId: it.material_id ?? it.materialId,
        quantity: Number(it.quantity ?? 1) || 1,
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
          next[id] = await dataRef.current.getMaterial(id);
        } catch {
          next[id] = null;
        }
      }
      if (!cancelled) setMaterialCache((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [materialRows, materialCache]);

  const totals = useMemo(() => {
    if (!a || !companySettings) return null;
    const jobTypesById = Object.fromEntries(jobTypes.map((j) => [j.id, j]));
    // Normalize materials so pricing can consistently read expected fields.
    const materialsById = Object.fromEntries(
      Object.entries(materialCache)
        .filter(([, v]) => v)
        .map(([k, v]) => {
          const m: any = v;
          const labor_minutes = getMaterialLaborMinutes(m);
          const base_cost = toNum(m?.base_cost ?? m?.unit_cost ?? m?.material_cost, 0);
          return [k, { ...m, labor_minutes, base_cost }];
        })
    ) as any;

    return computeAssemblyPricing({
      assembly: a,
      items: ((a as any).items ?? []) as any,
      materialsById,
      jobTypesById,
      companySettings,
    });
  }, [a, companySettings, jobTypes, materialCache]);

  async function save(next: Assembly) {
    if (saving) return;
    try {
      setSaving(true);
      setStatus('Saving…');
      const saved = await data.upsertAssembly(next);
      setA(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  function updateItem(id: string, patch: Record<string, any>) {
    if (!a) return;
    const nextItems = (a.items ?? []).map((x: any) => (x.id === id ? { ...x, ...patch } : x));
    setA({ ...a, items: nextItems } as any);
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

  function updateItemQuantity(itemId: string, quantity: number) {
    if (!a) return;
    const nextItems = (a.items ?? []).map((it: any) => (it.id === itemId ? { ...it, quantity } : it));
    setA({ ...a, items: nextItems } as any);
  }

  function removeItem(itemId: string) {
    if (!a) return;
    const nextItems = (a.items ?? []).filter((it: any) => it.id !== itemId);
    setA({ ...a, items: nextItems } as any);
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
            <Button
              onClick={() => {
                // Prefer returning to the exact folder path the user came from.
                // (Avoids "folders/assemblies vanished" drift when Back always goes to root.)
                const st: any = (location as any)?.state;
                const returnTo = typeof st?.returnTo === 'string' ? st.returnTo : null;
                if (returnTo && returnTo.startsWith('/assemblies/')) {
                  nav(returnTo);
                  return;
                }
                // Fallback: return to the assemblies library (not browser history),
                // because picker flows push `/materials` into history.
                nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}`);
              }}
            >
              Back
            </Button>
            <Button onClick={duplicate}>Duplicate</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            {a.use_admin_rules ? <Button onClick={applyAdminRules}>Apply Changes</Button> : null}
            <Button variant="primary" onClick={saveAll} disabled={saving}>
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
              value={String(Boolean((a as any).customer_supplied_materials ?? (a as any).customer_supplies_materials))}
              onChange={(ev) => {
                const v = ev.target.value === 'true';
                // Keep both spellings in sync to prevent save/reload drift.
                setA({ ...a, customer_supplied_materials: v, customer_supplies_materials: v } as any);
              }}
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
              const lt = libraryType === 'app' ? 'app' : 'user';
              setMode({ type: 'add-materials-to-assembly', assemblyId: a.id, returnTo: `/assemblies/${lt}/${a.id}` });
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

              const { chosen: chosenCost, usingCustom } = getMaterialUnitCost(mat as any);
              const taxable = Boolean((mat as any)?.taxable);
              const laborMins = getMaterialLaborMinutes(mat as any);

              const jtId = (mat as any)?.job_type_id ?? null;
              const jtName = jtId ? jobTypes.find((j: any) => j.id === jtId)?.name : null;
              return (
                <div key={r.itemId} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{mat?.name ?? `Material ${r.materialId}`}</div>
                    <div className="listSub">{mat?.description ?? '—'}</div>
                    <div className="listSub">
                      Labor: {fmtLaborHM(laborMins)} • Cost: ${chosenCost.toFixed(2)}
                      {usingCustom ? ' (custom)' : ' (base)'} • Taxable: {taxable ? 'Yes' : 'No'} • Job Type: {jtName ?? '(None)'}
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
                  <div className="row mt" style={{ gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                    <div className="stack" style={{ width: 120 }}>
                      <div className="muted small">Unit Cost ($)</div>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        // Allow blank while editing; normalize on blur.
                        value={it._ui_unit_cost_text ?? (it.unit_cost == null ? '' : String(it.unit_cost))}
                        onChange={(e) => updateItem(it.id, { _ui_unit_cost_text: e.target.value })}
                        onBlur={() => {
                          const raw = String(it._ui_unit_cost_text ?? '');
                          const trimmed = raw.trim();
                          const v = trimmed === '' ? 0 : Number(trimmed);
                          updateItem(it.id, {
                            unit_cost: Number.isFinite(v) ? v : 0,
                            _ui_unit_cost_text: undefined,
                          });
                        }}
                      />
                    </div>

                    <div className="stack">
                      <div className="muted small">Taxable</div>
                      <Toggle
                        checked={Boolean(it.taxable)}
                        onChange={(v) => {
                          const nextItems = (a.items ?? []).map((x: any) => (x.id === it.id ? { ...x, taxable: v } : x));
                          setA({ ...a, items: nextItems } as any);
                        }}
                        label={it.taxable ? 'Yes' : 'No'}
                      />
                    </div>

                    <div className="stack" style={{ width: 110 }}>
                      <div className="muted small">Quantity</div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={String(it.quantity ?? 1)}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value || 1));
                          const nextItems = (a.items ?? []).map((x: any) =>
                            x.id === it.id ? { ...x, quantity: Number.isFinite(q) ? q : 1 } : x
                          );
                          setA({ ...a, items: nextItems } as any);
                        }}
                      />
                    </div>

                    <div className="stack" style={{ width: 200 }}>
                      <div className="muted small">Labor</div>
                      {(() => {
                        const { h, m } = splitHM(it.labor_minutes ?? 0);
                        const hText = it._ui_labor_h_text ?? (h ? String(h) : '');
                        const mText = it._ui_labor_m_text ?? (m ? String(m) : '');
                        const commit = () => {
                          const hh = (String(it._ui_labor_h_text ?? '').trim() === '' ? 0 : Number(it._ui_labor_h_text));
                          const mm = (String(it._ui_labor_m_text ?? '').trim() === '' ? 0 : Number(it._ui_labor_m_text));
                          const hhSafe = Number.isFinite(hh) ? Math.max(0, Math.floor(hh)) : 0;
                          const mmSafe = Number.isFinite(mm) ? Math.max(0, Math.floor(mm)) : 0;
                          updateItem(it.id, {
                            labor_minutes: hhSafe * 60 + mmSafe,
                            _ui_labor_h_text: undefined,
                            _ui_labor_m_text: undefined,
                          });
                        };
                        return (
                          <div className="row" style={{ gap: 8 }}>
                            <Input
                              style={{ width: 90 }}
                              type="text"
                              inputMode="numeric"
                              placeholder="Hours"
                              value={hText}
                              onChange={(e) => updateItem(it.id, { _ui_labor_h_text: e.target.value })}
                              onBlur={commit}
                            />
                            <Input
                              style={{ width: 90 }}
                              type="text"
                              inputMode="numeric"
                              placeholder="Minutes"
                              value={mText}
                              onChange={(e) => updateItem(it.id, { _ui_labor_m_text: e.target.value })}
                              onBlur={commit}
                            />
                          </div>
                        );
                      })()}
                    </div>

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
                  <div className="row mt" style={{ gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                    <div className="stack" style={{ width: 110 }}>
                      <div className="muted small">Quantity</div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={String(it.quantity ?? 1)}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value || 1));
                          const nextItems = (a.items ?? []).map((x: any) =>
                            x.id === it.id ? { ...x, quantity: Number.isFinite(q) ? q : 1 } : x
                          );
                          setA({ ...a, items: nextItems } as any);
                        }}
                      />
                    </div>

                    <div className="stack" style={{ width: 220 }}>
                      <div className="muted small">Labor</div>
                      {(() => {
                        const { h, m } = splitHM(it.labor_minutes ?? 0);
                        const hText = it._ui_labor_h_text ?? (h ? String(h) : '');
                        const mText = it._ui_labor_m_text ?? (m ? String(m) : '');
                        const commit = () => {
                          const hh = (String(it._ui_labor_h_text ?? '').trim() === '' ? 0 : Number(it._ui_labor_h_text));
                          const mm = (String(it._ui_labor_m_text ?? '').trim() === '' ? 0 : Number(it._ui_labor_m_text));
                          const hhSafe = Number.isFinite(hh) ? Math.max(0, Math.floor(hh)) : 0;
                          const mmSafe = Number.isFinite(mm) ? Math.max(0, Math.floor(mm)) : 0;
                          updateItem(it.id, {
                            labor_minutes: hhSafe * 60 + mmSafe,
                            _ui_labor_h_text: undefined,
                            _ui_labor_m_text: undefined,
                          });
                        };
                        return (
                          <div className="row" style={{ gap: 8 }}>
                            <Input
                              style={{ width: 100 }}
                              type="text"
                              inputMode="numeric"
                              placeholder="Hours"
                              value={hText}
                              onChange={(e) => updateItem(it.id, { _ui_labor_h_text: e.target.value })}
                              onBlur={commit}
                            />
                            <Input
                              style={{ width: 100 }}
                              type="text"
                              inputMode="numeric"
                              placeholder="Minutes"
                              value={mText}
                              onChange={(e) => updateItem(it.id, { _ui_labor_m_text: e.target.value })}
                              onBlur={commit}
                            />
                          </div>
                        );
                      })()}
                    </div>

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
            {(() => {
              // computeAssemblyPricing returns:
              // - labor_minutes_total: expected minutes (efficiency-adjusted + min labor when flat-rate)
              // - material_cost_total / material_price_total / labor_price_total / misc_material_price / total_price
              // Lines keep raw labor_minutes (baseline) so we can show both.
              const t: any = totals;
              const baselineMinutes = Math.round(
                (Array.isArray(t.lines) ? t.lines : []).reduce((sum: number, ln: any) => sum + (Number(ln?.labor_minutes ?? 0) || 0), 0)
              );
              const expectedMinutes = Math.round(Number(t.labor_minutes_total ?? 0) || 0);
              const materialCost = Number(t.material_cost_total ?? 0) || 0;
              const materialPrice = Number(t.material_price_total ?? 0) || 0;
              const laborPrice = Number(t.labor_price_total ?? 0) || 0;
              const misc = Number(t.misc_material_price ?? 0) || 0;
              const total = Number(t.total_price ?? 0) || 0;

              return (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <div className="pill">Actual Labor: {baselineMinutes} min</div>
                  <div className="pill">Expected Labor: {expectedMinutes} min</div>
                  <div className="pill">Material Cost: ${materialCost.toFixed(2)}</div>
                  <div className="pill">Material Price: ${materialPrice.toFixed(2)}</div>
                  <div className="pill">Labor Price: ${laborPrice.toFixed(2)}</div>
                  <div className="pill">Misc Material: ${misc.toFixed(2)}</div>
                  <div className="pill">Total: ${total.toFixed(2)}</div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="mt muted small">Totals will appear after Company Setup loads.</div>
        )}

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

