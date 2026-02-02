
// PRICING ENGINE — AUTHORITATIVE (Phase 1 Rewrite)
// All pricing logic lives here. UI must consume outputs only.

import { CompanySettings, JobType } from './types';
import { computeTechCostBreakdown } from './techCostBreakdown';

export type PricingInput = {
  company: {
    tech_wage: number;
    loaded_labor_rate: number;
    purchase_tax_percent: number;
    material_markup_tiers: Array<{ min: number; max: number; percent: number }>;
    misc_material_percent: number;
    allow_misc_with_customer_materials: boolean;
    discount_percent: number;
    processing_fee_percent: number;
  };
  jobType: {
    mode: 'flat_rate' | 'hourly';
    gross_margin_percent: number;
    efficiency_percent: number;
    allow_discounts: boolean;
  };
  lineItems: {
    materials: Array<{
      cost: number;
      custom_cost?: number;
      taxable: boolean;
      labor_minutes: number;
      quantity: number;
    }>;
    labor_lines: Array<{
      minutes: number;
    }>;
  };
  tech?: {
    requiredRevenuePerBillableHour?: number;
  } | null;
  flags: {
    apply_discount: boolean;
    apply_processing_fee: boolean;
    customer_supplies_materials: boolean;
  };
};

export type PricingBreakdown = {
  labor: {
    actual_minutes: number;
    expected_minutes: number;
    base_rate: number;
    effective_rate: number;
    labor_cost: number;
    labor_sell: number;
  };
  materials: {
    material_sell: number;
    misc_material: number;
  };
  subtotals: {
    raw_subtotal: number;
    margin_subtotal: number;
    pre_discount_subtotal: number;
    discount_amount: number;
  };
  processing_fee: number;
  totals: {
    final_subtotal: number;
    final_total: number;
  };
};

function resolveMarkup(cost: number, tiers: PricingInput['company']['material_markup_tiers']) {
  for (const t of tiers) {
    if (cost >= t.min && cost <= t.max) return t.percent;
  }
  return 0;
}

