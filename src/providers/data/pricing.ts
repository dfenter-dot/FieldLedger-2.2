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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeAssemblyPricing(params: {
  assembly: Assembly;
  items: AssemblyItem[];
  materialsById: Record<UUID, Material>;
  jobTypesById: Record<UUID, JobType>;
  companySettings: CompanySettings;
}): PricingResult {
  const {
    assembly,
    items,
    materialsById,
    jobTypesById,
    companySettings,
  } = params;

  const jobType =
    (assembly.job_type_id && jobTypesById[assembly.job_type_id]) ||
    null;

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  const lines: PricingLineBreakdown[] = [];

  for (const item of items) {
    const qty = item.quantity || 1;

    let materialCost = 0;
    let laborMinutes = 0;

    /* =======================
     * Labor
     * ======================= */
    if (item.type === 'labor') {
      const hours = item.labor_hours || 0;
      const minutes = item.labor_minutes || 0;
      laborMinutes = (hours * 60 + minutes) * qty;
    }

    /* =======================
     * Material / Blank Material
     * ======================= */
    if (item.type === 'material') {
      const mat = item.material_id
        ? materialsById[item.material_id]
        : null;

      if (mat) {
        materialCost = mat.base_cost * qty;

        if (mat.taxable) {
          materialCost *=
            1 + companySettings.purchase_tax_percent / 100;
        }
      }
    }

    if (item.type === 'blank_material') {
      materialCost = (item.material_cost || 0) * qty;

      if (item.taxable) {
        materialCost *=
          1 + companySettings.purchase_tax_percent / 100;
      }
    }

    if (assembly.customer_supplied_materials) {
      materialCost = 0;
    }

    materialCost = round2(materialCost);
    materialCostTotal += materialCost;
    laborMinutesTotal += laborMinutes;

    /* =======================
     * Pricing
     * ======================= */
    let materialPrice = materialCost;
    let laborPrice = 0;

    if (jobType?.billing_type === 'hourly') {
      const hourlyRate =
        jobType.gross_margin_percent != null
          ? (jobType.gross_margin_percent / 100) ** -1
          : 1;

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

  /* =======================
   * Flat-rate labor adjustments
   * ======================= */
  if (jobType?.billing_type === 'flat_rate') {
    const efficiency =
      (jobType.efficiency_percent ?? 100) / 100;

    let expectedMinutes = laborMinutesTotal / efficiency;

    if (
      jobType.minimum_billable_minutes &&
      expectedMinutes < jobType.minimum_billable_minutes
    ) {
      expectedMinutes = jobType.minimum_billable_minutes;
    }

    laborMinutesTotal = expectedMinutes;
  }

  const miscMaterial =
    materialPriceTotal *
    ((companySettings.misc_material_percent || 0) / 100);

  const totalPrice =
    materialPriceTotal +
    laborPriceTotal +
    miscMaterial;

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
