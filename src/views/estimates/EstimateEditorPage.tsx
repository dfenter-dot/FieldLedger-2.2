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

type ItemRow =
  | {
      id: string;
      type: 'material';
      materialId: string;
      quantity: number;
      name?: string | null;
      description?: string | null;
      laborMinutes?: number | null;
    }
  | {
      id: string;
      type: 'assembly';
      assemblyId: string;
      quantity: number;
      name?: string | null;
      description?: string | null;
    }
  | { id: string; type: 'labor'; name: string; minutes: number };

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

  useEffect(() => {
    // Load admin/config data used by dropdowns and calculations.
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
          const maxNum = existing.reduce((m, r) => Math.max(m, Number(r.estimate_number ?? 0) || 0), 0);
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
  }, [data, estimateId]);

  useEffect(() => {
    data.getCompanySettings().then(setCompanySettings).catch(() => {});
    data.listJobTypes().then(setJobTypes).catch(() => {});
  }, [data]);

  const rows = useMemo<ItemRow[]>(() => {
    const items = e?.items ?? [];
    return items
      .map((it: any) => {
        if (it.material_id) {
          return {
            id: it.id,
            type: 'material' as const,
            materialId: it.material_id,
            quantity: Number(it.quantity ?? 1) || 1,
          };
        }
        if (it.assembly_id) {
          return {
            id: it.id,
            type: 'assembly' as const,
            assemblyId: it.assembly_id,
            quantity: Number(it.quantity ?? 1) || 1,
          };
        }
        return null;
      })
      .filter(Boolean) as ItemRow[];
  }, [e?.items]);

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
  }, [data, rows, assemblyCache]);

  const totals = useMemo(() => {
    if (!e || !companySettings) return null;
    const jobTypesById = Object.fromEntries(jobTypes.map((j) => [j.id, j]));
    return computeEstimatePricing({
      estimate: e,
      materialsById: materialCache,
      assembliesById: assemblyCache,
      jobTypesById,
      companySettings,
    });
  }, [e, companySettings, jobTypes, materialCache, assemblyCache]);

  async function save(next: Estimate) {
    try {
      setStatus('Saving…');
      const saved = await data.upsertEstimate(next);
      setE(saved);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  async function saveAll() {
    if (!e) return;
    await save(e);
  }

  async function remove() {
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
      await data.deleteEstimate(e.id);
      nav('/estimates');
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!e) return;
    const nextItems = (e.items ?? []).map((it: any) => (it.id === itemId ? { ...it, quantity } : it));
    await save({ ...e, items: nextItems } as any);
  }

  async function updateLaborMinutes(itemId: string, minutes: number) {
    if (!e) return;
    const nextItems = (e.items ?? []).map((it: any) =>
      it.id === itemId ? { ...it, item_type: 'labor', type: 'labor', labor_minutes: minutes } : it
    );
    await save({ ...e, items: nextItems } as any);
  }

  async function removeItem(itemId: string) {
    if (!e) return;
    const nextItems = (e.items ?? []).filter((it: any) => it.id !== itemId);
    await save({ ...e, items: nextItems } as any);
  }

  if (!e) return <div className="muted">Loading…</div>;

  const isLocked = (e.status ?? 'draft') === 'approved';
  const jobTypeOptions = jobTypes.filter((j: any) => j.enabled !== false);
  const defaultJobTypeId = jobTypes.find((j: any) => j.is_default)?.id ?? null;
  const activeJobType = jobTypes.find((j: any) => j.id === (e.job_type_id ?? defaultJobTypeId));
  const allowDiscounts = activeJobType?.allow_discounts !== false;

  async function applyAdminRules() {
    if (!e || isLocked || !e.use_admin_rules) return;
    try {
      setStatus('Applying rules...');
      const rules = await data.listAdminRules();
      const match = rules
        .filter((r) => r.enabled && r.applies_to === 'estimate' && (r.match_text ?? '').trim().length > 0)
        .sort((a, b) => a.priority - b.priority)
        .find((r) => (e.name ?? '').toLowerCase().includes(String(r.match_text).toLowerCase()));

      if (match?.set_job_type_id) {
        const next = { ...e, job_type_id: match.set_job_type_id } as any;
        const saved = await data.upsertEstimate(next);
        setE(saved as any);
        setStatus('Rules applied.');
      } else {
        setStatus('No matching rules.');
      }
      setTimeout(() => setStatus(''), 1500);
    } catch (err: any) {
      console.error(err);
      setStatus(String(err?.message ?? err));
    }
  }

  return (
    <div className="stack">
      <Card
        title={`Estimate • #${e.estimate_number} • ${e.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav('/estimates')}>Back</Button>
            <Button variant="secondary" onClick={() => nav(`/estimates/${e.id}/preview`)}>
              Customer View
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            {e.use_admin_rules && !isLocked ? (
              <Button onClick={applyAdminRules}>Apply Changes</Button>
            ) : null}
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
                      style={{ width: 90 }}
                      type="text"
                      inputMode="numeric"
                      value={r.type === 'labor' ? String((r as any).minutes ?? 0) : String((r as any).quantity ?? 1)}
                      onChange={(ev) => {
                        const raw = ev.target.value;
                        const n = Math.max(0, Math.floor(Number(raw || 0)));
                        if (!Number.isFinite(n)) return;
                        if (r.type === 'labor') updateLaborMinutes(r.id, n);
                        else updateQuantity(r.id, Math.max(1, n || 1));
                      }}
                    />
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
              <div className="pill">Actual Labor: {Math.round(totals.labor_minutes_actual)} min</div>
              <div className="pill">Expected Labor: {Math.round(totals.labor_minutes_expected)} min</div>
              <div className="pill">Material Cost: ${totals.material_cost.toFixed(2)}</div>
              <div className="pill">Material Price: ${totals.material_price.toFixed(2)}</div>
              <div className="pill">Labor Price: ${totals.labor_price.toFixed(2)}</div>
              {totals.discount_percent > 0 ? (
                <div className="pill">
                  Pre-Discount: ${totals.pre_discount_total.toFixed(2)} (−${totals.discount_amount.toFixed(2)})
                </div>
              ) : null}
              <div className="pill">Subtotal: ${totals.subtotal_before_processing.toFixed(2)}</div>
              <div className="pill">Processing: ${totals.processing_fee.toFixed(2)}</div>
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



