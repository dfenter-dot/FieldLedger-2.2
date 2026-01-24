import { CompanySettings, JobType, Material, Folder } from '../types';

function makeId(): string {
  // Browser-safe UUID (Vite builds for browsers). Fallback included.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback: not a true UUID, but stable enough for local-only seed usage
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/* ------------------------------------------------------------------ */
/* Default Job Type                                                    */
/* ------------------------------------------------------------------ */

export function seedDefaultJobType(companyId: string): JobType {
  return {
    id: makeId(),
    company_id: companyId,
    name: 'Service',
    enabled: true,
    profit_margin_percent: 70,
    efficiency_percent: 50,
    allow_discounts: true,
    billing_mode: 'flat',
    is_default: true,
    created_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Company Settings Defaults                                           */
/* ------------------------------------------------------------------ */

export function seedCompanySettings(companyId: string): CompanySettings {
  return {
    id: makeId(),
    company_id: companyId,

    workdays_per_week: 5,
    work_hours_per_day: 8,
    technicians: 1,

    vacation_days_per_year: 10,
    sick_days_per_year: 5,

    material_purchase_tax_percent: 8.25,
    misc_material_percent: 10,
    default_discount_percent: 10,
    processing_fee_percent: 4,

    min_billable_labor_minutes_per_job: 30,
    estimate_validity_days: 30,
    starting_estimate_number: 1,

    material_markup_tiers: [
      { min: 0, max: 5, markup_percent: 200 },
      { min: 5.01, max: 50, markup_percent: 125 },
      { min: 50.01, max: 100, markup_percent: 50 },
      { min: 100.01, max: 500, markup_percent: 25 },
      { min: 500.01, max: 99999, markup_percent: 10 },
    ],

    misc_applies_when_customer_supplies: false,

    technician_wages: [],

    business_expenses_mode: 'lump',
    business_expenses_lump_sum_monthly: 0,
    business_expenses_itemized: [],
    business_apply_itemized: false,

    personal_expenses_mode: 'lump',
    personal_expenses_lump_sum_monthly: 0,
    personal_expenses_itemized: [],
    personal_apply_itemized: false,

    net_profit_goal_mode: 'percent',
    net_profit_goal_amount_monthly: 0,
    net_profit_goal_percent_of_revenue: 0,
    revenue_goal_monthly: 0,

    company_license_text: '',
    company_warranty_text: '',

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Optional: App-Owned Seed Data (materials/folders)                   */
/* ------------------------------------------------------------------ */

export function seedAppMaterialFolder(): Folder {
  return {
    id: makeId(),
    company_id: null,
    kind: 'materials',
    library_type: 'company',
    parent_id: null,
    name: 'App Materials',
    order_index: 0,
    created_at: new Date().toISOString(),
  };
}

export function seedAppMaterials(folderId: string): Material[] {
  return [
    {
      id: makeId(),
      company_id: null,
      name: 'Standard Outlet',
      sku: 'OUT-STD',
      description: '15A 120V duplex outlet',
      unit_cost: 2.5,
      custom_cost: null,
      use_custom_cost: false,
      taxable: true,
      labor_minutes: 15,
      job_type_id: null,
      folder_id: folderId,
      order_index: 0,
      created_at: new Date().toISOString(),
    },
  ];
}
