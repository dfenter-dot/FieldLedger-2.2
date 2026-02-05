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

function toIntText(raw: string) {
  const s = (raw ?? '').trim();
  if (s === '') return '';
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0, n));
}

function toMoneyText(raw: string) {
  const s = (raw ?? '').trim();
  if (s === '') return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0, n));
}

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

  // Local edit buffer for quantities so users can backspace/replace without double-clicking.
  // Normalized to >= 1 on blur.
  const [qtyEdits, setQtyEdits] = useState<Record<string, string>>({});

  // Local edit buffer so numeric inputs can be blank while editing.
  // App-wide rule: backspacing should not require double-clicking.
  const [laborEdits, setLaborEdits] = useState<
    Record<string, { hours: string; minutes: string; description: string }>
  >({});

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

  // Keep local edit buffers in sync with loaded items.
  useEffect(() => {
    const laborRows = rows.filter((r) => r.type === 'labor') as any[];
    if (laborRows.length === 0) return;

    setLaborEdits((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of laborRows) {
        if (next[r.id]) continue;
        const total = Math.max(0, Math.floor(toNum(r.minutes ?? 0, 0)));
        const h = Math.floor(total / 60);
        const m = total % 60;
        next[r.id] = {
          hours: String(h),
          minutes: String(m),
          description: String((r as any).description ?? ''),
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const [materialCache, setMaterialCache] = useState<Record<string, Material | null>>({});
  const [assemblyCache, setAssemblyCache] = useState<Record<string, Assembly | null>>({});

  // Estimate-created materials always go into a dedicated User Materials folder.
  const ESTIMATE_CREATED_FOLDER_NAME = 'Estimate Created Materials';
  const [estimateCreatedFolderId, setEstimateCreatedFolderId] = useState<string | null>(null);
  const [showBlankMaterialCard, setShowBlankMaterialCard] = useState(false);
  const [blankMat, setBlankMat] = useState({
    name: '',
    sku: '',
    description: '',
    baseCostText: '',
    customCostText: '',
    useCustomCost: false,
    taxable: true,
    jobTypeId: '' as string | null,
    laborHoursText: '',
    laborMinutesText: '',
  });

  useEffect(() => {
    const missingMats = rows
      .filter((r) => r.type === 'material')
      .map((r) => ((r as any).materialId ?? (r as any).material_id) as string)
      .filter((id) => Boolean(id))
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
      .map((r) => ((r as any).assemblyId ?? (r as any).assembly_id) as string)
      .filter((id) => Boolean(id))
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

  const maxDiscountPercent = useMemo(() => {
    return toNum(companySettings?.default_discount_percent ?? companySettings?.discount_percent_default ?? 10, 10);
  }, [companySettings]);

  // Ensure estimate has a discount_percent value (prefilled from admin default) so
  // pre-discount subtotal preloading works even when Apply Discount is OFF.
  useEffect(() => {
    if (!e || !companySettings) return;
    const cur = (e as any).discount_percent;
    if (cur == null || cur === '') {
      // Only set if missing to avoid clobbering user edits.
      setE((prev) => {
        if (!prev) return prev;
        const prevCur = (prev as any).discount_percent;
        if (prevCur != null && prevCur !== '') return prev;
        return { ...(prev as any), discount_percent: maxDiscountPercent } as any;
      });
    }
  }, [e?.id, companySettings, maxDiscountPercent]);

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

	async function ensureEstimateCreatedFolder(): Promise<string | null> {
		if (estimateCreatedFolderId) return estimateCreatedFolderId;
		try {
			const folders = await data.listFolders({ kind: 'materials', libraryType: 'company', parentId: null });
			const found = (folders ?? []).find((f: any) => String(f?.name ?? '').trim() === ESTIMATE_CREATED_FOLDER_NAME);
			if (found?.id) {
				setEstimateCreatedFolderId(found.id);
				return found.id;
			}
			const created = await data.createFolder({ kind: 'materials', libraryType: 'company', parentId: null, name: ESTIMATE_CREATED_FOLDER_NAME });
			if (created?.id) {
				setEstimateCreatedFolderId(created.id);
				return created.id;
			}
			return null;
		} catch (err) {
			console.error(err);
			return null;
		}
	}

	async function saveBlankMaterialLine() {
		if (isLocked) return;
		const name = String(blankMat.name ?? '').trim();
		if (!name) {
			setStatus('Material name is required.');
			setTimeout(() => setStatus(''), 1500);
			return;
		}

		try {
			setStatus('Saving material…');
			const folderId = await ensureEstimateCreatedFolder();
			if (!folderId) {
				setStatus('Unable to create/find the folder for estimate materials.');
				setTimeout(() => setStatus(''), 2000);
				return;
			}

			const base_cost = blankMat.baseCostText.trim() === '' ? 0 : Number(blankMat.baseCostText);
			const custom_cost = blankMat.customCostText.trim() === '' ? null : Number(blankMat.customCostText);
			const laborHours = blankMat.laborHoursText.trim() === '' ? 0 : Number(blankMat.laborHoursText);
			const laborMinutes = blankMat.laborMinutesText.trim() === '' ? 0 : Number(blankMat.laborMinutesText);
			const labor_minutes =
				(Math.max(0, Math.floor(Number.isFinite(laborHours) ? laborHours : 0)) * 60) +
				Math.max(0, Math.floor(Number.isFinite(laborMinutes) ? laborMinutes : 0));

			const payload: any = {
				id: crypto.randomUUID?.() ?? `mat_${Date.now()}`,
				library_type: 'company',
				folder_id: folderId,
				name,
				sku: blankMat.sku.trim() === '' ? null : blankMat.sku.trim(),
				description: blankMat.description.trim() === '' ? null : blankMat.description.trim(),
				base_cost: Number.isFinite(base_cost) ? Math.max(0, base_cost) : 0,
				custom_cost: Number.isFinite(custom_cost as any) ? custom_cost : null,
				use_custom_cost: Boolean(blankMat.useCustomCost),
				taxable: Boolean(blankMat.taxable),
				job_type_id: blankMat.jobTypeId ? blankMat.jobTypeId : null,
				labor_minutes,
			};

			const savedMat: Material = await (data as any).upsertMaterial(payload);
			setMaterialCache((prev) => ({ ...prev, [savedMat.id]: savedMat }));

			if (e) {
				const nextItem: any = {
					id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
					type: 'material',
					material_id: savedMat.id,
					quantity: 1,
				};
				setE({ ...(e as any), items: [...(((e as any).items ?? []) as any[]), nextItem] } as any);
			}

			setShowBlankMaterialCard(false);
			setStatus('Saved.');
			setTimeout(() => setStatus(''), 1200);
		} catch (err: any) {
			console.error(err);
			setStatus(String(err?.message ?? err));
		}
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

  async function updateLaborDescription(itemId: string, description: string) {
    if (!e) return;
    const nextItems = ((e as any).items ?? []).map((it: any) => (it.id === itemId ? { ...it, description } : it));
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

  // (maxDiscountPercent is memoized above)

  async function applyAdminRules() {
    if (!e || isLocked || !(e as any).use_admin_rules) return;
    try {
      setStatus('Applying rules...');

      const rulesRaw = (await data.listAdminRules()) as any[];
      const rules = (rulesRaw ?? [])
        .filter((r) => {
          // tolerate legacy schemas
          const enabled = r.enabled ?? true;
          const scope = (r.scope ?? r.applies_to ?? 'both') as string;
          const scopeOk = scope === 'both' || scope === 'estimate';
          return !!enabled && scopeOk;
        })
        .sort((a, b) => (Number(a.priority ?? 0) - Number(b.priority ?? 0)));

      // Compute rule metrics using current estimate state + current effective job type.
      // Rules evaluate "expected" values (not sell totals):
      // - expected labor: efficiency-adjusted in flat-rate mode
      // - expected material cost: cost + purchase tax, no markup; customer-supplied = 0
            const jobTypesById = Object.fromEntries((jobTypes ?? []).map((j: any) => [j.id, j]));
      const pricing = computeEstimatePricing({
        estimate: e as any,
        materialsById: materialCache,
        assembliesById: assemblyCache,
        jobTypesById,
        companySettings,
      } as any) as any;

      const expectedLaborMinutes = Number(pricing?.expected_labor_minutes ?? pricing?.expectedLaborMinutes ?? 0);
      const expectedMaterialCost = Number(pricing?.material_cost ?? pricing?.materialCost ?? 0);

      // Quantity threshold uses "any single line item quantity ≥ X"
      const maxQty = Math.max(
        0,
        ...(((e as any).items ?? []) as any[]).map((it) => Number(it.quantity ?? 0))
      );

      const match = rules.find((r: any) => {
        // Support multiple rule schemas (legacy + current) to tolerate partially migrated DBs.

        // ---------- Schema A: condition_type/operator/threshold_value ----------
        const conditionTypeA = String(r.condition_type ?? r.conditionType ?? '').trim();
        const operatorA = String(r.operator ?? r.op ?? '>=').trim();
        const thresholdA = r.threshold_value ?? r.thresholdValue;

        // ---------- Schema B: rule_type + rule_value (older) ----------
        const conditionTypeB = String(r.rule_type ?? '').trim();
        const ruleValue = r.rule_value ?? {};
        const operatorB = String(ruleValue.operator ?? ruleValue.op ?? '>=').trim();
        const thresholdB =
          ruleValue.threshold_value ??
          ruleValue.thresholdValue ??
          ruleValue.threshold ??
          ruleValue.value;

        const cmp = (op: string, left: number, right: number) => {
          switch (op) {
            case '>': return left > right;
            case '>=': return left >= right;
            case '<': return left < right;
            case '<=': return left <= right;
            case '==': return left === right;
            case '!=': return left !== right;
            default: return left >= right;
          }
        };

        const getMetric = (cond: string): number | null => {
          switch (cond) {
            case 'expected_labor_hours':
              return expectedLaborMinutes / 60;
            case 'expected_labor_minutes':
              return expectedLaborMinutes;
            case 'material_cost':
              return expectedMaterialCost;
            case 'line_item_count':
              return lineItemCount;
            case 'any_line_item_qty':
              return maxQty;
            default:
              return null;
          }
        };

        // Try schema A first
        if (conditionTypeA && thresholdA != null) {
          const metric = getMetric(conditionTypeA);
          const thr = Number(thresholdA);
          if (metric == null || !Number.isFinite(thr)) return false;
          return cmp(operatorA, metric, thr);
        }

        // Then schema B
        if (conditionTypeB && thresholdB != null) {
          const metric = getMetric(conditionTypeB);
          const thr = Number(thresholdB);
          if (metric == null || !Number.isFinite(thr)) return false;
          return cmp(operatorB, metric, thr);
        }

        // ---------- Schema C: legacy min_* fields ----------
        const minLabor = r.min_expected_labor_minutes ?? r.minExpectedLaborMinutes;
        const minMat = r.min_material_cost ?? r.minMaterialCost;
        const minQty = r.min_quantity ?? r.minQuantity;
        const minLineItems =
          r.min_line_item_count ??
          r.min_line_items ??
          r.minItemCount ??
          r.min_items;

        if (minLabor != null && expectedLaborMinutes < Number(minLabor)) return false;
        if (minMat != null && expectedMaterialCost < Number(minMat)) return false;
        if (minQty != null && maxQty < Number(minQty)) return false;
        if (minLineItems != null && lineItemCount < Number(minLineItems)) return false;

        const hasAny =
          minLabor != null || minMat != null || minQty != null || minLineItems != null;

        // If it has no thresholds at all, do not auto-match it (prevents accidental always-on).
        return hasAny;
      });

      const nextJobTypeId =
        (match as any)?.target_job_type_id ??
        (match as any)?.job_type_id ??
        (match as any)?.set_job_type_id ??
        (match as any)?.rule_value?.target_job_type_id ??
        (match as any)?.rule_value?.job_type_id;
      if (nextJobTypeId) {
        const next = { ...(e as any), job_type_id: nextJobTypeId } as any;
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

  // During initial load (or after delete), the estimate can be null.
  // Guard the render so we don't crash on any `(e as any).…` access.
  if (!e) {
    return (
      <div className="stack">
        <Card title="Estimate" right={<Button onClick={() => nav('/estimates')}>Back</Button>}>
          <div className="muted">Loading...</div>
        </Card>
      </div>
    );
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
                // Keep discount_percent even when toggling off so the admin discount preload
                // still applies to the displayed subtotal (extra margin if no discount is used).
                const next: any = { ...(e as any), apply_discount: v };
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
	              // Add a local material line by creating a User Material inside a dedicated folder.
	              setShowBlankMaterialCard(true);
	              setBlankMat({
	                name: '',
	                sku: '',
	                description: '',
	                baseCostText: '',
	                customCostText: '',
	                useCustomCost: false,
	                taxable: true,
	                jobTypeId: (selectedJobType as any)?.id ?? null,
	                laborHoursText: '',
	                laborMinutesText: '',
	              });
	            }}
          >
	            Add Blank Material Line
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
				{showBlankMaterialCard ? (
					<Card
						title="Add Blank Material Line"
						right={
							<div className="row">
								<Button
									onClick={() => {
										setShowBlankMaterialCard(false);
									}}
								>
									Cancel
								</Button>
								<Button variant="primary" onClick={saveBlankMaterialLine}>
									Save
								</Button>
							</div>
						}
					>
						<div className="grid2">
							<div className="stack">
								<label className="label">Name</label>
								<Input value={blankMat.name} onChange={(ev) => setBlankMat((p) => ({ ...p, name: ev.target.value }))} />
							</div>

							<div className="stack">
								<label className="label">SKU / Part #</label>
								<Input value={blankMat.sku} onChange={(ev) => setBlankMat((p) => ({ ...p, sku: ev.target.value }))} />
							</div>

							<div className="stack" style={{ gridColumn: '1 / -1' }}>
								<label className="label">Description</label>
								<Input value={blankMat.description} onChange={(ev) => setBlankMat((p) => ({ ...p, description: ev.target.value }))} />
							</div>

							<div className="stack">
								<label className="label">Base Cost</label>
								<Input
									value={blankMat.baseCostText}
									inputMode="decimal"
									onChange={(ev) => setBlankMat((p) => ({ ...p, baseCostText: ev.target.value }))}
									onBlur={() => setBlankMat((p) => ({ ...p, baseCostText: toMoneyText(p.baseCostText) }))}
								/>
							</div>

							<div className="stack">
								<label className="label">Custom Cost</label>
								<Input
									value={blankMat.customCostText}
									inputMode="decimal"
									onChange={(ev) => setBlankMat((p) => ({ ...p, customCostText: ev.target.value }))}
									onBlur={() => setBlankMat((p) => ({ ...p, customCostText: toMoneyText(p.customCostText) }))}
								/>
							</div>

							<div className="stack">
								<label className="label">Use Custom Cost</label>
								<Toggle checked={blankMat.useCustomCost} onChange={(val) => setBlankMat((p) => ({ ...p, useCustomCost: Boolean(val) }))} />
							</div>

							<div className="stack">
								<label className="label">Taxable</label>
								<Toggle checked={blankMat.taxable} onChange={(val) => setBlankMat((p) => ({ ...p, taxable: Boolean(val) }))} />
							</div>

							<div className="stack">
								<label className="label">Labor Time</label>
								<div style={{ display: 'flex', gap: 8 }}>
									<Input
										style={{ width: 90 }}
										placeholder="Hours"
										inputMode="numeric"
										value={blankMat.laborHoursText}
										onChange={(ev) => setBlankMat((p) => ({ ...p, laborHoursText: ev.target.value }))}
										onBlur={() => setBlankMat((p) => ({ ...p, laborHoursText: toIntText(p.laborHoursText) }))}
									/>
									<Input
										style={{ width: 90 }}
										placeholder="Minutes"
										inputMode="numeric"
										value={blankMat.laborMinutesText}
										onChange={(ev) => setBlankMat((p) => ({ ...p, laborMinutesText: ev.target.value }))}
										onBlur={() => setBlankMat((p) => ({ ...p, laborMinutesText: toIntText(p.laborMinutesText) }))}
									/>
								</div>
							</div>

							<div className="stack">
								<label className="label">Job Type</label>
								<select
									value={blankMat.jobTypeId ?? ''}
									onChange={(ev) => setBlankMat((p) => ({ ...p, jobTypeId: ev.target.value || null }))}
								>
									<option value="">(Default)</option>
									{(jobTypes ?? [])
										.filter((j: any) => Boolean(j.enabled ?? j.is_enabled ?? true))
										.map((j: any) => (
											<option key={j.id} value={j.id}>
												{j.name}
											</option>
										))}
								</select>
								<div className="muted small">
									This will be saved under User Materials → “{ESTIMATE_CREATED_FOLDER_NAME}”.
								</div>
							</div>
						</div>
					</Card>
				) : null}
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
                  ? (() => {
                      const total = Math.max(0, Math.floor(toNum((r as any).minutes ?? (r as any).labor_minutes ?? 0, 0)));
                      const h = Math.floor(total / 60);
                      const m = total % 60;
                      const parts: string[] = [];
                      parts.push(`${h}h ${m}m`);
                      const desc = String((r as any).description ?? '').trim();
                      if (desc) parts.push(desc);
                      return parts.join(' • ');
                    })()
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(() => {
                            const buf = laborEdits[r.id];
                            const total = Math.max(
                              0,
                              Math.floor(toNum((r as any).minutes ?? (r as any).labor_minutes ?? 0, 0)),
                            );
                            const h0 = Math.floor(total / 60);
                            const m0 = total % 60;

                            const hoursVal = buf ? buf.hours : String(h0);
                            const minsVal = buf ? buf.minutes : String(m0);

                            const commit = async () => {
                              const rawH = (laborEdits[r.id]?.hours ?? '').trim();
                              const rawM = (laborEdits[r.id]?.minutes ?? '').trim();
                              const nextH = rawH === '' ? 0 : Math.max(0, Math.floor(toNum(rawH, 0)));
                              const nextM = rawM === '' ? 0 : clamp(Math.floor(toNum(rawM, 0)), 0, 59);
                              const nextTotal = nextH * 60 + nextM;

                              // Normalize buffer after commit.
                              setLaborEdits((prev) => ({
                                ...prev,
                                [r.id]: {
                                  hours: String(nextH),
                                  minutes: String(nextM),
                                  description: prev[r.id]?.description ?? String((r as any).description ?? ''),
                                },
                              }));

                              if (nextTotal !== total) await updateLaborMinutes(r.id, nextTotal);
                            };

                            return (
                              <>
                                <Input
                                  style={{ width: 70 }}
                                  type="text"
                                  inputMode="numeric"
                                  value={hoursVal}
                                  onChange={(ev) => {
                                    const v = ev.target.value;
                                    setLaborEdits((prev) => ({
                                      ...prev,
                                      [r.id]: {
                                        hours: v,
                                        minutes: prev[r.id]?.minutes ?? String(m0),
                                        description: prev[r.id]?.description ?? String((r as any).description ?? ''),
                                      },
                                    }));
                                  }}
                                  onBlur={commit}
                                  placeholder="Hours"
                                />
                                <Input
                                  style={{ width: 70 }}
                                  type="text"
                                  inputMode="numeric"
                                  value={minsVal}
                                  onChange={(ev) => {
                                    const v = ev.target.value;
                                    setLaborEdits((prev) => ({
                                      ...prev,
                                      [r.id]: {
                                        hours: prev[r.id]?.hours ?? String(h0),
                                        minutes: v,
                                        description: prev[r.id]?.description ?? String((r as any).description ?? ''),
                                      },
                                    }));
                                  }}
                                  onBlur={commit}
                                  placeholder="Min"
                                />
                              </>
                            );
                          })()}
                        </div>

                        <Input
                          style={{ width: 240 }}
                          type="text"
                          value={String(laborEdits[r.id]?.description ?? (r as any).description ?? '')}
                          onChange={(ev) =>
                            setLaborEdits((prev) => ({
                              ...prev,
                              [r.id]: {
                                hours: prev[r.id]?.hours ?? '0',
                                minutes: prev[r.id]?.minutes ?? '0',
                                description: ev.target.value,
                              },
                            }))
                          }
                          onBlur={() => updateLaborDescription(r.id, laborEdits[r.id]?.description ?? '')}
                          placeholder="Description"
                        />
                      </div>
                    ) : (
                      <Input
                        style={{ width: 90 }}
                        type="text"
                        inputMode="numeric"
                        value={qtyEdits[r.id] ?? String((r as any).quantity ?? 1)}
                        onChange={(ev) => {
                          // Allow blank while editing so backspace works naturally.
                          setQtyEdits((prev) => ({ ...prev, [r.id]: toIntText(ev.target.value) }));
                        }}
                        onBlur={async () => {
                          const raw = qtyEdits[r.id];
                          const q = Math.max(1, Math.floor(toNum(raw === '' || raw == null ? (r as any).quantity ?? 1 : raw, 1)));
                          setQtyEdits((prev) => {
                            const next = { ...prev };
                            delete next[r.id];
                            return next;
                          });
                          await updateQuantity(r.id, q);
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

        {(companySettings as any)?.show_tech_view_breakdown ?? false ? (
          <div className="mt">
            <TechCostBreakdownCard title="Tech View Cost Breakdown" company={companySettings as any} jobType={selectedJobType as any} />
          </div>
        ) : null}

        {totals ? (
          <div className="mt">
            <div className="muted small">Cost & Pricing Breakdown</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="pill">Actual Labor: {Math.round(toNum((totals as any).labor_minutes_actual, 0))} min</div>
              <div className="pill">Expected Labor: {Math.round(toNum((totals as any).labor_minutes_expected, 0))} min</div>

              <div className="pill">Material Cost: ${safeFixed((totals as any).material_cost)}</div>
              <div className="pill">Material Price: ${safeFixed((totals as any).material_price)}</div>
              <div className="pill">Labor Price: ${safeFixed((totals as any).labor_price)}</div>
              <div className="pill">Labor Rate Used: ${safeFixed((totals as any).labor_rate_used_per_hour)}/hr</div>

              <div className="pill">Misc Material: ${safeFixed((totals as any).misc_material)}</div>


              {/* Subtotal is ALWAYS the pre-discount (inflated) subtotal when an admin discount exists.
                  If Apply Discount is ON, we show Discount + After Discount separately. */}
              <div className="pill">Subtotal: ${safeFixed((totals as any).pre_discount_total)}</div>

              {Boolean((e as any).apply_discount) && toNum((totals as any).discount_amount, 0) > 0 ? (
                <>
                  <div className="pill">Discount: −${safeFixed((totals as any).discount_amount)}</div>
                  <div className="pill">After Discount: ${safeFixed((totals as any).subtotal_before_processing)}</div>
                </>
              ) : null}

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





