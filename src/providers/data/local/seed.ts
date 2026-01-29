import type { CompanySettings } from '../types';

/**
 * seedCompanySettings
 *
 * Creates a complete, safe default CompanySettings row.
 * This MUST match what CompanySetupPage.tsx expects to exist.
 *
 * IMPORTANT:
 * - Arrays must always be initialized (never null)
 * - Numeric defaults must be sane to avoid divide-by-zero
 */
export function seedCompanySettings(companyId: string): CompanySettings {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    company_id: companyId,

    // Work assumptions
    workdays_per_week: 5,
    work_hours_per_day: 8,
    technicians: 1,

    vacation_days_per_year: 10,
    sick_days_per_year: 5,

    avg_jobs_per_tech_per_day: 2,

    // Pricing defaults
    material_purchase_tax_percent: 8.25,
    misc_material_percent: 10,
    default_discount_percent: 10,
    processing_fee_percent: 4,

    min_billable_labor_minutes_per_job: 30,
    estimate_validity_days: 30,
    starting_estimate_number: 1,

    // Markup tiers (safe defaults)
    material_markup_tiers: [
      { min: 0, max: 100, markup_percent: 100 },
      { min: 100, max: 500, markup_percent: 75 },
      { min: 500, max: 999999, markup_percent: 50 },
    ],

    misc_applies_when_customer_supplies: false,

    // Technician wages
    technician_wages: [
      {
        name: 'Technician 1',
        hourly_rate: 35,
      },
    ],

    // Business expenses
    business_expenses_mode: 'lump',
    business_expenses_lump_sum_monthly: 2000,
    business_expenses_itemized: [],
    business_apply_itemized: false,

    // Personal expenses
    personal_expenses_mode: 'lump',
    personal_expenses_lump_sum_monthly: 3000,
    personal_expenses_itemized: [],
    personal_apply_itemized: false,

    // Profit goals
    net_profit_goal_mode: 'percent',
    net_profit_goal_amount_monthly: 0,
    net_profit_goal_percent_of_revenue: 20,

    revenue_goal_monthly: 0,

    // Legal / branding text (used later)
    company_license_text: '',
    company_warranty_text: '',

    created_at: now,
    updated_at: now,
  };
}
