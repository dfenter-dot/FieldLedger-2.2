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

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  const lines: PricingLineBreakdown[] = [];

  for (const item of items) {
    const qty = item.quantity || 1;

    let materialCost = 0;
    let laborMinutes = 0;

    // Labor
    if (item.type === 'labor') {
      const hours = item.labor_hours || 0;
      const minutes = item.labor_minutes || 0;
      laborMinutes = (hours * 60 + minutes) * qty;
    }

    // Material (referenced)
    if (item.type === 'material') {
      const mat = item.material_id ? materialsById[item.material_id] : null;
      if (mat) {
        materialCost = (mat.base_cost ?? 0) * qty;
        if (mat.taxable) {
          materialCost *= 1 + (companySettings.purchase_tax_percent ?? 0) / 100;
        }
      }
    }

    // Blank material (one-off)
    if (item.type === 'blank_material') {
      materialCost = (item.material_cost || 0) * qty;
      if (item.taxable) {
        materialCost *= 1 + (companySettings.purchase_tax_percent ?? 0) / 100;
      }
    }

    // Customer supplied materials => cost becomes 0 (labor remains)
    if (assembly.customer_supplied_materials) {
      materialCost = 0;
    }

    materialCost = round2(materialCost);
    materialCostTotal += materialCost;
    laborMinutesTotal += laborMinutes;

    // Pricing
    let materialPrice = materialCost; // (Markup tiers not implemented yet in this minimal pass)
    let laborPrice = 0;

    if (jobType?.billing_type === 'hourly') {
      // NOTE: hourly pricing is deliberately minimal here.
      // Full implementation should use technician wage + gross margin.
      const hourlyRate = 1;
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
  if (jobType?.billing_type === 'flat_rate') {
    const efficiency = (jobType.efficiency_percent ?? 100) / 100;
    let expectedMinutes = laborMinutesTotal / (efficiency || 1);

    if (
      jobType.minimum_billable_minutes &&
      expectedMinutes < jobType.minimum_billable_minutes
    ) {
      expectedMinutes = jobType.minimum_billable_minutes;
    }

    laborMinutesTotal = expectedMinutes;
  }

  const miscMaterial =
    materialPriceTotal * ((companySettings.misc_material_percent || 0) / 100);

  const totalPrice = materialPriceTotal + laborPriceTotal + miscMaterial;

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

  let materialCostTotal = 0;
  let materialPriceTotal = 0;
  let laborMinutesTotal = 0;
  let laborPriceTotal = 0;

  const lines: PricingLineBreakdown[] = [];

  const items = Array.isArray(estimate?.items) ? estimate.items : [];

  for (const it of items) {
    const qty = Number(it?.quantity ?? 1) || 1;

    // Material line (estimate references a material)
    if (it?.type === 'material') {
      const matId = it.materialId ?? it.material_id;
      const mat = matId ? materialsById[String(matId)] : null;
      if (!mat) continue;

      let materialCost = (mat.base_cost ?? 0) * qty;
      if (mat.taxable) {
        materialCost *= 1 + (companySettings.purchase_tax_percent ?? 0) / 100;
      }

      const laborMinutes = (mat.labor_minutes ?? 0) * qty;

      materialCost = round2(materialCost);

      materialCostTotal += materialCost;
      materialPriceTotal += materialCost; // minimal (no markup tiers yet)

      laborMinutesTotal += laborMinutes;

      lines.push({
        name: mat.name,
        quantity: qty,
        material_cost: materialCost,
        labor_minutes: laborMinutes,
        material_price: materialCost,
        labor_price: 0,
        total_price: round2(materialCost),
      });

      continue;
    }

    // Assembly line (estimate references an assembly)
    if (it?.type === 'assembly') {
      const asmId = it.assemblyId ?? it.assembly_id;
      const asm = asmId ? assembliesById[String(asmId)] : null;
      if (!asm) continue;

      const asmItems = (asm as any).items ?? [];

      const asmPricing = computeAssemblyPricing({
        assembly: asm,
        items: asmItems,
        materialsById: materialsById as any,
        jobTypesById,
        companySettings,
      });

      // Multiply totals by estimate qty
      materialCostTotal += asmPricing.material_cost_total * qty;
      materialPriceTotal += asmPricing.material_price_total * qty;
      laborMinutesTotal += asmPricing.labor_minutes_total * qty;
      laborPriceTotal += asmPricing.labor_price_total * qty;

      lines.push({
        name: asm.name,
        quantity: qty,
        material_cost: round2(asmPricing.material_cost_total * qty),
        labor_minutes: Math.round(asmPricing.labor_minutes_total * qty),
        material_price: round2(asmPricing.material_price_total * qty),
        labor_price: round2(asmPricing.labor_price_total * qty),
        total_price: round2(asmPricing.total_price * qty),
      });

      continue;
    }
  }

  // Flat-rate estimate-level labor adjustments (mirrors assembly behavior)
  if (jobType?.billing_type === 'flat_rate') {
    const efficiency = (jobType.efficiency_percent ?? 100) / 100;
    let expectedMinutes = laborMinutesTotal / (efficiency || 1);

    if (
      jobType.minimum_billable_minutes &&
      expectedMinutes < jobType.minimum_billable_minutes
    ) {
      expectedMinutes = jobType.minimum_billable_minutes;
    }

    laborMinutesTotal = expectedMinutes;
  }

  const miscMaterial =
    materialPriceTotal * ((companySettings.misc_material_percent || 0) / 100);

  const totalPrice = materialPriceTotal + laborPriceTotal + miscMaterial;

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
