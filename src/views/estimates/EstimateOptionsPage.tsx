import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { useData } from '../../providers/data/DataContext';
import type { Estimate, EstimateItem, EstimateOption } from '../../providers/data/types';
import { computeEstimatePricing } from '../../providers/data/pricing';

function previewText(desc: string) {
  const s = (desc ?? '').trim();
  if (!s) return '';
  if (s.length <= 110) return s;
  return s.slice(0, 110) + '…';
}


function cleanOptionDescription(opt: any) {
  // Preferred new column
  const directRaw = (opt?.option_description ?? '').toString().trim();
  if (directRaw) {
    if (directRaw.startsWith('{') && directRaw.endsWith('}')) {
      try {
        const parsed = JSON.parse(directRaw);
        const d = (parsed?.description ?? '').toString().trim();
        if (d) return d;
      } catch {
        // fall through
      }
    } else {
      return directRaw;
    }
  }

  // Legacy: some builds stored a JSON payload in "description"
  const legacyRaw = (opt?.description ?? opt?.optionDescription ?? '').toString().trim();
  if (!legacyRaw) return '';
  if (legacyRaw.startsWith('{') && legacyRaw.endsWith('}')) {
    try {
      const parsed = JSON.parse(legacyRaw);
      const d = (parsed?.description ?? '').toString().trim();
      return d || '';
    } catch {
      return legacyRaw;
    }
  }
  return legacyRaw;
}


