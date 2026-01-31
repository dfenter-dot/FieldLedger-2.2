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

/* -------------------- helpers -------------------- */

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function safeNum(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function safeInt(n: any, fallback = 0) {
  return Math.floor(safeNum(n, fallback));
}

function isTruthy(v: any) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function getPurchaseTaxPercent(companySettings: CompanySettings) {
  // supports multiple legacy field names
  return (
    safeNum((companySettings as any)?.purchase_tax_percent ?? (companySettings as any)?.purchaseTaxPercent ?? 0) || 0
  );
}

function getMiscMaterialPercent(companySettings: CompanySettings) {
  return (
    safeNum((companySettings as any)?.misc_material_percent ?? (companySettings as any)?.miscMaterialPercent ?? 0) || 0
  );
}

function getProcessingFeePercent(companySettings: CompanySettings) {
  return (
    safeNum(
      (companySettings as any)?.processing_fee_percent ??
        (companySettings as any)?.processingFeePercent ??
        (companySettings as any)?.processing_percent ??
        0
    ) || 0
  );
}

function getDiscountPercentDefault(companySettings: CompanySettings) {
  return (
    safeNum(
      (companySettings as any)?.default_discount_percent ??
        (companySettings as any)?.discount_percent_default ??
        (companySettings as any)?.discountPercentDefault ??
        0
    ) || 0
  );
}

function getMinBillableLaborMinutes(companySettings: CompanySettings) {
  return (
    safeNum(
      (companySettings as any)?.min_billable_labor_minutes_per_job ??
        (companySettings as any)?.minimum_labor_minutes_per_job ??
        (companySettings as any)?.minBillableLaborMinutesPerJob ??
        0
    ) || 0
  );
}

function getMaterialMarkupPercent(companySettings: CompanySettings, costWithTax: number) {
  // Supports either fixed or tiered markup structures.
  // If tiered, expect companySettings.material_markups = [{min,max,markup_percent}]
  const fixed =
    (companySettings as any)?.material_markup_percent ??
    (companySettings as any)?.materialMarkupPercent ??
    (companySettings as any)?.markup_percent ??
    null;

  if (fixed != null) return safeNum(fixed, 0);

  const tiers = (companySettings as any)?.material_markups ?? (companySettings as any)?.materialMarkups ?? null;
  if (Array.isArray(tiers) && tiers.length) {
    const c = safeNum(costWithTax, 0);
    const t = tiers.find((x: any) => c >= safeNum(x.min, 0) && c <= safeNum(x.max, Number.POSITIVE_INFINITY));
    if (t) return safeNum(t.markup_percent ?? t.markupPercent ?? 0, 0);
  }
  return 0;
}

/**
 * Required revenue / billable hour used in flat-rate mode.
 * This is intentionally conservative and accepts partial settings.
 */
export function computeRequiredRevenuePerBillableHour(params: {
  companySettings: CompanySettings;
  jobType?: JobType | null;
}) {
  const { companySettings, jobType } = params;

  // Derived billable hours per month – accept cached or compute fallback.
  const billableHours =
    safeNum((companySettings as any)?.billable_hours_per_month ?? (companySettings as any)?.billableHoursPerMonth, 0) ||
    safeNum((companySettings as any)?.billable_hours_month ?? (companySettings as any)?.billableHoursMonth, 0) ||
    160;

  const monthlyOverhead =
    safeNum((companySettings as any)?.monthly_overhead ?? (companySettings as any)?.monthlyOverhead, 0) ||
    safeNum((companySettings as any)?.overhead_monthly ?? (companySettings as any)?.overheadMonthly, 0) ||
    0;

  // net profit goal: either percent of revenue OR fixed monthly amount
  const profitIsPercent = isTruthy((companySettings as any)?.net_profit_is_percent ?? (companySettings as any)?.profitIsPercent);
  const netProfitPercent = safeNum((companySettings as any)?.net_profit_percent ?? (companySettings as any)?.netProfitPercent, 0);
  const netProfitFixed = safeNum((companySettings as any)?.net_profit_fixed ?? (companySettings as any)?.netProfitFixed, 0);

  // If percent, profit = percent * revenue, so revenue = overhead / (1 - percent)
  // If fixed, revenue = overhead + fixed
  const revenueGoalMonthly = profitIsPercent && netProfitPercent > 0 && netProfitPercent < 100
    ? monthlyOverhead / (1 - netProfitPercent / 100)
    : monthlyOverhead + netProfitFixed;

  const revenuePerHourBase = billableHours > 0 ? revenueGoalMonthly / billableHours : 0;

  // JobType gross margin target can influence effective rate in flat-rate mode.
  // Keep it mild: if GM target exists, scale rate upward so that labor+materials can hit GM later.
  const gmTarget = safeNum((jobType as any)?.gross_margin_target_percent ?? (jobType as any)?.grossMarginTargetPercent, 0);
  const gmFactor = gmTarget > 0 && gmTarget < 100 ? 1 / (1 - gmTarget / 100) : 1;

  return round2(revenuePerHourBase * gmFactor);
}

/* -------------------- pricing: assembly -------------------- */

export function computeAssemblyPricing(params: {
  assembly: Assembly;
  materialsById: Record<string, Material | null | undefined>;
  jobType: JobType | null;
  companySettings: CompanySettings;
}): PricingResult {
  const { assembly, materialsById, jobType, companySettings } = params;

  const billingMode: 'flat' | 'hourly' =
    ((jobType as any)?.mode ?? (jobType as any)?.pricing_mode ?? 'flat') === 'hourly' ? 'hourly' : 'flat';

  const purchaseTaxPct = getPurchaseTaxPercent(companySettings);
  const miscPct = getMiscMaterialPercent(companySettings);

  const miscWhenCustomerSupplies = Boolean(
    (companySettings as any)?.misc_when_customer_supplies ?? (companySettings as any)?.miscWhenCustomerSupplies ?? false
  );

  const lines: PricingLineBreakdown[] = [];

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  const items: AssemblyItem[] = Array.isArray((assembly as any)?.items) ? ((assembly as any).items as any) : [];

  // Used only if customer supplies materials AND admin allows misc to apply anyway (against labor).
  let materialPriceTotalForMisc = 0;

  for (const it of items) {
    const qty = Math.max(0, safeNum((it as any)?.quantity ?? 1, 1));

    // Labor-only line
    if ((it as any)?.type === 'labor' || (it as any)?.labor_minutes != null) {
      const minutes = Math.max(0, safeNum((it as any)?.labor_minutes ?? (it as any)?.minutes ?? 0, 0));
      const totalMinutes = minutes * qty;

      laborMinutesTotal += totalMinutes;

      let laborPrice = 0;
      if (billingMode === 'hourly') {
        const avgWage =
          safeNum(
            (companySettings as any)?.avg_hourly_wage ??
              (companySettings as any)?.average_hourly_wage ??
              (companySettings as any)?.averageHourlyWage ??
              0
          ) || 0;

        const gm = clampPct(safeNum((jobType as any)?.gross_margin_target_percent ?? 0, 0));
        const hourlyRate = gm > 0 && gm < 100 ? avgWage / (1 - gm / 100) : avgWage;

        laborPrice = (totalMinutes / 60) * hourlyRate;
      }

      lines.push({
        id: (it as any)?.id ?? crypto.randomUUID(),
        type: 'labor',
        name: (it as any)?.name ?? 'Labor',
        quantity: qty,
        labor_minutes: totalMinutes,
        material_cost: 0,
        material_price: 0,
        labor_price: round2(laborPrice),
        total_price: round2(laborPrice),
      });

      laborPriceTotal += laborPrice;
      continue;
    }

    // Material line
    const materialId = (it as any)?.material_id ?? (it as any)?.materialId ?? null;
    if (materialId) {
      const m = materialsById[String(materialId)];
      const baseCost = safeNum((m as any)?.base_cost ?? (m as any)?.cost ?? 0, 0);
      const customCost = safeNum((m as any)?.custom_cost ?? (m as any)?.customCost ?? 0, 0);
      const useCustom = Boolean((m as any)?.use_custom_cost ?? (m as any)?.useCustomCost ?? false);
      const cost = useCustom ? customCost : baseCost;

      const taxable = Boolean((m as any)?.taxable ?? false);
      const costWithTax = taxable ? cost * (1 + purchaseTaxPct / 100) : cost;

      const markupPct = getMaterialMarkupPercent(companySettings, costWithTax);
      const price = costWithTax * (1 + markupPct / 100);

      // material labor time baseline
      const laborHours = safeInt((m as any)?.labor_hours ?? (m as any)?.laborHours ?? 0, 0);
      const laborMinutes = safeInt((m as any)?.labor_minutes ?? (m as any)?.laborMinutes ?? 0, 0);
      const baselineMinutes = laborHours * 60 + laborMinutes;

      const totalCost = costWithTax * qty;
      const totalPrice = price * qty;
      const totalLaborMinutes = baselineMinutes * qty;

      materialCostTotal += totalCost;
      materialPriceTotal += totalPrice;
      materialPriceTotalForMisc += totalPrice;
      laborMinutesTotal += totalLaborMinutes;

      lines.push({
        id: (it as any)?.id ?? crypto.randomUUID(),
        type: 'material',
        name: (m as any)?.name ?? (it as any)?.name ?? 'Material',
        quantity: qty,
        labor_minutes: totalLaborMinutes,
        material_cost: round2(totalCost),
        material_price: round2(totalPrice),
        labor_price: 0,
        total_price: round2(totalPrice),
      });

      continue;
    }

    // One-off / blank material line (stored on the assembly)
    const name = (it as any)?.name ?? 'Material';
    const oneOffCost = safeNum((it as any)?.cost ?? 0, 0);
    const oneOffTaxable = Boolean((it as any)?.taxable ?? false);
    const oneOffCostWithTax = oneOffTaxable ? oneOffCost * (1 + purchaseTaxPct / 100) : oneOffCost;
    const oneOffMarkupPct = getMaterialMarkupPercent(companySettings, oneOffCostWithTax);
    const oneOffPrice = oneOffCostWithTax * (1 + oneOffMarkupPct / 100);

    const oneOffLabor = Math.max(0, safeInt((it as any)?.labor_minutes ?? (it as any)?.minutes ?? 0, 0));

    const totalCost = oneOffCostWithTax * qty;
    const totalPrice = oneOffPrice * qty;
    const totalLaborMinutes = oneOffLabor * qty;

    materialCostTotal += totalCost;
    materialPriceTotal += totalPrice;
    materialPriceTotalForMisc += totalPrice;
    laborMinutesTotal += totalLaborMinutes;

    lines.push({
      id: (it as any)?.id ?? crypto.randomUUID(),
      type: 'material',
      name,
      quantity: qty,
      labor_minutes: totalLaborMinutes,
      material_cost: round2(totalCost),
      material_price: round2(totalPrice),
      labor_price: 0,
      total_price: round2(totalPrice),
    });
  }

  // Flat-rate adjustments at total labor
  if (billingMode === 'flat') {
    const efficiency = clampPct(Number((jobType as any)?.efficiency_percent ?? (jobType as any)?.efficiencyPercent ?? 100)) / 100;
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

  // Misc material normally tracks material sell totals.
  // When the customer supplies materials, material sell becomes $0. If Admin allows
  // misc to still apply in that scenario, apply it against labor sell instead.
  const customerSuppliesForAsm = Boolean(
    (assembly as any).customer_supplied_materials ?? (assembly as any).customer_supplies_materials
  );
  const miscBase = customerSuppliesForAsm
    ? (miscWhenCustomerSupplies ? materialPriceTotalForMisc : 0)
    : materialPriceTotal;
  const miscMaterial = miscBase * (miscPct / 100);

  const baseTotal = materialPriceTotal + round2(laborPriceTotal) + miscMaterial;

  // Discount (preload) + Processing Fees sequencing (ESTIMATES ONLY)
  // Assemblies do not apply discount or processing fees. Those toggles live at the estimate level.
  const displayedSubtotal = baseTotal;
  const discountAmount = 0;
  const processingFee = 0;
  const totalPrice = baseTotal;

  return {
    material_cost_total: round2(materialCostTotal),
    labor_minutes_total: Math.round(laborMinutesTotal),
    material_price_total: round2(materialPriceTotal),
    labor_price_total: round2(laborPriceTotal),
    misc_material_price: round2(miscMaterial),
    subtotal_price: round2(displayedSubtotal),
    discount_amount: round2(discountAmount),
    processing_fee: round2(processingFee),
    total_price: round2(totalPrice),
    // ---- Legacy UI compatibility fields (prevent blank screens due to undefined .toFixed())
    material_cost: round2(materialCostTotal),
    material_price: round2(materialPriceTotal),
    labor_price: round2(laborPriceTotal),
    misc_material: round2(miscMaterial),
    labor_minutes_actual: Math.round(laborMinutesTotal),
    labor_minutes_expected: Math.round(laborMinutesTotal),
    discount_percent: 0,
    pre_discount_total: round2(displayedSubtotal),
    subtotal_before_processing: round2(baseTotal),
    total: round2(totalPrice),
    gross_margin_target_percent: null,
    gross_margin_expected_percent: null,
    lines,
  };
}

/**
 * Estimate pricing (used by EstimateEditorPage)
 * NOTE: This matches the object signature being called in EstimateEditorPage.tsx.
 */
export function computeEstimatePricing(params: {
  estimate: any;
  materialsById: Record<string, Material | null | undefined>;
  assembliesById: Record<string, any | null | undefined>;
  jobTypesById: Record<string, JobType>;
  companySettings: CompanySettings;
}): {
  material_cost_total: number;
  labor_minutes_total: number;
  material_price_total: number;
  labor_price_total: number;
  misc_material_price: number;
  total_price: number;
  lines: PricingLineBreakdown[];
} {
  const { estimate, materialsById, assembliesById, jobTypesById, companySettings } = params;

  const jobType = (estimate?.job_type_id && jobTypesById[estimate.job_type_id]) || null;
  const purchaseTaxPct = getPurchaseTaxPercent(companySettings);
  const miscPct = getMiscMaterialPercent(companySettings);
  const processingPct = getProcessingFeePercent(companySettings);

  const miscWhenCustomerSupplies = Boolean(
    (companySettings as any)?.misc_when_customer_supplies ?? (companySettings as any)?.miscWhenCustomerSupplies ?? false
  );

  const billingMode: 'flat' | 'hourly' =
    ((jobType as any)?.mode ?? (jobType as any)?.pricing_mode ?? 'flat') === 'hourly' ? 'hourly' : 'flat';

  const customerSupplies = Boolean(
    estimate?.customer_supplied_materials ?? estimate?.customer_supplies_materials
  );

  const items = Array.isArray(estimate?.items) ? estimate.items : [];

  const lines: PricingLineBreakdown[] = [];

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  // if customer supplies materials, material sell becomes 0.
  let materialPriceTotalForMisc = 0;

  for (const it of items) {
    const qty = Math.max(0, safeNum(it.quantity ?? 1, 1));

    // Material line (estimate references a material)
    if (it.material_id) {
      const m = materialsById[String(it.material_id)];
      const baseCost = safeNum((m as any)?.base_cost ?? (m as any)?.cost ?? 0, 0);
      const customCost = safeNum((m as any)?.custom_cost ?? (m as any)?.customCost ?? 0, 0);
      const useCustom = Boolean((m as any)?.use_custom_cost ?? (m as any)?.useCustomCost ?? false);
      const cost = useCustom ? customCost : baseCost;

      const taxable = Boolean((m as any)?.taxable ?? false);
      const costWithTax = taxable ? cost * (1 + purchaseTaxPct / 100) : cost;

      const markupPct = getMaterialMarkupPercent(companySettings, costWithTax);
      const priceEach = costWithTax * (1 + markupPct / 100);

      // baseline minutes
      const laborHours = safeInt((m as any)?.labor_hours ?? (m as any)?.laborHours ?? 0, 0);
      const laborMinutes = safeInt((m as any)?.labor_minutes ?? (m as any)?.laborMinutes ?? 0, 0);
      const baselineMinutes = laborHours * 60 + laborMinutes;

      const totalCost = costWithTax * qty;
      const totalPrice = customerSupplies ? 0 : priceEach * qty;
      const totalLaborMinutes = baselineMinutes * qty;

      materialCostTotal += totalCost;
      materialPriceTotal += totalPrice;
      materialPriceTotalForMisc += priceEach * qty;
      laborMinutesTotal += totalLaborMinutes;

      lines.push({
        id: it.id ?? crypto.randomUUID(),
        type: 'material',
        name: (m as any)?.name ?? 'Material',
        quantity: qty,
        labor_minutes: totalLaborMinutes,
        material_cost: round2(totalCost),
        material_price: round2(totalPrice),
        labor_price: 0,
        total_price: round2(totalPrice),
      });

      continue;
    }

    // Assembly line (estimate references an assembly)
    if (it.assembly_id) {
      const a = assembliesById[String(it.assembly_id)];
      const asmJobType = (a as any)?.job_type_id ? jobTypesById[(a as any).job_type_id] ?? null : jobType;

      if (a) {
        const asmTotals = computeAssemblyPricing({
          assembly: a as any,
          materialsById,
          jobType: asmJobType,
          companySettings,
        });

        // Multiply totals by estimate qty
        const matCost = safeNum((asmTotals as any).material_cost_total ?? (asmTotals as any).material_cost, 0) * qty;
        const matPriceRaw = safeNum((asmTotals as any).material_price_total ?? (asmTotals as any).material_price, 0) * qty;
        const labPrice = safeNum((asmTotals as any).labor_price_total ?? (asmTotals as any).labor_price, 0) * qty;
        const misc = safeNum((asmTotals as any).misc_material_price ?? (asmTotals as any).misc_material, 0) * qty;
        const labMin = safeNum((asmTotals as any).labor_minutes_total ?? (asmTotals as any).labor_minutes_expected, 0) * qty;

        const matPrice = customerSupplies ? 0 : matPriceRaw;

        materialCostTotal += matCost;
        materialPriceTotal += matPrice + misc; // misc remains part of sell total
        materialPriceTotalForMisc += matPriceRaw + misc; // for misc logic when customer supplies
        laborPriceTotal += labPrice;
        laborMinutesTotal += labMin;

        lines.push({
          id: it.id ?? crypto.randomUUID(),
          type: 'assembly',
          name: (a as any)?.name ?? 'Assembly',
          quantity: qty,
          labor_minutes: Math.round(labMin),
          material_cost: round2(matCost),
          material_price: round2(matPrice + misc),
          labor_price: round2(labPrice),
          total_price: round2(matPrice + misc + labPrice),
        });
      } else {
        // unknown assembly fallback
        lines.push({
          id: it.id ?? crypto.randomUUID(),
          type: 'assembly',
          name: 'Assembly',
          quantity: qty,
          labor_minutes: 0,
          material_cost: 0,
          material_price: 0,
          labor_price: 0,
          total_price: 0,
        });
      }
      continue;
    }

    // Labor line
    if (it.type === 'labor' || it.labor_minutes != null) {
      const minutes = Math.max(0, safeNum(it.labor_minutes ?? 0, 0));
      const totalMinutes = minutes * qty;
      laborMinutesTotal += totalMinutes;

      let laborPrice = 0;
      if (billingMode === 'hourly') {
        const avgWage =
          safeNum(
            (companySettings as any)?.avg_hourly_wage ??
              (companySettings as any)?.average_hourly_wage ??
              (companySettings as any)?.averageHourlyWage ??
              0
          ) || 0;

        const gm = clampPct(safeNum((jobType as any)?.gross_margin_target_percent ?? 0, 0));
        const hourlyRate = gm > 0 && gm < 100 ? avgWage / (1 - gm / 100) : avgWage;

        laborPrice = (totalMinutes / 60) * hourlyRate;
      }

      laborPriceTotal += laborPrice;

      lines.push({
        id: it.id ?? crypto.randomUUID(),
        type: 'labor',
        name: it.name ?? 'Labor',
        quantity: qty,
        labor_minutes: totalMinutes,
        material_cost: 0,
        material_price: 0,
        labor_price: round2(laborPrice),
        total_price: round2(laborPrice),
      });

      continue;
    }

    // Blank material line (one-off local to estimate)
    const oneOffCost = safeNum(it.cost ?? 0, 0);
    const taxable = Boolean(it.taxable ?? false);
    const costWithTax = taxable ? oneOffCost * (1 + purchaseTaxPct / 100) : oneOffCost;

    const markupPct = getMaterialMarkupPercent(companySettings, costWithTax);
    const priceEach = costWithTax * (1 + markupPct / 100);

    const laborMin = Math.max(0, safeInt(it.labor_minutes ?? 0, 0));

    const totalCost = costWithTax * qty;
    const totalPrice = customerSupplies ? 0 : priceEach * qty;
    const totalLaborMinutes = laborMin * qty;

    materialCostTotal += totalCost;
    materialPriceTotal += totalPrice;
    materialPriceTotalForMisc += priceEach * qty;
    laborMinutesTotal += totalLaborMinutes;

    lines.push({
      id: it.id ?? crypto.randomUUID(),
      type: 'material',
      name: it.name ?? 'Material',
      quantity: qty,
      labor_minutes: totalLaborMinutes,
      material_cost: round2(totalCost),
      material_price: round2(totalPrice),
      labor_price: 0,
      total_price: round2(totalPrice),
    });
  }

  // Flat-rate estimate-level labor adjustments and labor pricing
  if (billingMode === 'flat') {
    const efficiency = clampPct(Number((jobType as any)?.efficiency_percent ?? (jobType as any)?.efficiencyPercent ?? 100)) / 100;
    let expectedMinutes = efficiency > 0 ? laborMinutesTotal / efficiency : laborMinutesTotal;

    const minMinutes = getMinBillableLaborMinutes(companySettings);
    if (minMinutes > 0 && expectedMinutes < minMinutes) expectedMinutes = minMinutes;

    laborMinutesTotal = expectedMinutes;

    const ratePerBillableHour = computeRequiredRevenuePerBillableHour({ companySettings, jobType });
    laborPriceTotal = (laborMinutesTotal / 60) * ratePerBillableHour;

    // proportionally distribute labor price for display lines
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

  // Misc material (estimate-level)
  const miscBase = customerSupplies ? (miscWhenCustomerSupplies ? materialPriceTotalForMisc : 0) : materialPriceTotal;
  const miscMaterial = miscBase * (miscPct / 100);

  const baseTotal = materialPriceTotal + round2(laborPriceTotal) + miscMaterial;

  // Discount (preload) + Processing Fees sequencing (per spec)
  const applyDiscount = Boolean(estimate?.apply_discount ?? estimate?.applyDiscount ?? false);
  const discountPctRaw =
    safeNum(estimate?.discount_percent ?? estimate?.discountPercent ?? null, NaN);
  const discountPct = Number.isFinite(discountPctRaw)
    ? clampPct(discountPctRaw)
    : clampPct(getDiscountPercentDefault(companySettings));

  let displayedSubtotal = baseTotal;
  let discountAmount = 0;
  let totalAfterDiscount = baseTotal;

  if (applyDiscount && discountPct > 0 && discountPct < 100) {
    displayedSubtotal = baseTotal / (1 - discountPct / 100);
    discountAmount = displayedSubtotal - baseTotal;
    totalAfterDiscount = baseTotal; // preload keeps final equal to target
  }

  const applyProcessing = Boolean(estimate?.apply_processing_fees ?? estimate?.applyProcessingFees ?? false);
  const processingFee = applyProcessing && processingPct > 0 ? totalAfterDiscount * (processingPct / 100) : 0;

  const totalPrice = totalAfterDiscount + processingFee;

  // Provide both modern and legacy fields so older UI does not crash.
  return {
    material_cost_total: round2(materialCostTotal),
    labor_minutes_total: Math.round(laborMinutesTotal),
    material_price_total: round2(materialPriceTotal),
    labor_price_total: round2(laborPriceTotal),
    misc_material_price: round2(miscMaterial),
    total_price: round2(totalPrice),
    lines,

    // Legacy UI compatibility (many pages expect these exact names)
    material_cost: round2(materialCostTotal),
    material_price: round2(materialPriceTotal),
    labor_price: round2(laborPriceTotal),
    misc_material: round2(miscMaterial),
    labor_minutes_actual: Math.round(laborMinutesTotal),
    labor_minutes_expected: Math.round(laborMinutesTotal),
    discount_percent: applyDiscount ? round2(discountPct) : 0,
    pre_discount_total: round2(displayedSubtotal),
    discount_amount: round2(discountAmount),
    subtotal_before_processing: round2(baseTotal),
    processing_fee: round2(processingFee),
    total: round2(totalPrice),
    gross_margin_target_percent: null,
    gross_margin_expected_percent: null,
  } as any;
}
