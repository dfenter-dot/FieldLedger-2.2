import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Estimate, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';
import { computeEstimatePricing } from '../../providers/data/pricing';
import { TechCostBreakdownCard } from '../shared/TechCostBreakdownCard';

type ItemRow =
  | { id: string; type: 'material'; materialId: string; quantity: number }
  | { id: string; type: 'assembly'; assemblyId: string; quantity: number }
  | { id: string; type: 'labor'; name: string; minutes: number };

function toNum(raw: unknown, fallback = 0) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeFixed(v: any, digits = 2) {
  const n = toNum(v, 0);
  return n.toFixed(digits);
}

export function EstimateEditorPage() {
  const { estimateId } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();
  const dialogs = useDialogs();

  const [e, setE] = useState<Estimate | null>(null);
  const [status, setStatus] = useState('');
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  // Load admin/config data used by dropdowns and calculations.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, jts] = await Promise.all([data.getCompanySettings(), data.listJobTypes()]);
        if (!cancelled) {
          setCompanySettings(s);
          setJobTypes(jts);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!estimateId) return;

    if (estimateId === 'new') {
      (async () => {
        try {
          setStatus('Creating…');
          const settings = await data.getCompanySettings();
          const starting = Number((settings as any)?.starting_estimate_number ?? 1) || 1;
          const existing = await data.listEstimates();
          const maxNum = existing.reduce((m, r) => Math.max(m, Number((r as any).estimate_number ?? 0) || 0), 0);
          const nextNum = Math.max(starting, maxNum + 1);

          const draft: Estimate = {
            id: crypto.randomUUID?.() ?? `est_${Date.now()}`,
            company_id: null,
            name: 'New Estimate',
            estimate_number: nextNum,
            job_type_id: null,
            use_admin_rules: false,
            customer_supplies_materials: false,
            apply_discount: false,
            apply_processing_fees: false,
            apply_misc_material: true,
            // discount_percent is optional and may be null/undefined; provider can persist it if supported.
            items: [],
            status: 'draft',
            created_at: new Date().toISOString(),
          } as any;

          // Persist immediately so selection flows work.
          const saved = await data.upsertEstimate(draft as any);
          setE(saved);
          setStatus('');
          nav(`/estimates/${saved.id}`, { replace: true });
        } catch (err: any) {
          console.error(err);
          setStatus(String(err?.message ?? err));
        }
      })();
      return;
    }

    data
      .getEstimate(estimateId)
      .then(setE)
      .catch((err) => {
        console.error(err);
        setStatus(String((err as any)?.message ?? err));
      });
  }, [data, estimateId, nav]);

  const rows = useMemo<ItemRow[]>(() => {
    const items: any[] = ((e as any)?.items ?? []) as any[];

    return items
      .map((it: any) => {
        // Material line
        if (it.material_id) {
          return {
            id: it.id,
            type: 'material' as const,
            materialId: it.material_id,
            quantity: Math.max(1, toNum(it.quantity ?? 1, 1)),
          };
        }

        // Assembly line
        if (it.assembly_id) {
          return {
            id: it.id,
            type: 'assembly' as const,
            assemblyId: it.assembly_id,
            quantity: Math.max(1, toNum(it.quantity ?? 1, 1)),
          };
        }

        // Labor line: support either item_type/type flag OR presence of labor_minutes
        const itemType = String(it.item_type ?? it.type ?? '').toLowerCase();
        const isLabor =
          itemType === 'labor' ||
          it.labor_minutes != null ||
          it.laborMinutes != null ||
          (it.name && it.minutes != null && !it.material_id && !it.assembly_id);

        if (isLabor) {
          const mins = Math.max(0, Math.floor(toNum(it.labor_minutes ?? it.laborMinutes ?? it.minutes ?? 0, 0)));
          return {
            id: it.id,
            type: 'labor' as const,
            name: String(it.name ?? 'Labor'),
            minutes: mins,
          };
        }

        return null;
      })
      .filter(Boolean) as ItemRow[];
  }, [e]);

  const [materialCache, setMaterialCache] = useState<Record<string, Material | null>>({});
  const [assemblyCache, setAssemblyCache] = useState<Record<string, Assembly | null>>({});

  useEffect(() => {
    const missingMats = rows
      .filter((r) => r.type === 'material')
      .map((r) => (r as any).materialId as string)
      .filter((id) => materialCache[id] === undefined);

    if (missingMats.length === 0) return;

    let cancelled = false;
    (async () => {
      const next: Record<string, Material | null> = {};
      for (const id of missingMats) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rows, materialCache]);

  useEffect(() => {
    const missingAsm = rows
      .filter((r) => r.type === 'assembly')
      .map((r) => (r as any).assemblyId as string)
      .filter((id) => assemblyCache[id] === undefined);

    if (missingAsm.length === 0) return;

    let cancelled = false;
    (async () => {
      const next: Record<string, Assembly | null> = {};
      for (const id of missingAsm) {
        try {
          next[id] = await data.getAssembly(id);
        } catch {
          next[id] = null;
        }
      }
      if (!cancelled) setAssemblyCache((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rows, assemblyCache]);

  const totals = useMemo(() => {
    if (!e || !companySettings) return null;
    const jobTypesById = Object.fromEntries((jobTypes ?? []).map((j) => [j.id, j]));
    try {
      return computeEstimatePricing({
        estimate: e as any,
        materialsById: materialCache,
        assembliesById: assemblyCache,
        jobTypesById,
        companySettings,
      } as any);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [e, companySettings, jobTypes, materialCache, assemblyCache]);

  const selectedJobType = useMemo(() => {
    if (!e) return null;
    const byId = Object.fromEntries((jobTypes ?? []).map((j) => [j.id, j]));
    const direct = (e as any).job_type_id ? byId[(e as any).job_type_id] : null;
    if (direct) return direct;
    const def = (jobTypes ?? []).find((j) => (j as any).is_default || (j as any).isDefault);
    return def ?? null;
  }, [e, jobTypes]);


  async function save(next: Estimate) {
    try {
      setStatus('Saving…');
      const saved = await data.upsertEstimate(next);
      setE(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1200);
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  async function saveAll() {
    if (!e) return;
    await save(e);
  }

  async function removeEstimate() {
    if (!e) return;
    const ok = await dialogs.confirm({
      title: 'Delete Estimate',
      message: 'Delete this estimate? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      setStatus('Deleting…');
      await data.deleteEstimate((e as any).id);
      nav('/estimates');
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!e) return;
    const nextItems = ((e as any).items ?? []).map((it: any) => (it.id === itemId ? { ...it, quantity } : it));
    await save({ ...(e as any), items: nextItems } as any);
  }

  async function updateLaborMinutes(itemId: string, minutes: number) {
    if (!e) return;
    const nextItems = ((e as any).items ?? []).map((it: any) =>
      it.id === itemId ? { ...it, labor_minutes: minutes, laborMinutes: minutes, minutes } : it,
    );
    await save({ ...(e as any), items: nextItems } as any);
  }

  async function removeItem(itemId: string) {
    if (!e) return;
    const nextItems = ((e as any).items ?? []).filter((it: any) => it.id !== itemId);
    await save({ ...(e as any), items: nextItems } as any);
  }

  if (!e) return <div className="muted">Loading…</div>;

  const isLocked = String((e as any).status ?? 'draft') === 'approved';

  const jobTypeOptions = (jobTypes ?? []).filter((j: any) => j.enabled !== false);
  const defaultJobTypeId = (jobTypes ?? []).find((j: any) => j.is_default)?.id ?? null;
  const effectiveJobTypeId = (e as any).job_type_id ?? defaultJobTypeId;
  const activeJobType = (jobTypes ?? []).find((j: any) => j.id === effectiveJobTypeId) ?? null;

  const allowDiscounts = activeJobType?.allow_discounts !== false;

  const maxDiscountPercent = toNum(companySettings?.default_discount_percent ?? companySettings?.discount_percent_default ?? 10, 10);

  async function applyAdminRules() {
    if (!e || isLocked || !(e as any).use_admin_rules) return;
    try {
      setStatus('Applying rules...');
      const rules = await data.listAdminRules();
      const match = (rules as any[])
        .filter((r) => r.enabled && r.applies_to === 'estimate' && (r.match_text ?? '').trim().length > 0)
        .sort((a, b) => a.priority - b.priority)
        .find((r) => String((e as any).name ?? '').toLowerCase().includes(String(r.match_text).toLowerCase()));

      if (match?.set_job_type_id) {
        const next = { ...(e as any), job_type_id: match.set_job_type_id } as any;
        const saved = await data.upsertEstimate(next);
        setE(saved as any);
        setStatus('Rules applied.');
      } else {
        setStatus('No matching rules.');
      }

      setTimeout(() => setStatus(''), 1200);
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  return (
    <div className="stack">
      <Card
        title={`Estimate • #${(e as any).estimate_number} • ${(e as any).name}`}
        right={
          <div className="row">
            <Button onClick={() => nav('/estimates')}>Back</Button>
            <Button variant="secondary" onClick={() => nav(`/estimates/${(e as any).id}/preview`)}>
              Customer View
            </Button>
            <Button variant="danger" onClick={removeEstimate}>
              Delete
            </Button>
            {(e as any).use_admin_rules && !isLocked ? <Button onClick={applyAdminRules}>Apply Changes</Button> : null}
            <Button variant="primary" onClick={saveAll}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Estimate Name</label>
            <Input
              disabled={isLocked}
              value={(e as any).name ?? ''}
              onChange={(ev) => setE({ ...(e as any), name: ev.target.value } as any)}
            />
          </div>

          <div className="stack">
            <label className="label">Use Admin Rules</label>
            <Toggle
              checked={Boolean((e as any).use_admin_rules)}
              onChange={(v) => setE({ ...(e as any), use_admin_rules: v } as any)}
              label={(e as any).use_admin_rules ? 'Yes (locks job type)' : 'No'}
            />
          </div>

          <div className="stack">
            <label className="label">Job Type</label>
            <select
              className="input"
              disabled={isLocked || Boolean((e as any).use_admin_rules)}
              value={effectiveJobTypeId ?? ''}
              onChange={(ev) => setE({ ...(e as any), job_type_id: ev.target.value || null } as any)}
            >
              <option value="">(Select)</option>
              {jobTypeOptions.map((jt: any) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name}
                </option>
              ))}
            </select>
            {!((e as any).job_type_id) && defaultJobTypeId ? (
              <div className="muted small">Using default job type until you select one.</div>
            ) : null}
          </div>

          <div className="stack">
            <label className="label">Customer Supplies Materials</label>
            <select
              className="input"
              disabled={isLocked}
              value={String(Boolean((e as any).customer_supplies_materials))}
              onChange={(ev) => setE({ ...(e as any), customer_supplies_materials: ev.target.value === 'true' } as any)}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          <div className="stack">
            <label className="label">Apply Misc Material</label>
            <select
              className="input"
              disabled={isLocked}
              value={String(Boolean((e as any).apply_misc_material))}
              onChange={(ev) => setE({ ...(e as any), apply_misc_material: ev.target.value === 'true' } as any)}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          <div className="stack">
            <label className="label">Apply Processing Fees</label>
            <select
              className="input"
              disabled={isLocked}
              value={String(Boolean((e as any).apply_processing_fees))}
              onChange={(ev) => setE({ ...(e as any), apply_processing_fees: ev.target.value === 'true' } as any)}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          {/* Discount: toggle + capped percent input */}
          <div className="stack">
            <label className="label">Apply Discount</label>
            <Toggle
              checked={Boolean((e as any).apply_discount) && allowDiscounts}
              onChange={(v) => {
                if (!allowDiscounts) return;
                const next: any = { ...(e as any), apply_discount: v };
                // If turning off, clear discount_percent so pricing doesn't accidentally use it.
                if (!v) next.discount_percent = null;
                setE(next);
              }}
              label={!allowDiscounts ? 'Disabled by job type' : (e as any).apply_discount ? 'Yes' : 'No'}
            />
            {!allowDiscounts ? <div className="muted small">Discounts are disabled for this job type.</div> : null}
          </div>

          <div className="stack">
            <label className="label">Discount %</label>
            <Input
              disabled={isLocked || !allowDiscounts || !Boolean((e as any).apply_discount)}
              type="text"
              inputMode="decimal"
              value={String((e as any).discount_percent ?? '')}
              placeholder={String(maxDiscountPercent)}
              onChange={(ev) => {
                if (!allowDiscounts) return;
                const raw = ev.target.value;
                if (raw.trim() === '') {
                  setE({ ...(e as any), discount_percent: null } as any);
                  return;
                }
                const n = toNum(raw, 0);
                const capped = clamp(n, 0, maxDiscountPercent);
                setE({ ...(e as any), discount_percent: capped } as any);
              }}
            />
            <div className="muted small">
              Max allowed: {maxDiscountPercent}%{Boolean((e as any).apply_discount) ? '' : ' (turn on Apply Discount to edit)'}
            </div>
          </div>
        </div>

        <div className="mt" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          <div className="stack">
            <label className="label">Customer Name</label>
            <Input
              disabled={isLocked}
              value={(e as any).customer_name ?? ''}
              onChange={(ev) => setE({ ...(e as any), customer_name: ev.target.value || null } as any)}
            />
          </div>
          <div className="stack">
            <label className="label">Customer Phone</label>
            <Input
              disabled={isLocked}
              value={(e as any).customer_phone ?? ''}
              onChange={(ev) => setE({ ...(e as any), customer_phone: ev.target.value || null } as any)}
            />
          </div>
          <div className="stack">
            <label className="label">Customer Email</label>
            <Input
              disabled={isLocked}
              value={(e as any).customer_email ?? ''}
              onChange={(ev) => setE({ ...(e as any), customer_email: ev.target.value || null } as any)}
            />
          </div>
          <div className="stack">
            <label className="label">Customer Address</label>
            <Input
              disabled={isLocked}
              value={(e as any).customer_address ?? ''}
              onChange={(ev) => setE({ ...(e as any), customer_address: ev.target.value || null } as any)}
            />
          </div>
          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Private Notes</label>
            <Input
              disabled={isLocked}
              value={(e as any).private_notes ?? ''}
              onChange={(ev) => setE({ ...(e as any), private_notes: ev.target.value || null } as any)}
            />
          </div>
        </div>

        <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            disabled={!e || isLocked}
            onClick={async () => {
              // NOTE: This duplicates the estimate for now (historical behavior).
              // Proper multi-option UI will be added after we verify estimates are stable.
              const copy = await data.upsertEstimate({
                ...(e as any),
                id: crypto.randomUUID?.() ?? `est_${Date.now()}`,
                estimate_number: (e as any).estimate_number,
                name: `${(e as any).name} (Copy)`,
                status: 'draft',
                sent_at: null,
                approved_at: null,
                declined_at: null,
                created_at: new Date().toISOString(),
              } as any);
              nav(`/estimates/${(copy as any).id}`);
            }}
          >
            Duplicate Estimate
          </Button>

          <Button
            variant="primary"
            disabled={isLocked}
            onClick={() => {
              setMode({ type: 'add-materials-to-estimate', estimateId: (e as any).id });
              nav('/materials');
            }}
          >
            Add Materials
          </Button>

          <Button
            variant="primary"
            disabled={isLocked}
            onClick={() => {
              setMode({ type: 'add-assemblies-to-estimate', estimateId: (e as any).id });
              nav('/assemblies');
            }}
          >
            Add Assemblies
          </Button>

          <Button
            variant="secondary"
            disabled={isLocked}
            onClick={() => {
              // Create a user material while staying in picker mode, so it can be added immediately after save.
              setMode({ type: 'add-materials-to-estimate', estimateId: (e as any).id });
              nav('/materials/user/new');
            }}
          >
            Create Material
          </Button>

          <Button
            variant="secondary"
            disabled={isLocked}
            onClick={() => {
              const min = Math.max(0, Math.floor(toNum(companySettings?.minimum_labor_minutes_per_job ?? 30, 30)));
              const next = {
                id: crypto.randomUUID?.() ?? `labor_${Date.now()}`,
                item_type: 'labor',
                type: 'labor',
                name: 'Labor',
                labor_minutes: min,
                quantity: 1,
              };
              setE({ ...(e as any), items: [...(((e as any).items ?? []) as any[]), next] } as any);
            }}
          >
            Add Labor Line
          </Button>

          <Button
            onClick={() => setE({ ...(e as any), status: 'sent', sent_at: new Date().toISOString() } as any)}
            disabled={isLocked || String((e as any).status ?? 'draft') !== 'draft'}
          >
            Mark Sent
          </Button>

          <Button
            onClick={() => setE({ ...(e as any), status: 'approved', approved_at: new Date().toISOString() } as any)}
            disabled={isLocked || String((e as any).status ?? 'draft') === 'declined'}
          >
            Approve
          </Button>

          <Button
            variant="danger"
            onClick={() => setE({ ...(e as any), status: 'declined', declined_at: new Date().toISOString() } as any)}
            disabled={isLocked}
          >
            Decline
          </Button>
        </div>

        <div className="mt">
          <div className="muted small">Line Items</div>
          <div className="list">
            {rows.map((r) => {
              const title =
                r.type === 'labor'
                  ? (r as any).name ?? 'Labor'
                  : r.type === 'material'
                    ? materialCache[(r as any).materialId]?.name ?? `Material ${(r as any).materialId}`
                    : assemblyCache[(r as any).assemblyId]?.name ?? `Assembly ${(r as any).assemblyId}`;

              const sub =
                r.type === 'labor'
                  ? `${Math.max(0, Math.floor((r as any).minutes ?? 0))} min`
                  : r.type === 'material'
                    ? (() => {
                        const m = materialCache[(r as any).materialId] as any;
                        const parts: string[] = [];
                        if (m?.sku) parts.push(String(m.sku));
                        if (m?.description) parts.push(String(m.description));
                        const laborMinutes = Math.max(
                          0,
                          Math.floor(toNum(m?.labor_hours ?? m?.laborHours ?? 0, 0) * 60 + toNum(m?.labor_minutes ?? m?.laborMinutes ?? 0, 0)),
                        );
                        if (laborMinutes > 0) parts.push(`Labor: ${laborMinutes} min`);
                        return parts.length ? parts.join(' • ') : '—';
                      })()
                    : (() => {
                        const a: any = assemblyCache[(r as any).assemblyId];
                        const parts: string[] = [];
                        const count = a?.item_count ?? (a?.items ? a.items.length : null);
                        if (count != null) parts.push(`${count} items`);
                        if (a?.description) parts.push(String(a.description));
                        return parts.length ? parts.join(' • ') : '—';
                      })();

              return (
                <div key={r.id} className="listRow">
                  <div className="listMain">
                    <div className="listTitle">{title}</div>
                    <div className="listSub">{sub}</div>
                  </div>

                  <div className="listRight" style={{ gap: 8 }}>
                    {r.type === 'labor' ? (
                      <Input
                        style={{ width: 110 }}
                        type="text"
                        inputMode="numeric"
                        value={String((r as any).minutes ?? 0)}
                        onChange={(ev) => {
                          const mins = Math.max(0, Math.floor(toNum(ev.target.value, 0)));
                          updateLaborMinutes(r.id, mins);
                        }}
                      />
                    ) : (
                      <Input
                        style={{ width: 90 }}
                        type="text"
                        inputMode="numeric"
                        value={String((r as any).quantity ?? 1)}
                        onChange={(ev) => {
                          const q = Math.max(1, Math.floor(toNum(ev.target.value, 1)));
                          updateQuantity(r.id, q);
                        }}
                      />
                    )}

                    <Button variant="danger" onClick={() => removeItem(r.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 ? <div className="muted">No line items yet.</div> : null}
          </div>
        </div>

        {totals ? (
          <div className="mt">
            <div className="muted small">Cost & Pricing Breakdown</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="pill">Actual Labor: {Math.round(toNum((totals as any).labor_minutes_actual, 0))} min</div>
              <div className="pill">Expected Labor: {Math.round(toNum((totals as any).labor_minutes_expected, 0))} min</div>

              <div className="pill">Material Cost: ${safeFixed((totals as any).material_cost)}</div>
              <div className="pill">Material Price: ${safeFixed((totals as any).material_price)}</div>
              <div className="pill">Labor Price: ${safeFixed((totals as any).labor_price)}</div>

              {toNum((totals as any).discount_percent, 0) > 0 ? (
                <div className="pill">
                  Pre-Discount: ${safeFixed((totals as any).pre_discount_total)} (−${safeFixed((totals as any).discount_amount)})
                </div>
              ) : null}

              <div className="pill">Subtotal: ${safeFixed((totals as any).subtotal_before_processing)}</div>
              <div className="pill">Processing: ${safeFixed((totals as any).processing_fee)}</div>
              <div className="pill">Total: ${safeFixed((totals as any).total)}</div>

              {(totals as any).gross_margin_target_percent != null ? (
                <div className="pill">Target GM: {toNum((totals as any).gross_margin_target_percent, 0).toFixed(0)}%</div>
              ) : null}
              {(totals as any).gross_margin_expected_percent != null ? (
                <div className="pill">Expected GM: {toNum((totals as any).gross_margin_expected_percent, 0).toFixed(0)}%</div>
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

