import type { CompanySettings, JobType, Material } from './types';

type PricingInput = {
  assembly: any;
  items: any[];
  materialsById: Record<string, Material>;
  jobTypesById: Record<string, JobType>;
  companySettings: CompanySettings;
};

export function computeAssemblyPricing(input: PricingInput) {
  const { assembly, items, materialsById, jobTypesById, companySettings } = input;

  let materialCost = 0;
  let materialPrice = 0;
  let laborMinutesActual = 0;
  let laborMinutesExpected = 0;

  const defaultLaborRate = Number(companySettings?.labor_rate ?? 0);

  for (const item of items) {
    const qty = Number(item.quantity ?? 1) || 1;

    // ─────────────────────────────
    // MATERIAL (from Materials lib)
    // ─────────────────────────────
    if (item.type === 'material' && item.material_id) {
      const mat = materialsById[item.material_id];
      if (!mat) continue;

      const baseCost = Number(mat.base_cost ?? 0);
      const customCost =
        mat.use_custom_cost && mat.custom_cost != null
          ? Number(mat.custom_cost)
          : null;

      const unitCost = customCost != null ? customCost : baseCost;

      materialCost += unitCost * qty;

      const markup = Number(mat.markup_percent ?? companySettings?.default_material_markup_percent ?? 0);
      materialPrice += unitCost * qty * (1 + markup / 100);

      const matLabor = Number(mat.labor_minutes ?? 0);
      laborMinutesActual += matLabor * qty;
      laborMinutesExpected += matLabor * qty;

      continue;
    }

    // ─────────────────────────────
    // BLANK MATERIAL LINE
    // ─────────────────────────────
    if (item.type === 'blank_material') {
      const unitCost = Number(item.unit_cost ?? item.material_cost ?? 0);
      materialCost += unitCost * qty;

      const markup = Number(companySettings?.default_material_markup_percent ?? 0);
      materialPrice += unitCost * qty * (1 + markup / 100);

      const mins = Number(item.labor_minutes ?? 0);
      laborMinutesActual += mins * qty;
      laborMinutesExpected += mins * qty;

      continue;
    }

    // ─────────────────────────────
    // LABOR LINE
    // ─────────────────────────────
    if (item.type === 'labor') {
      const mins = Number(item.labor_minutes ?? 0);
      laborMinutesActual += mins * qty;
      laborMinutesExpected += mins * qty;
      continue;
    }
  }

  // Assembly-level labor
  const asmLabor = Number(assembly?.labor_minutes ?? 0);
  laborMinutesActual += asmLabor;
  laborMinutesExpected += asmLabor;

  const laborHours = laborMinutesExpected / 60;
  const laborPrice = laborHours * defaultLaborRate;

  const total = materialPrice + laborPrice;

  const grossMarginExpectedPercent =
    total > 0 ? ((total - (materialCost + laborPrice)) / total) * 100 : 0;

  return {
    material_cost: materialCost,
    material_price: materialPrice,
    labor_minutes_actual: laborMinutesActual,
    labor_minutes_expected: laborMinutesExpected,
    labor_price: laborPrice,
    total,
    gross_margin_expected_percent: grossMarginExpectedPercent,
    gross_margin_target_percent: companySettings?.target_gross_margin_percent ?? null,
  };
}
