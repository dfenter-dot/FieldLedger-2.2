import {
  Assembly,
  AssemblyItem,
  CompanySettings,
  Estimate,
  EstimateItem,
  JobType,
  Material,
} from './types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export function applyEfficiency(
  baselineMinutes: number,
  efficiencyPercent: number
): number {
  if (!efficiencyPercent || efficiencyPercent <= 0) return baselineMinutes;
  return Math.ceil(baselineMinutes / (efficiencyPercent / 100));
}

export function getMarkupPercent(
  cost: number,
  tiers: CompanySettings['material_markup_tiers']
): number {
  const tier = tiers.find(t => cost >= t.min && cost <= t.max);
  return tier ? tier.markup_percent : 0;
}

/* ------------------------------------------------------------------ */
/* Material Pricing                                                    */
/* ------------------------------------------------------------------ */

export function computeMaterialCost(
  material: Material,
  settings: CompanySettings
): {
  baseCost: number;
  tax: number;
  markup: number;
  misc: number;
  total: number;
} {
  const cost = material.use_custom_cost && material.custom_cost != null
    ? material.custom_cost
    : material.unit_cost;

  const tax = cost * (settings.material_purchase_tax_percent / 100);
  const markupPercent = getMarkupPercent(cost, settings.material_markup_tiers);
  const markup = cost * (markupPercent / 100);
  const misc = (cost + tax + markup) * (settings.misc_material_percent / 100);

  return {
    baseCost: cost,
    tax,
    markup,
    misc,
    total: cost + tax + markup + misc,
  };
}

/* ------------------------------------------------------------------ */
/* Assembly Pricing                                                    */
/* ------------------------------------------------------------------ */

export function computeAssemblyPricing(
  assembly: Assembly,
  materials: Material[],
  settings: CompanySettings,
  jobTypes: JobType[]
) {
  let materialTotal = 0;
  let laborMinutesBaseline = 0;

  for (const item of assembly.items) {
    if (item.type === 'material') {
      const mat = materials.find(m => m.id === item.id);
      if (!mat) continue;

      const pricing = computeMaterialCost(mat, settings);
      materialTotal += pricing.total * item.quantity;
      laborMinutesBaseline += mat.labor_minutes * item.quantity;
    }

    if (item.type === 'oneoff') {
      materialTotal += item.unit_cost * item.quantity;
      laborMinutesBaseline += item.labor_minutes * item.quantity;
    }

    if (item.type === 'labor') {
      laborMinutesBaseline += item.labor_minutes * item.quantity;
    }
  }

  const jobType = jobTypes.find(j => j.id === assembly.job_type_id);
  const efficiency = jobType?.efficiency_percent ?? 100;

  const laborMinutesExpected = applyEfficiency(
    laborMinutesBaseline,
    efficiency
  );

  return {
    materialTotal,
    laborMinutesBaseline,
    laborMinutesExpected,
  };
}

/* ------------------------------------------------------------------ */
/* Estimate Pricing                                                    */
/* ------------------------------------------------------------------ */

export function computeEstimatePricing(
  estimate: Estimate,
  settings: CompanySettings,
  jobTypes: JobType[]
) {
  let materialSubtotal = 0;
  let laborMinutesBaseline = 0;

  for (const item of estimate.items) {
    materialSubtotal += item.unit_cost * item.quantity;
    laborMinutesBaseline += item.labor_minutes * item.quantity;
  }

  const jobType = jobTypes.find(j => j.id === estimate.job_type_id);
  const efficiency = jobType?.efficiency_percent ?? 100;

  const laborMinutesExpected = applyEfficiency(
    laborMinutesBaseline,
    efficiency
  );

  const discountPercent = estimate.discount_percent ?? 0;

  const discountedBase =
    discountPercent > 0
      ? materialSubtotal / (1 - discountPercent / 100)
      : materialSubtotal;

  const processingFee = estimate.apply_processing_fees
    ? discountedBase * (settings.processing_fee_percent / 100)
    : 0;

  return {
    materialSubtotal,
    laborMinutesBaseline,
    laborMinutesExpected,
    discountedBase,
    processingFee,
    grandTotal: discountedBase + processingFee,
  };
}