export function computePricingBreakdown(input: PricingInput): PricingBreakdown {
  const { company, jobType, lineItems, flags, tech } = input;

  // --- LABOR TIME ---
  const materialLabor = lineItems.materials.reduce(
    (sum, m) => sum + m.labor_minutes * m.quantity,
    0
  );
  const laborLineMinutes = lineItems.labor_lines.reduce(
    (sum, l) => sum + l.minutes,
    0
  );

  const actualMinutes = materialLabor + laborLineMinutes;
  const expectedMinutes =
    jobType.mode === 'flat_rate'
      ? actualMinutes / Math.max(jobType.efficiency_percent / 100, 0.0001)
      : actualMinutes;

  // --- MATERIALS ---
  // Always compute raw material sell first.
  // Customer-supplied materials zero only the customer-facing material sell,
  // but misc material may still apply based on Admin setting.
  let rawMaterialSell = 0;

  for (const m of lineItems.materials) {
    const baseCost = m.custom_cost ?? m.cost;
    const taxedCost = m.taxable
      ? baseCost * (1 + company.purchase_tax_percent / 100)
      : baseCost;
    const markup = resolveMarkup(taxedCost, company.material_markup_tiers);
    const sell = taxedCost * (1 + markup / 100);
    rawMaterialSell += sell * m.quantity;
  }

  const customerSupplies = Boolean(flags.customer_supplies_materials);
  const materialSell = customerSupplies ? 0 : rawMaterialSell;

  // Misc material behavior:
  // - If Admin disallows misc when customer supplies materials: misc = 0 when customerSupplies
  // - If Admin allows it: misc always applies regardless of customerSupplies selection
  const miscMaterial =
    rawMaterialSell > 0 && (company.allow_misc_with_customer_materials || !customerSupplies)
      ? rawMaterialSell * (company.misc_material_percent / 100)
      : 0;

  // --- LABOR PRICING ---
  let laborCost = 0;
  let laborSell = 0;
  let baseRate = 0;
  let effectiveRate = 0;

  if (jobType.mode === 'flat_rate') {
    // Flat-rate labor sell rate must come from "Sheet 2" (Tech View) so we don't apply GM twice.
    // Use Tech View's Loaded Labor Rate (Wage + Overhead) for the selected job type.
    // This prevents applying gross margin twice.
    baseRate = company.loaded_labor_rate;
    effectiveRate = Number((tech as any)?.loadedLaborRate ?? 0) || 0;

    // Fallback (should be rare): derive from loaded labor rate if tech view isn't available.
    if (effectiveRate <= 0) {
      effectiveRate = baseRate / (1 - jobType.gross_margin_percent / 100);
    }

    laborSell = effectiveRate * (expectedMinutes / 60);
  } else {
    // Hourly handled later (Phase 2)
    baseRate = company.tech_wage;
    laborCost = baseRate * (actualMinutes / 60);
  }

  // --- SUBTOTALS ---
  let rawSubtotal = 0;
  let marginSubtotal = 0;

  if (jobType.mode === 'flat_rate') {
    marginSubtotal = laborSell + materialSell + miscMaterial;
  } else {
    rawSubtotal = laborCost + materialSell;
    marginSubtotal = rawSubtotal / (1 - jobType.gross_margin_percent / 100);
    laborSell = marginSubtotal - materialSell;
  }

  // --- DISCOUNT BUFFER (always preload when allowed) ---
  const discountRate = company.discount_percent / 100;
  const canDiscount = jobType.allow_discounts && discountRate > 0;
  // We always compute an inflated display subtotal so the business keeps extra margin if no discount is applied.
  const preDiscountSubtotal = canDiscount
    ? marginSubtotal / Math.max(1 - discountRate, 0.0001)
    : marginSubtotal;

  // If discount toggle is ON, we apply enough discount to bring the charged subtotal back down to the target (marginSubtotal).
  const discountAmount = canDiscount && flags.apply_discount
    ? preDiscountSubtotal - marginSubtotal
    : 0;

  // Charged subtotal before processing depends on whether discount is applied.
  const chargedSubtotal = (canDiscount && !flags.apply_discount)
    ? preDiscountSubtotal
    : marginSubtotal;
  // --- PROCESSING FEE ---
  const processingFee = flags.apply_processing_fee
    ? chargedSubtotal * (company.processing_fee_percent / 100)
    : 0;

  // chargedSubtotal is what the customer pays before processing fees.
  const finalSubtotal = chargedSubtotal;
  const finalTotal = finalSubtotal + processingFee;

  return {
    labor: {
      actual_minutes: actualMinutes,
      expected_minutes: expectedMinutes,
      base_rate: baseRate,
      effective_rate: effectiveRate,
      labor_cost: laborCost,
      labor_sell: laborSell,
    },
    materials: {
      material_sell: materialSell,
      misc_material: miscMaterial,
    },
    subtotals: {
      raw_subtotal: rawSubtotal,
      margin_subtotal: marginSubtotal,
      pre_discount_subtotal: preDiscountSubtotal,
      discount_amount: discountAmount,
    },
    processing_fee: processingFee,
    totals: {
      final_subtotal: finalSubtotal,
      final_total: finalTotal,
    },
  };
}


/* ------------------------------------------------------------------ */
/* Backward-compatible exports (UI currently imports these)            */
/* ------------------------------------------------------------------ */

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function monthlyFromItemized(items: any[]): number {
  const mult = (freq: string) => {
    switch (freq) {
      case 'monthly':
        return 1;
      case 'quarterly':
        return 1 / 3;
      case 'biannual':
        return 1 / 6;
      case 'annual':
        return 1 / 12;
      default:
        return 1;
    }
  };
  return (Array.isArray(items) ? items : []).reduce((sum, it) => {
    const amt = toNum(it?.amount, 0);
    const f = String(it?.frequency ?? 'monthly');
    return sum + amt * mult(f);
  }, 0);
}

