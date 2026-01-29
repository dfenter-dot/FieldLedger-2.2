// src/providers/data/pricing.ts

import type {
  Assembly,
  AssemblyItem,
  CompanySettings,
  JobType,
  Material,
  PricingLineBreakdown,
  PricingResult,
  UUID,
} from './types';

/* ------------------------------------------------------------------ */
/* Technician Wage                                                     */
/* ------------------------------------------------------------------ */

export function getAverageTechnicianWage(settings: any): number {
  const wages = settings?.technician_wages ?? [];
  const valid = wages
    .map((w: any) => Number(w?.hourly_rate))
    .filter((v: number) => Number.isFinite(v) && v > 0);

  if (valid.length === 0) return 0;

  return valid.reduce((a: number, b: number) => a + b, 0) / valid.length;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function getPurchaseTaxPercent(settings: any): number {
  // DB / UI naming drift: support both.
  const v = settings?.material_purchase_tax_percent ?? settings?.purchase_tax_percent ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getMiscMaterialPercent(settings: any): number {
  const v = settings?.misc_material_percent ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type MarkupTier = { min: number; max: number; markup_percent: number };

function getMarkupTiers(settings: any): MarkupTier[] {
  const tiers = settings?.material_markup_tiers;
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t: any) => ({
      min: Number(t?.min ?? 0),
      max: Number(t?.max ?? 0),
      markup_percent: Number(t?.markup_percent ?? 0),
    }))
    .filter((t: MarkupTier) => Number.isFinite(t.min) && Number.isFinite(t.max) && Number.isFinite(t.markup_percent));
}

function applyTieredMarkup(costWithTax: number, tiers: MarkupTier[]): number {
  const c = Number(costWithTax) || 0;
  if (c <= 0) return 0;

  // Choose the first tier where min <= c <= max (max=0 treated as infinity).
  const tier = tiers.find((t) => c >= t.min && (t.max <= 0 || c <= t.max));
  const pct = tier ? Number(tier.markup_percent) || 0 : 0;
  return c * (1 + pct / 100);
}

function safeBillingMode(jobType: any): 'flat' | 'hourly' {
  const v = String(jobType?.billing_mode ?? jobType?.billing_type ?? 'flat').toLowerCase();
  return v === 'hourly' ? 'hourly' : 'flat';
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function monthlyFromItemized(items: any[]): number {
  const list = Array.isArray(items) ? items : [];
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
  return list.reduce((sum, it) => {
    const amt = Number(it?.amount ?? 0) || 0;
    const f = String(it?.frequency ?? 'monthly');
    return sum + amt * mult(f);
  }, 0);
}

/**
 * Flat-rate labor $/billable-hour derived from Admin > Company Setup
 * using the selected job type's efficiency + gross margin target.
 */
export function computeRequiredRevenuePerBillableHour(params: {
  companySettings: any;
  jobType: any;
}): number {
  const { companySettings: s, jobType } = params;

  const wages = Array.isArray(s?.technician_wages) ? s.technician_wages : [];
  const avgTechWage = getAverageTechnicianWage({ technician_wages: wages });

  // Overhead monthly (business + personal), using same itemized vs lump rules as CompanySetupPage.
  const bizMonthly = s?.business_apply_itemized
    ? monthlyFromItemized(s?.business_expenses_itemized)
    : (Number(s?.business_expenses_lump_sum_monthly ?? 0) || 0);
  const perMonthly = s?.personal_apply_itemized
    ? monthlyFromItemized(s?.personal_expenses_itemized)
    : (Number(s?.personal_expenses_lump_sum_monthly ?? 0) || 0);

  const overheadMonthly = bizMonthly + perMonthly;
  const overheadAnnual = overheadMonthly * 12;

  // Capacity + efficiency
  const workdaysPerWeek = Number(s?.workdays_per_week ?? 0) || 0;
  const hoursPerDay = Number(s?.work_hours_per_day ?? 0) || 0;
  const vacationDays = Number(s?.vacation_days_per_year ?? 0) || 0;
  const sickDays = Number(s?.sick_days_per_year ?? 0) || 0;
  const technicians = Math.max(0, Number(s?.technicians ?? 0) || 0);

  const workdaysPerYear = Math.max(0, workdaysPerWeek * 52 - vacationDays - sickDays);
  const hoursPerTechYear = workdaysPerYear * hoursPerDay;
  const totalHoursYear = hoursPerTechYear * technicians;

  const efficiencyPct = clampPct(Number(jobType?.efficiency_percent ?? 100));
  const effectiveHoursYear = (totalHoursYear * efficiencyPct) / 100;

  const overheadPerHour = effectiveHoursYear > 0 ? overheadAnnual / effectiveHoursYear : 0;

  // Convert wage cost to cost per BILLABLE hour (efficiency applied)
  const cogsLaborPerBillableHour = effectiveHoursYear > 0 ? (avgTechWage * totalHoursYear) / effectiveHoursYear : 0;
  const cogsPerBillableHour = cogsLaborPerBillableHour;

  // Gross margin target (true GM: (Rev-COGS)/Rev)
  const grossMargin = clampPct(Number(jobType?.profit_margin_percent ?? 70)) / 100;
  const revenuePerBillableHourForGrossMargin = (() => {
    const denom = 1 - grossMargin;
    if (denom <= 0) return 0;
    return cogsPerBillableHour / denom;
  })();

  // Net profit goals (your locked rules)
  const mode = String(s?.net_profit_goal_mode ?? 'percent');
  const npPct = clampPct(Number(s?.net_profit_goal_percent_of_revenue ?? 0)) / 100;
  const npDollar = Math.max(0, Number(s?.net_profit_goal_amount_monthly ?? 0) || 0);
  const billableHoursPerMonth = effectiveHoursYear / 12;

  const revenuePerBillableHourForNetProfit = (() => {
    const costPlusOverhead = cogsPerBillableHour + overheadPerHour;
    if (mode === 'percent') {
      const denom = 1 - npPct;
      if (denom <= 0) return 0;
      return costPlusOverhead / denom;
    }
    const profitPerHour = billableHoursPerMonth > 0 ? npDollar / billableHoursPerMonth : 0;
    return costPlusOverhead + profitPerHour;
  })();

  return Math.max(revenuePerBillableHourForGrossMargin, revenuePerBillableHourForNetProfit);
}

/**
 * Assembly pricing (used by AssemblyEditorPage)
 */
export function computeAssemblyPricing(params: {
  assembly: Assembly;
  items: AssemblyItem[];
  materialsById: Record<UUID, Material>;
  jobTypesById: Record<UUID, JobType>;
  companySettings: CompanySettings;
}): PricingResult {
  const { assembly, items, materialsById, jobTypesById, companySettings } = params;

  const jobType = (assembly.job_type_id && jobTypesById[assembly.job_type_id]) || null;

  const billingMode = safeBillingMode(jobType);
  const purchaseTaxPct = getPurchaseTaxPercent(companySettings);
  const miscPct = getMiscMaterialPercent(companySettings);
  const tiers = getMarkupTiers(companySettings);

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  const lines: PricingLineBreakdown[] = [];

  const normItems = (Array.isArray(items) ? items : []).map((it: any) => {
    const type = (it?.type ?? it?.item_type ?? 'material') as any;
    return { ...it, type };
  });

  for (const item of normItems) {
    const qty = Number(item.quantity || 1) || 1;

    let materialCost = 0;
    let laborMinutes = 0;

    // Labor
    if (item.type === 'labor') {
      // Support either a split hours/minutes model or a minutes-only model.
      const hours = Number(item.labor_hours ?? 0) || 0;
      const minutes = Number(item.labor_minutes ?? 0) || 0;
      laborMinutes = (hours * 60 + minutes) * qty;
    }

    // Material (referenced)
    if (item.type === 'material') {
      const mat = item.material_id ? materialsById[item.material_id] : null;
      if (mat) {
        // Cost (supports base vs custom)
        const base = Number((mat as any).base_cost ?? (mat as any).unit_cost ?? 0) || 0;
        const useCustom = Boolean((mat as any).use_custom_cost);
        const customRaw = (mat as any).custom_cost;
        const custom = customRaw == null ? null : Number(customRaw);
        const unit = useCustom && custom != null && Number.isFinite(custom) ? custom : base;

        materialCost = unit * qty;
        if ((mat as any).taxable) {
          materialCost *= 1 + purchaseTaxPct / 100;
        }

        // Labor (support minutes-only or hours+minutes)
        const mh = Number((mat as any).labor_hours ?? 0) || 0;
        const mm = Number((mat as any).labor_minutes ?? 0) || 0;
        laborMinutes += (mh * 60 + mm) * qty;
      }
    }

    // Blank material (one-off)
    if (item.type === 'blank_material') {
      // Support both historical names: unit_cost vs material_cost
      const unit = Number(item.unit_cost ?? item.material_cost ?? 0) || 0;
      materialCost = unit * qty;
      if (item.taxable) {
        materialCost *= 1 + purchaseTaxPct / 100;
      }

      const bh = Number(item.labor_hours ?? 0) || 0;
      const bm = Number(item.labor_minutes ?? 0) || 0;
      laborMinutes += (bh * 60 + bm) * qty;
    }

    // Customer supplied materials => cost becomes 0 (labor remains)
    if ((assembly as any).customer_supplied_materials) {
      materialCost = 0;
    }

    materialCost = round2(materialCost);
    materialCostTotal += materialCost;
    laborMinutesTotal += laborMinutes;

    // Pricing
    let materialPrice = round2(applyTieredMarkup(materialCost, tiers));
    let laborPrice = 0;

    if (billingMode === 'hourly') {
      const avgWage = getAverageTechnicianWage(companySettings as any);
      const gm = clampPct(Number(jobType?.profit_margin_percent ?? 0)) / 100;
      const denom = 1 - gm;
      const hourlyRate = denom > 0 ? avgWage / denom : 0;
      laborPrice = (laborMinutes / 60) * hourlyRate;
    }

    lines.push({
      name: item.name,
      quantity: qty,
      material_cost: materialCost,
      labor_minutes: laborMinutes,
      material_price: materialPrice,
      labor_price: laborPrice,
      total_price: round2(materialPrice + laborPrice),
    });

    materialPriceTotal += materialPrice;
    laborPriceTotal += laborPrice;
  }

  // Flat-rate adjustments at total labor
  if (billingMode === 'flat') {
    const efficiency = clampPct(Number(jobType?.efficiency_percent ?? 100)) / 100;
    let expectedMinutes = efficiency > 0 ? laborMinutesTotal / efficiency : laborMinutesTotal;

    const minMinutes = Number((companySettings as any)?.min_billable_labor_minutes_per_job ?? 0) || 0;
    if (minMinutes > 0 && expectedMinutes < minMinutes) expectedMinutes = minMinutes;

    laborMinutesTotal = expectedMinutes;

    const ratePerBillableHour = computeRequiredRevenuePerBillableHour({ companySettings, jobType });
    laborPriceTotal = (laborMinutesTotal / 60) * ratePerBillableHour;

    // Update each line's labor pricing proportionally for display (keeps totals consistent)
    // If there are no labor minutes, keep labor lines at 0.
    const rawLaborMinutes = lines.reduce((sum, ln) => sum + (ln.labor_minutes || 0), 0);
    if (rawLaborMinutes > 0) {
      const multiplier = laborMinutesTotal / rawLaborMinutes;
      for (const ln of lines) {
        if (ln.labor_minutes > 0) {
          const adjMinutes = ln.labor_minutes * multiplier;
          ln.labor_price = round2((adjMinutes / 60) * ratePerBillableHour);
          ln.total_price = round2(ln.material_price + ln.labor_price);
        }
      }
    }
  }

  const miscMaterial = materialPriceTotal * (miscPct / 100);

  const totalPrice = materialPriceTotal + round2(laborPriceTotal) + miscMaterial;

  return {
    material_cost_total: round2(materialCostTotal),
    labor_minutes_total: Math.round(laborMinutesTotal),
    material_price_total: round2(materialPriceTotal),
    labor_price_total: round2(laborPriceTotal),
    misc_material_price: round2(miscMaterial),
    total_price: round2(totalPrice),
    lines,
  };
}

/**
 * Estimate pricing (used by EstimateEditorPage)
 *
 * Canonical behaviors implemented here:
 * - purchase tax applied to COST (internal) for taxable items
 * - tiered markup applied to cost_with_tax for MATERIAL PRICE
 * - customer supplies materials => material cost & price = 0, labor remains
 * - flat-rate: expected minutes = baseline ÷ efficiency, then min job minutes applied at estimate total
 * - hourly: hourly rate = wage ÷ (1 - gross_margin_target)
 * - misc material applied after material totals
 * - discount is estimate-level preload: pre_discount_total = target_total / (1 - discount)
 * - processing fee applied after discount preload
 */
export function computeEstimatePricing(params: {
  estimate: any;
  materialsById: Record<string, Material | null | undefined>;
  assembliesById: Record<string, any | null | undefined>;
  jobTypesById: Record<string, JobType>;
  companySettings: CompanySettings;
}): {
  // Baselines
  labor_minutes_actual: number;
  labor_minutes_expected: number;

  material_cost: number;
  material_price: number;
  labor_price: number;
  misc_material_price: number;

  discount_percent: number;
  pre_discount_total: number;
  discount_amount: number;

  subtotal_before_processing: number;
  processing_fee: number;
  total: number;

  gross_margin_target_percent: number | null;
  gross_margin_expected_percent: number | null;

  lines: PricingLineBreakdown[];
} {
  const { estimate, materialsById, assembliesById, jobTypesById, companySettings } = params;

  const purchaseTaxPct = getPurchaseTaxPercent(companySettings);
  const miscPct = getMiscMaterialPercent(companySettings);
  const tiers = getMarkupTiers(companySettings);
  const processingPct =
    Number((companySettings as any)?.processing_fee_percent ?? (companySettings as any)?.processing_percent ?? 0) || 0;

  // Effective job type (simple + stable for v1 UI):
  // estimate job type > first assembly job type > first material job type > default job type
  const defaultJobType = Object.values(jobTypesById).find((jt: any) => Boolean((jt as any)?.is_default)) ?? null;

  const items = Array.isArray(estimate?.items) ? estimate.items : [];

  const firstAssemblyJobTypeId = (() => {
    for (const it of items) {
      const asmId = it?.assembly_id ?? it?.assemblyId;
      const asm = asmId ? assembliesById[String(asmId)] : null;
      const jt = asm?.job_type_id ?? null;
      if (jt) return jt;
    }
    return null;
  })();

  const firstMaterialJobTypeId = (() => {
    for (const it of items) {
      const matId = it?.material_id ?? it?.materialId;
      const mat = matId ? materialsById[String(matId)] : null;
      const jt = (mat as any)?.job_type_id ?? null;
      if (jt) return jt;
    }
    return null;
  })();

  const effectiveJobType: any =
    (estimate?.job_type_id && jobTypesById[String(estimate.job_type_id)]) ||
    (firstAssemblyJobTypeId && jobTypesById[String(firstAssemblyJobTypeId)]) ||
    (firstMaterialJobTypeId && jobTypesById[String(firstMaterialJobTypeId)]) ||
    defaultJobType;

  const billingMode = safeBillingMode(effectiveJobType);

  const customerSupplies = Boolean(estimate?.customer_supplies_materials ?? estimate?.customer_supplied_materials ?? false);
  const applyMisc = Boolean(estimate?.apply_misc_material ?? true);
  const applyProcessing = Boolean(estimate?.apply_processing_fees ?? false);

  let materialCost = 0;
  let materialPrice = 0;
  let laborMinutesActual = 0; // baseline
  let laborMinutesExpected = 0; // after efficiency + min minutes (flat only)
  let laborPrice = 0;

  const lines: PricingLineBreakdown[] = [];

  // 1) Build baseline sums (cost + baseline labor minutes)
  for (const it of items) {
    const type = String(it?.type ?? (it?.material_id ? 'material' : it?.assembly_id ? 'assembly' : '')).toLowerCase();
    const qty = Number(it?.quantity ?? 1) || 1;

    if (type === 'material') {
      const matId = it?.material_id ?? it?.materialId;
      const mat = matId ? materialsById[String(matId)] : null;
      if (!mat) continue;

      const base = Number((mat as any).base_cost ?? (mat as any).unit_cost ?? 0) || 0;
      const useCustom = Boolean((mat as any).use_custom_cost);
      const customRaw = (mat as any).custom_cost;
      const custom = customRaw == null ? null : Number(customRaw);
      const unit = useCustom && custom != null && Number.isFinite(custom) ? custom : base;

      let cost = unit * qty;
      if (Boolean((mat as any).taxable)) cost *= 1 + purchaseTaxPct / 100;

      const mh = Number((mat as any).labor_hours ?? 0) || 0;
      const mm = Number((mat as any).labor_minutes ?? 0) || 0;
      const minutes = (mh * 60 + mm) * qty;

      if (customerSupplies) cost = 0;

      cost = round2(cost);
      materialCost += cost;
      laborMinutesActual += minutes;

      const price = round2(applyTieredMarkup(cost, tiers));
      materialPrice += price;

      lines.push({
        name: (mat as any).name,
        quantity: qty,
        material_cost: cost,
        labor_minutes: minutes,
        material_price: price,
        labor_price: 0,
        total_price: round2(price),
      });
      continue;
    }

    if (type === 'assembly') {
      const asmId = it?.assembly_id ?? it?.assemblyId;
      const asm = asmId ? assembliesById[String(asmId)] : null;
      if (!asm) continue;

      // Respect estimate-level customer supplies materials by cloning assembly flag.
      const asmForPricing = customerSupplies ? { ...asm, customer_supplied_materials: true } : asm;

      const asmPricing = computeAssemblyPricing({
        assembly: asmForPricing,
        items: (asmForPricing as any).items ?? [],
        materialsById: materialsById as any,
        jobTypesById,
        companySettings,
      });

      materialCost += asmPricing.material_cost_total * qty;
      materialPrice += asmPricing.material_price_total * qty;

      // Baseline labor minutes: use the per-line baseline minutes (NOT adjusted minutes_total)
      const asmBaselineMinutes = (asmPricing.lines ?? []).reduce((sum, ln) => sum + (ln.labor_minutes || 0), 0);
      laborMinutesActual += asmBaselineMinutes * qty;

      lines.push({
        name: (asmForPricing as any).name,
        quantity: qty,
        material_cost: round2(asmPricing.material_cost_total * qty),
        labor_minutes: Math.round(asmBaselineMinutes * qty),
        material_price: round2(asmPricing.material_price_total * qty),
        labor_price: 0,
        total_price: round2(asmPricing.material_price_total * qty),
      });
      continue;
    }
  }

  // 2) Labor minutes expected + labor pricing
  if (billingMode === 'hourly') {
    laborMinutesExpected = laborMinutesActual;

    const avgWage = getAverageTechnicianWage(companySettings as any);
    const gm = clampPct(Number((effectiveJobType as any)?.profit_margin_percent ?? 0)) / 100;
    const denom = 1 - gm;
    const hourlyRate = denom > 0 ? avgWage / denom : 0;

    laborPrice = round2((laborMinutesExpected / 60) * hourlyRate);
  } else {
    const efficiency = clampPct(Number((effectiveJobType as any)?.efficiency_percent ?? 100)) / 100;
    let expected = efficiency > 0 ? laborMinutesActual / efficiency : laborMinutesActual;

    const minMinutes = Number((companySettings as any)?.min_billable_labor_minutes_per_job ?? 0) || 0;
    if (minMinutes > 0 && expected < minMinutes) expected = minMinutes;

    laborMinutesExpected = expected;

    const ratePerBillableHour = computeRequiredRevenuePerBillableHour({
      companySettings,
      jobType: effectiveJobType,
    });

    laborPrice = round2((laborMinutesExpected / 60) * ratePerBillableHour);
  }

  // 3) Misc material
  const miscMaterialPrice = applyMisc ? round2(materialPrice * (miscPct / 100)) : 0;

  // 4) Base subtotal (target total before discount preload)
  const targetSubtotal = round2(materialPrice + laborPrice + miscMaterialPrice);

  // 5) Discount preload logic (estimate-level)
  const discountPct = clampPct(Number(estimate?.discount_percent ?? 0));
  const discountRate = discountPct / 100;

  const preDiscountTotal = discountRate > 0 ? round2(targetSubtotal / (1 - discountRate)) : targetSubtotal;
  const discountAmount = round2(preDiscountTotal - targetSubtotal);

  const subtotalBeforeProcessing = preDiscountTotal;

  // 6) Processing fee
  const processingFee = applyProcessing ? round2(subtotalBeforeProcessing * (processingPct / 100)) : 0;
  const total = round2(subtotalBeforeProcessing + processingFee);

  // 7) Gross margin signals (expected)
  const avgWage = getAverageTechnicianWage(companySettings as any);
  const laborCost = round2((laborMinutesActual / 60) * avgWage);
  const cogs = round2(materialCost + laborCost);

  const expectedGM =
    subtotalBeforeProcessing > 0 ? ((subtotalBeforeProcessing - cogs) / subtotalBeforeProcessing) * 100 : null;
  const targetGM = effectiveJobType ? clampPct(Number((effectiveJobType as any)?.profit_margin_percent ?? 0)) : null;

  // 8) Allocate laborPrice back to lines for display (proportional to baseline minutes)
  const rawMinutes = lines.reduce((sum, ln) => sum + (ln.labor_minutes || 0), 0);
  if (rawMinutes > 0 && laborPrice > 0) {
    // If flat rate bumped minutes, distribute by baseline minutes but allocate total laborPrice.
    const multiplier = laborMinutesExpected / rawMinutes;
    for (const ln of lines) {
      if (ln.labor_minutes > 0) {
        const adjMinutes = ln.labor_minutes * multiplier;
        ln.labor_price = round2((adjMinutes / Math.max(1, laborMinutesExpected)) * laborPrice);
        ln.total_price = round2(ln.material_price + ln.labor_price);
      }
    }
  }

  return {
    labor_minutes_actual: Math.round(laborMinutesActual),
    labor_minutes_expected: Math.round(laborMinutesExpected),

    material_cost: round2(materialCost),
    material_price: round2(materialPrice),
    labor_price: round2(laborPrice),
    misc_material_price: round2(miscMaterialPrice),

    discount_percent: round2(discountPct),
    pre_discount_total: round2(preDiscountTotal),
    discount_amount: round2(discountAmount),

    subtotal_before_processing: round2(subtotalBeforeProcessing),
    processing_fee: round2(processingFee),
    total: round2(total),

    gross_margin_target_percent: targetGM == null ? null : round2(targetGM),
    gross_margin_expected_percent: expectedGM == null ? null : round2(expectedGM),

    lines,
  };
}
