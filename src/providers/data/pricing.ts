
// PRICING ENGINE — AUTHORITATIVE (Phase 1 Rewrite)
// All pricing logic lives here. UI must consume outputs only.

import { CompanySettings, JobType } from './types';

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
  const { company, jobType, lineItems, flags } = input;

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
  let materialSell = 0;

  if (!flags.customer_supplies_materials) {
    for (const m of lineItems.materials) {
      const baseCost = m.custom_cost ?? m.cost;
      const taxedCost = m.taxable
        ? baseCost * (1 + company.purchase_tax_percent / 100)
        : baseCost;
      const markup = resolveMarkup(taxedCost, company.material_markup_tiers);
      const sell = taxedCost * (1 + markup / 100);
      materialSell += sell * m.quantity;
    }
  }

  const miscMaterial =
    materialSell > 0 &&
    (company.allow_misc_with_customer_materials || !flags.customer_supplies_materials)
      ? materialSell * (company.misc_material_percent / 100)
      : 0;

  // --- LABOR PRICING ---
  let laborCost = 0;
  let laborSell = 0;
  let baseRate = 0;
  let effectiveRate = 0;

  if (jobType.mode === 'flat_rate') {
    baseRate = company.loaded_labor_rate;
    effectiveRate = baseRate / (1 - jobType.gross_margin_percent / 100);
    laborSell = effectiveRate * (expectedMinutes / 60);
  } else {
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

  // --- DISCOUNT ---
  const discountAllowed = jobType.allow_discounts && flags.apply_discount;
  const preDiscountSubtotal = discountAllowed
    ? marginSubtotal / (1 - company.discount_percent / 100)
    : marginSubtotal;

  const discountAmount = discountAllowed
    ? preDiscountSubtotal - marginSubtotal
    : 0;

  // --- PROCESSING FEE ---
  const processingFee = flags.apply_processing_fee
    ? marginSubtotal * (company.processing_fee_percent / 100)
    : 0;

  const finalSubtotal = marginSubtotal;
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