export function getAverageTechnicianWage(settings: any): number {
  const wages = Array.isArray(settings?.technician_wages) ? settings.technician_wages : [];
  const valid = wages.map((w: any) => toNum(w?.hourly_rate, 0)).filter((v: number) => v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((a: number, b: number) => a + b, 0) / valid.length;
}

function deriveOverheadPerHour(s: any): number {
  // Overhead monthly (business + personal), using same itemized vs lump rules as Admin.
  const bizMonthly = s?.business_apply_itemized
    ? monthlyFromItemized(s?.business_expenses_itemized)
    : toNum(s?.business_expenses_lump_sum_monthly, 0);

  const perMonthly = s?.personal_apply_itemized
    ? monthlyFromItemized(s?.personal_expenses_itemized)
    : toNum(s?.personal_expenses_lump_sum_monthly, 0);

  const overheadAnnual = (bizMonthly + perMonthly) * 12;

  // Capacity (NO efficiency applied here). This is the admin "overhead per hour" allocator.
  const workdaysPerWeek = toNum(s?.workdays_per_week, 0);
  const hoursPerDay = toNum(s?.work_hours_per_day, 0);
  const vacationDays = toNum(s?.vacation_days_per_year, 0);
  const sickDays = toNum(s?.sick_days_per_year, 0);
  const technicians = Math.max(0, toNum(s?.technicians, 0));

  const workdaysPerYear = Math.max(0, workdaysPerWeek * 52 - vacationDays - sickDays);
  const hoursPerTechYear = workdaysPerYear * hoursPerDay;
  const totalHoursYear = hoursPerTechYear * technicians;

  return totalHoursYear > 0 ? overheadAnnual / totalHoursYear : 0;
}

function toEngineCompany(s: any) {
  const avgWage = getAverageTechnicianWage(s);
  const overheadPerHour = deriveOverheadPerHour(s);
  const loadedLaborRate = avgWage + overheadPerHour;

  const tiersRaw = Array.isArray(s?.material_markup_tiers) ? s.material_markup_tiers : [];
  const tiers = tiersRaw.map((t: any) => ({
    min: toNum(t?.min, 0),
    max: toNum(t?.max, 0),
    percent: toNum(t?.percent ?? t?.markup_percent, 0),
  }));

  return {
    tech_wage: avgWage,
    loaded_labor_rate: loadedLaborRate,
    purchase_tax_percent: toNum(s?.material_purchase_tax_percent ?? s?.purchase_tax_percent, 0),
    material_markup_tiers: tiers,
    misc_material_percent: toNum(s?.misc_material_percent, 0),
    // Admin toggle label: "Apply misc material when customer supplies materials"
    // Tolerate legacy/alternate schema field names.
    allow_misc_with_customer_materials: Boolean(
      s?.misc_applies_when_customer_supplies ??
      s?.allow_misc_with_customer_materials ??
      s?.allow_misc_when_customer_supplies_materials ??
      s?.allow_misc_when_customer_supplies ??
      false
    ),
    // Admin default discount percent has appeared under several names across builds.
    // Prefer the explicit default field(s) first.
    discount_percent: toNum(
      s?.default_discount_percent ??
      s?.discount_percent_default ??
      s?.discount_percent ??
      0,
    ),
    processing_fee_percent: toNum(s?.processing_fee_percent, 0),
  };
}

function toEngineJobType(jobType: any) {
  const mode = jobType?.billing_mode === 'hourly' ? 'hourly' : 'flat_rate';
  return {
    mode,
    gross_margin_percent: clampPct(toNum(jobType?.profit_margin_percent, 0)),
    efficiency_percent: clampPct(toNum(jobType?.efficiency_percent ?? 100, 100)),
    allow_discounts: Boolean(jobType?.allow_discounts ?? true),
  } as PricingInput['jobType'];
}

function computeMaterialCostTotal(materials: any[], purchaseTaxPercent: number): number {
  return (Array.isArray(materials) ? materials : []).reduce((sum, m) => {
    const qty = Math.max(0, toNum(m?.quantity, 1));
    const cost = toNum(m?.custom_cost ?? m?.cost ?? m?.base_cost ?? m?.unit_cost ?? m?.material_cost, 0);
    const taxable = Boolean(m?.taxable ?? m?.is_taxable ?? false);
    const taxedCost = taxable ? cost * (1 + purchaseTaxPercent / 100) : cost;
    return sum + taxedCost * qty;
  }, 0);
}

export function computeAssemblyPricing(params: {
  assembly: any;
  items: any[];
  materialsById: Record<string, any>;
  jobTypesById: Record<string, any>;
  companySettings: any;
}) {
  const { assembly, items, materialsById, jobTypesById, companySettings } = params;

  const jobType =
    (assembly?.job_type_id && jobTypesById?.[assembly.job_type_id]) ||
    Object.values(jobTypesById ?? {}).find((j: any) => j?.is_default) ||
    Object.values(jobTypesById ?? {})[0] ||
    null;

  const tech = computeTechCostBreakdown(companySettings as any, jobType as any);

  const mats: PricingInput['lineItems']['materials'] = (Array.isArray(items) ? items : [])
    .filter((it) => it?.type === 'material')
    .map((it: any) => {
      const mat = materialsById?.[it.materialId ?? it.material_id] ?? {};
      return {
        cost: toNum(mat?.base_cost ?? mat?.unit_cost ?? mat?.material_cost ?? 0, 0),
        custom_cost: mat?.use_custom_cost ? toNum(mat?.custom_cost, 0) : undefined,
        taxable: Boolean(mat?.taxable ?? false),
        labor_minutes: toNum(mat?.labor_minutes ?? 0, 0),
        quantity: Math.max(0, toNum(it?.quantity, 1)),
      };
    });

  const laborLines: PricingInput['lineItems']['labor_lines'] = [
    { minutes: toNum(assembly?.labor_minutes ?? 0, 0) },
  ].filter((x) => x.minutes > 0);

  const company = toEngineCompany(companySettings);
  // Discount percent can be set per-estimate in the UI (capped by Company Setup).
  // If provided, it overrides the company default for both preload and applied discount.
  const discountPctFromEstimate = toNum(
    (estimate as any)?.discount_percent ?? (estimate as any)?.discountPercent,
    NaN as any,
  );
  if (Number.isFinite(discountPctFromEstimate)) {
    company.discount_percent = discountPctFromEstimate;
  }
  const jt = toEngineJobType(jobType);

  const breakdown = computePricingBreakdown({
    company,
    jobType: jt,
    lineItems: { materials: mats, labor_lines: laborLines },
    tech: { 
      loadedLaborRate: (tech as any)?.loadedLaborRate,
      requiredRevenuePerBillableHour: (tech as any)?.requiredRevenuePerBillableHour,
    },
    flags: {
      apply_discount: false,
      apply_processing_fee: false,
      customer_supplies_materials:
        Boolean(assembly?.customer_supplied_materials === true) ||
        Boolean((assembly as any)?.customer_supplies_materials === true),
    },
  });
  const actualMinutes = breakdown.labor.actual_minutes;
  const expectedMinutes = (jt.mode === 'flat_rate') ? breakdown.labor.expected_minutes : actualMinutes;

  const customerSupplies =
    Boolean(assembly?.customer_supplied_materials === true) ||
    Boolean((assembly as any)?.customer_supplies_materials === true);
  const materialCost = customerSupplies ? 0 : computeMaterialCostTotal(mats, company.purchase_tax_percent);

  return {
    labor_minutes_total: expectedMinutes,
    material_cost_total: materialCost,
    material_price_total: breakdown.materials.material_sell,
    labor_price_total: breakdown.labor.labor_sell,
    labor_rate_used_per_hour: breakdown.labor.effective_rate,
    misc_material_price: breakdown.materials.misc_material,
    total_price: breakdown.totals.final_total,
    lines: (Array.isArray(items) ? items : []).map((it: any) => {
      if (it?.type === 'material') {
        const mat = materialsById?.[it.materialId ?? it.material_id] ?? {};
        return { ...it, labor_minutes: toNum(mat?.labor_minutes ?? 0, 0) * Math.max(0, toNum(it?.quantity, 1)) };
      }
      if (it?.type === 'labor') return { ...it, labor_minutes: toNum(it?.minutes, 0) };
      return { ...it, labor_minutes: 0 };
    }),
  };
}

export function computeEstimatePricing(params: {
  estimate: any;
  materialsById: Record<string, any>;
  assembliesById: Record<string, any>;
  jobTypesById: Record<string, any>;
  companySettings: any;
}) {
  const { estimate, materialsById, assembliesById, jobTypesById, companySettings } = params;

  const jobType =
    (estimate?.job_type_id && jobTypesById?.[estimate.job_type_id]) ||
    Object.values(jobTypesById ?? {}).find((j: any) => j?.is_default) ||
    Object.values(jobTypesById ?? {})[0] ||
    null;

  const tech = computeTechCostBreakdown(companySettings as any, jobType as any);

  // Build material + labor minutes from estimate rows
  const rows = Array.isArray(estimate?.items) ? estimate.items : [];

  const mats: PricingInput['lineItems']['materials'] = rows
    .filter((it: any) => it?.type === 'material')
    .map((it: any) => {
      const mat = materialsById?.[it.materialId ?? it.material_id] ?? {};
      const qty = Math.max(0, toNum(it?.quantity, 1));
      return {
        cost: toNum(mat?.base_cost ?? mat?.unit_cost ?? mat?.material_cost, 0),
        custom_cost: mat?.use_custom_cost ? toNum(mat?.custom_cost, 0) : undefined,
        taxable: Boolean(mat?.taxable ?? false),
        labor_minutes: toNum(mat?.labor_minutes ?? 0, 0),
        quantity: qty,
      };
    });

  // Treat assembly rows as additive snapshots (best-effort): if assembly has precomputed totals, include as "labor lines" and "materials" is not decomposed here.
  // For now, we only include estimate labor rows + material labor. Assembly internals will be finalized later in Phase 3+.
  const laborLines: PricingInput['lineItems']['labor_lines'] = rows
    .filter((it: any) => it?.type === 'labor')
    .map((it: any) => ({
      // Back-compat: labor line minutes may be stored as `minutes` (UI) or `labor_minutes` (DB/provider)
      minutes: toNum(it?.minutes ?? it?.labor_minutes ?? it?.laborMinutes, 0),
    }));

  const company = toEngineCompany(companySettings);

  // Discount percent can be stored per-estimate (UI input) and should override
  // the Company Setup default for both the "preload" subtotal and the applied discount.
  const discountPctFromEstimate = toNum(
    (estimate as any)?.discount_percent ?? (estimate as any)?.discountPercent,
    NaN,
  );
  if (Number.isFinite(discountPctFromEstimate)) {
    company.discount_percent = clampPct(discountPctFromEstimate);
  }

  const jt = toEngineJobType(jobType);

  const customerSupplies =
    Boolean(estimate?.customer_supplied_materials === true) ||
    Boolean((estimate as any)?.customer_supplies_materials === true) ||
    Boolean((estimate as any)?.customerSuppliedMaterials === true);
  // Back-compat: some builds used apply_processing_fees (plural) while others used apply_processing_fee (singular)
  const applyProcessing = Boolean(
    (estimate as any)?.apply_processing_fee ??
      (estimate as any)?.apply_processing_fees ??
      (estimate as any)?.applyProcessingFees ??
      false,
  );
  const applyDiscount = Boolean(estimate?.apply_discount ?? estimate?.applyDiscount ?? false);

  const breakdown = computePricingBreakdown({
    company,
    jobType: jt,
    lineItems: { materials: mats, labor_lines: laborLines },
    tech: { 
      loadedLaborRate: (tech as any)?.loadedLaborRate,
      requiredRevenuePerBillableHour: (tech as any)?.requiredRevenuePerBillableHour,
    },
    flags: {
      apply_discount: applyDiscount,
      apply_processing_fee: applyProcessing,
      customer_supplies_materials: customerSupplies,
    },
  });

  const materialCost = customerSupplies ? 0 : computeMaterialCostTotal(mats, company.purchase_tax_percent);

  return {
    labor_minutes_actual: breakdown.labor.actual_minutes,
    labor_minutes_expected: breakdown.labor.expected_minutes,

    material_cost: materialCost,
    material_price: breakdown.materials.material_sell,

    labor_price: breakdown.labor.labor_sell,

    misc_material: breakdown.materials.misc_material,



    labor_rate_used_per_hour: breakdown.labor.effective_rate,
    discount_percent: company.discount_percent,
    pre_discount_total: breakdown.subtotals.pre_discount_subtotal,
    discount_amount: breakdown.subtotals.discount_amount,

    subtotal_before_processing: breakdown.totals.final_subtotal,
    processing_fee: breakdown.processing_fee,
    total: breakdown.totals.final_total,

    gross_margin_target_percent: jt.gross_margin_percent,
    gross_margin_expected_percent: jt.gross_margin_percent,
  };
}



type EstimateTotalsNormalized = {
  labor_minutes_actual: number;
  labor_minutes_expected: number;
  material_cost: number;
  material_price: number;
  labor_price: number;
  misc_material: number;
  pre_discount_total: number;
  discount_percent: number;
  discount_amount: number;
  subtotal_before_processing: number;
  processing_fee: number;
  total: number;
  gross_margin_target_percent: number | null;
  gross_margin_expected_percent: number | null;
};

function round2(n: any): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/**
 * UI-safe totals shape:
 * - never returns undefined for numeric fields
 * - keeps legacy field names used across Estimate editor/preview/job costing
 */
export function computeEstimateTotalsNormalized(
  estimate: Estimate,
  lineItems: LineItem[],
  companySettings: CompanySettings,
  jobType: JobType | null,
): EstimateTotalsNormalized {
  // Legacy helper used by EstimatePreviewPage — delegate to the unified pricing engine.
  const pricing = computeEstimatePricing(estimate, lineItems, companySettings, jobType);

  return {
    material_cost: round2(pricing.materials.material_cost),
    material_price: round2(pricing.materials.material_sell),

    labor_minutes: pricing.labor.expected_minutes,
    labor_price: round2(pricing.labor.labor_sell),

    misc_material_cost: round2(pricing.materials.misc_cost),
    misc_material_price: round2(pricing.materials.misc_sell),

    discount_percent: pricing.discount_applied_percent,
    discount_amount: round2(pricing.discount_amount),

    subtotal_pre_discount: round2(pricing.subtotal_pre_discount),
    subtotal_after_discount: round2(pricing.subtotal_after_discount),

    processing_fee: round2(pricing.processing_fee),
    total: round2(pricing.total),
  };
}


