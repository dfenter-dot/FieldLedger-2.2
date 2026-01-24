/* ------------------------------------------------------------------ */
/* Shared / Utility                                                    */
/* ------------------------------------------------------------------ */

export type UUID = string;

export interface Folder {
  id: UUID;
  company_id: UUID | null;
  kind: 'materials' | 'assemblies';
  library_type: 'company' | 'personal';
  parent_id: UUID | null;
  name: string;
  order_index: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export interface Material {
  id: UUID;
  company_id: UUID | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit_cost: number;
  custom_cost?: number | null;
  use_custom_cost: boolean;
  taxable: boolean;
  labor_minutes: number;
  job_type_id?: UUID | null;
  folder_id?: UUID | null;
  order_index: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Assemblies                                                          */
/* ------------------------------------------------------------------ */

export type AssemblyItemType = 'material' | 'labor' | 'oneoff';

export interface AssemblyItem {
  id: UUID;
  type: AssemblyItemType;
  name: string;
  quantity: number;
  unit_cost: number;
  labor_minutes: number;
  taxable: boolean;
  job_type_id?: UUID | null;
}

export interface Assembly {
  id: UUID;
  company_id: UUID | null;
  name: string;
  description?: string | null;
  job_type_id?: UUID | null;
  use_admin_rules: boolean;
  customer_supplies_materials: boolean;
  items: AssemblyItem[];
  labor_minutes: number;
  folder_id?: UUID | null;
  order_index: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Estimates                                                           */
/* ------------------------------------------------------------------ */

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'declined'
  | 'archived';

export interface EstimateItem {
  id: UUID;
  type: AssemblyItemType | 'assembly';
  name: string;
  quantity: number;
  unit_cost: number;
  labor_minutes: number;
  taxable: boolean;
  job_type_id?: UUID | null;
  assembly_id?: UUID;
}

export interface Estimate {
  id: UUID;
  company_id: UUID;
  estimate_number: number;
  name: string;
  status: EstimateStatus;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  private_notes?: string | null;
  job_type_id?: UUID | null;
  use_admin_rules: boolean;
  customer_supplies_materials: boolean;
  discount_percent?: number | null;
  apply_processing_fees: boolean;
  apply_misc_material: boolean;
  items: EstimateItem[];
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface JobType {
  id: UUID;
  company_id: UUID;
  name: string;
  enabled: boolean;
  profit_margin_percent: number;
  efficiency_percent: number;
  allow_discounts: boolean;
  billing_mode: 'flat' | 'hourly';
  is_default: boolean;
  created_at: string;
}

export interface CompanySettings {
  id: UUID;
  company_id: UUID;

  workdays_per_week: number;
  work_hours_per_day: number;
  technicians: number;

  vacation_days_per_year: number;
  sick_days_per_year: number;

  material_purchase_tax_percent: number;
  misc_material_percent: number;
  default_discount_percent: number;
  processing_fee_percent: number;

  min_billable_labor_minutes_per_job: number;
  estimate_validity_days: number;
  starting_estimate_number: number;

  material_markup_tiers: {
    min: number;
    max: number;
    markup_percent: number;
  }[];

  misc_applies_when_customer_supplies: boolean;

  technician_wages: {
    name: string;
    hourly_rate: number;
  }[];

  business_expenses_mode: 'lump' | 'itemized';
  business_expenses_lump_sum_monthly: number;
  business_expenses_itemized: {
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  }[];
  business_apply_itemized: boolean;

  personal_expenses_mode: 'lump' | 'itemized';
  personal_expenses_lump_sum_monthly: number;
  personal_expenses_itemized: {
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  }[];
  personal_apply_itemized: boolean;

  net_profit_goal_mode: 'dollar' | 'percent';
  net_profit_goal_amount_monthly: number;
  net_profit_goal_percent_of_revenue: number;
  revenue_goal_monthly: number;

  company_license_text?: string | null;
  company_warranty_text?: string | null;

  created_at: string;
  updated_at: string;
}
