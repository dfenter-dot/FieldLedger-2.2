import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { useData } from '../../providers/data/DataContext';
import type { Estimate, EstimateItem, EstimateOption } from '../../providers/data/types';
import { computeEstimatePricing } from '../../providers/data/pricing';

type OptionPayload = {
  description: string;
  settings?: {
    job_type_id?: string | null;
    use_admin_rules?: boolean;
    customer_supplies_materials?: boolean;
    apply_discount?: boolean;
    discount_percent?: number | null;
    apply_processing_fees?: boolean;
  };
};

function safeParseOptionPayload(raw: any): OptionPayload {
  const text = raw == null ? '' : String(raw);
  if (!text) return { description: '' };
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      const desc = typeof obj.description === 'string' ? obj.description : '';
      const settings = obj.settings && typeof obj.settings === 'object' ? obj.settings : undefined;
      return { description: desc, settings };
    }
  } catch {
    // ignore
  }
  // Back-compat: previously stored plain text.
  return { description: text };
}

function previewText(desc: string) {
  const s = (desc ?? '').trim();
  if (!s) return '';
  if (s.length <= 110) return s;
  return s.slice(0, 110) + 'â€¦';
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

  // Stable dash-numbering by creation order (not affected by sort_order reordering).
  const optionIndexById = useMemo(() => {
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
  const payload = safeParseOptionPayload((opt as any).option_description);

  return {
    ...base,

    // Option identity
    option_name: (opt as any).option_name ?? 'Option',
    option_description: payload.description ?? '',

    // Per-option independent settings (stored as columns)
    job_type_id: (opt as any).job_type_id ?? null,
    use_admin_rules: Boolean((opt as any).use_admin_rules ?? false),
    customer_supplies_materials: Boolean((opt as any).customer_supplies_materials ?? false),
    apply_discount: Boolean((opt as any).apply_discount ?? false),
    discount_percent:
      (opt as any).discount_percent == null || String((opt as any).discount_percent).trim() === ''
        ? null
        : Number((opt as any).discount_percent),
    apply_processing_fees: Boolean((opt as any).apply_processing_fees ?? false),

    // Items for this option
    items,
  } as any;
}