export function EstimateOptionsPage() {
  const data = useData();
  const nav = useNavigate();
  const { estimateId } = useParams();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [options, setOptions] = useState<EstimateOption[]>([]);
  const [itemsByOptionId, setItemsByOptionId] = useState<Record<string, EstimateItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string>('');

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [materialsById, setMaterialsById] = useState<Record<string, any>>({});
  const [assembliesById, setAssembliesById] = useState<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!estimateId) return;
        const [e, cs, jts] = await Promise.all([
          data.getEstimate(estimateId),
          data.getCompanySettings(),
          data.listJobTypes(),
        ]);
        if (cancelled) return;
        setEstimate(e);
        setCompanySettings(cs as any);
        setJobTypes(Array.isArray(jts) ? (jts as any) : []);
      } catch (err: any) {
        if (!cancelled) setStatus(String(err?.message ?? err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, estimateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!estimateId) return;
        const opts = await data.listEstimateOptions(estimateId);
        if (cancelled) return;
        setOptions(Array.isArray(opts) ? opts : []);
      } catch (err: any) {
        if (!cancelled) setStatus(String(err?.message ?? err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, estimateId]);

  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!estimateId) return;
        if (!options || options.length === 0) return;

        // Load items for ALL options so pricing totals can be computed on this overview page.
        const entries = await Promise.all(
          options.map(async (opt) => {
            const oid = String((opt as any).id);
            const items = await data.getEstimateItemsForOption(oid);
            return [oid, Array.isArray(items) ? items : []] as const;
          }),
        );

        if (cancelled) return;

        setItemsByOptionId((prev) => {
          const next = { ...prev };
          for (const [oid, items] of entries) next[oid] = items;
          return next;
        });

        // Best-effort: load referenced materials/assemblies so names + labor time are available to pricing engine & preview.
        const matIds = new Set<string>();
        const asmIds = new Set<string>();
        for (const [, items] of entries) {
          for (const it of items ?? []) {
            const mid = (it as any).material_id ?? (it as any).materialId;
            const aid = (it as any).assembly_id ?? (it as any).assemblyId;
            if (mid) matIds.add(String(mid));
            if (aid) asmIds.add(String(aid));
          }
        }

        await Promise.all(
          Array.from(matIds)
            .filter((id) => !materialsById[id])
            .map(async (id) => {
              try {
                const m = await data.getMaterial(id);
                if (m) setMaterialsById((prev) => ({ ...prev, [id]: m }));
              } catch {
                // ignore
              }
            }),
        );

        await Promise.all(
          Array.from(asmIds)
            .filter((id) => !assembliesById[id])
            .map(async (id) => {
              try {
                const a = await data.getAssembly(id);
                if (a) setAssembliesById((prev) => ({ ...prev, [id]: a }));
              } catch {
                // ignore
              }
            }),
        );
      } catch (err: any) {
        if (!cancelled) setStatus(String(err?.message ?? err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, estimateId, options]);

// Stable numbering: prefer option_number from DB; fallback to created_at order.
  const optionFallbackNumberById = useMemo(() => {
    const sorted = options
      .slice()
      .sort((a: any, b: any) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
    const map: Record<string, number> = {};
    sorted.forEach((o, idx) => {
      map[String(o.id)] = idx + 1;
    });
    return map;
  }, [options]);

  const optionsByDisplayOrder = useMemo(() => {
    return options.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [options]);

  const jobTypesById = useMemo(() => Object.fromEntries((jobTypes ?? []).map((j: any) => [j.id, j])), [jobTypes]);

  async function ensureItems(optionId: string) {
    if (itemsByOptionId[optionId]) return;
    const items = await data.getEstimateItemsForOption(optionId);
    setItemsByOptionId((prev) => ({ ...prev, [optionId]: Array.isArray(items) ? items : [] }));

    // Lazy-load referenced materials/assemblies for nicer preview labels.
    const matIds = new Set<string>();
    const asmIds = new Set<string>();
    for (const it of items ?? []) {
      const mid = (it as any).material_id ?? (it as any).materialId;
      const aid = (it as any).assembly_id ?? (it as any).assemblyId;
      if (mid) matIds.add(String(mid));
      if (aid) asmIds.add(String(aid));
    }
    for (const id of Array.from(matIds)) {
      if (materialsById[id]) continue;
      try {
        const m = await data.getMaterial(id);
        if (m) setMaterialsById((prev) => ({ ...prev, [id]: m }));
      } catch {
        // ignore
      }
    }
    for (const id of Array.from(asmIds)) {
      if (assembliesById[id]) continue;
      try {
        const a = await data.getAssembly(id);
        if (a) setAssembliesById((prev) => ({ ...prev, [id]: a }));
      } catch {
        // ignore
      }
    }
  }

  function buildEstimateForOption(base: Estimate, opt: EstimateOption, items: EstimateItem[]) {
    // Option-scoped controls come from estimate_options columns (not JSON in description).
    return {
      ...base,
      job_type_id: (opt as any).job_type_id ?? (base as any).job_type_id ?? null,
      use_admin_rules: (opt as any).use_admin_rules ?? (base as any).use_admin_rules ?? false,
      customer_supplies_materials:
        (opt as any).customer_supplies_materials ?? (base as any).customer_supplies_materials ?? false,
      apply_discount: (opt as any).apply_discount ?? (base as any).apply_discount ?? false,
      discount_percent:
        (opt as any).discount_percent === undefined
          ? (base as any).discount_percent ?? null
          : (opt as any).discount_percent,
      apply_processing_fees: (opt as any).apply_processing_fees ?? (base as any).apply_processing_fees ?? false,
      items,
    } as any;
  }

  const optionTotals = useMemo(() => {
    if (!estimate || !companySettings) return {} as Record<string, number>;
    const totals: Record<string, number> = {};
    for (const opt of options) {
      const oid = String(opt.id);
      const items = itemsByOptionId[oid] ?? [];
      const estFor = buildEstimateForOption(estimate, opt, items);
      try {
        const pricing = computeEstimatePricing({
          estimate: estFor,
          materialsById,
          assembliesById,
          jobTypesById,
          companySettings,
        } as any);
        totals[oid] = Number((pricing as any)?.total_price ?? (pricing as any)?.totals?.final_total ?? 0);
      } catch {
        totals[oid] = 0;
      }
    }
    return totals;
  }, [estimate, companySettings, options, itemsByOptionId, materialsById, assembliesById, jobTypesById]);

  // Drag + drop reorder (display only)
  const [dragId, setDragId] = useState<string | null>(null);
  async function persistOrder(next: EstimateOption[]) {
    const normalized = next.map((o, idx) => ({ ...o, sort_order: (idx + 1) * 10 }));
    setOptions(normalized);
    try {
      for (const o of normalized) {
        await data.updateEstimateOption({ id: o.id, sort_order: (o as any).sort_order } as any);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="stack">
      <Card
        title="Estimate Options"
        right={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={() => nav(`/estimates/${estimateId}`)}>
              Back
            </Button>
          </div>
        }
      >
        {status ? <div className="muted small">{status}</div> : null}

        {estimate ? (
          <div className="stack" style={{ gap: 6 }}>
            <div className="muted small">Customer</div>
            <div>{(estimate as any).customer_name ?? '—'}</div>
            <div className="muted small">{(estimate as any).customer_phone ?? ''}</div>
            <div className="muted small">{(estimate as any).customer_email ?? ''}</div>
            <div className="muted small">{(estimate as any).customer_address ?? ''}</div>
          </div>
        ) : (
          <div className="muted">Loading…</div>
        )}
      </Card>

      <Card title="Options">
        {optionsByDisplayOrder.length === 0 ? (
          <div className="muted">No options yet.</div>
        ) : (
          <div className="list">
            {optionsByDisplayOrder.map((opt) => {
              const oid = String(opt.id);
              const optionNumber = (opt as any).option_number ?? optionFallbackNumberById[oid] ?? 1;
              const name = (opt as any).option_name ?? `Option ${optionNumber}`;
              const total = optionTotals[oid] ?? 0;
              const isOpen = Boolean(expanded[oid]);
              const items = itemsByOptionId[oid] ?? null;

              return (
                <div
                  key={oid}
                  className="listRow"
                  draggable
                  onDragStart={() => setDragId(oid)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (!dragId || dragId === oid) return;
                    const cur = optionsByDisplayOrder.slice();
                    const fromIdx = cur.findIndex((x) => String((x as any).id) === dragId);
                    const toIdx = cur.findIndex((x) => String((x as any).id) === oid);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const [moved] = cur.splice(fromIdx, 1);
                    cur.splice(toIdx, 0, moved);
                    await persistOrder(cur);
                    setDragId(null);
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <div className="listMain">
                    <div className="listTitle">
                      {name}{' '}
                      <span className="muted">• #{(estimate as any)?.estimate_number}-{optionNumber}</span>
                    </div>
                    <div className="listSub">{previewText(cleanOptionDescription(opt)) || '—'}</div>
                  </div>

                  <div className="listRight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="pill">${total.toFixed(2)}</div>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await data.updateEstimateHeader({ id: estimateId as string, active_option_id: oid } as any);
                        } catch {
                          // ignore
                        }
                        nav(`/estimates/${estimateId}`);
                      }}
                    >
                      View Option
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setExpanded((prev) => ({ ...prev, [oid]: !prev[oid] }));
                        if (!expanded[oid]) await ensureItems(oid);
                      }}
                    >
                      {isOpen ? 'Hide' : 'Show'}
                    </Button>
                  </div>

                  {isOpen ? (
                    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                      {items == null ? (
                        <div className="muted">Loading…</div>
                      ) : items.length === 0 ? (
                        <div className="muted">No line items.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {items.map((it: any, idx: number) => {
                            const type = String(it?.type ?? it?.item_type ?? '').toLowerCase();
                            const qty = Number(it?.quantity ?? 1) || 1;
                            let label = 'Item';

                            if (type === 'material') {
                              const mid = String(it.material_id ?? it.materialId ?? '');
                              label = materialsById[mid]?.name ?? 'Material';
                            } else if (type === 'assembly') {
                              const aid = String(it.assembly_id ?? it.assemblyId ?? '');
                              label = assembliesById[aid]?.name ?? it?.name ?? 'Assembly';
                            } else if (type === 'labor') {
                              label = it?.name ?? 'Labor';
                            }

                            return (
                              <div
                                key={String(it?.id ?? idx)}
                                className="row"
                                style={{ justifyContent: 'space-between' }}
                              >
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="pill" style={{ padding: '2px 8px' }}>{type || 'item'}</span><span>{label}</span></div>
                                <div className="muted">x{qty}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}


