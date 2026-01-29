// src/providers/data/types.ts

export type UUID = string;

/**
 * UI ownership vocabulary still appears in a few places as "user".
 * DB uses owner = 'company' | 'app'.
 * Provider normalizes both.
 */
export type OwnerType = 'company' | 'user' | 'app';
export type LibraryType = 'company' | 'user' | 'app';

export type FolderKind = 'materials' | 'assemblies';

/* ============================
   Folders
============================ */

export type Folder = {
  id: UUID;
  kind: FolderKind; // maps to folders.library
  library_type: LibraryType; // maps to folders.owner
  company_id: UUID | null; // null for app-owned
  parent_id: UUID | null;
  name: string;
  order_index: number;
  created_at?: string;
};

/* ============================
   Job Types (matches Admin UI)
============================ */

export type JobTypeBillingMode = 'flat' | 'hourly';

export type JobType = {
  id: UUID;
  company_id: UUID | null;

  name: string;
  description?: string | null;

  is_default: boolean;
  enabled: boolean;

  // Admin UI fields
  profit_margin_percent: number | null; // “Gross Margin Target (%)”
  efficiency_percent: number | null; // flat-rate only
  allow_discounts: boolean;

  billing_mode: JobTypeBillingMode;

  created_at?: string;
  updated_at?: string | null;
};

/* ============================
   Company Settings (matches seed.ts + CompanySetupPage)
============================ */

export type MarkupTier = { min: number; max: number; markup_percent: number };
export type TechnicianWage = { name: string; hourly_rate: number };

export type ExpenseFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual';
export type ExpenseItem = { name: string; amount: number; frequency: ExpenseFrequency };

export type CompanySettings = {
  id: UUID;
  company_id: UUID;

  workdays_per_week: number;
  work_hours_per_day: number;
  technicians: number;

  vacation_days_per_year: number;
  sick_days_per_year: number;

  avg_jobs_per_tech_per_day: number;

  material_purchase_tax_percent: number;
  misc_material_percent: number;
  default_discount_percent: number;
  processing_fee_percent: number;

  min_billable_labor_minutes_per_job: number;
  estimate_validity_days: number;
  starting_estimate_number: number;

  material_markup_tiers: MarkupTier[];

  misc_applies_when_customer_supplies: boolean;

  technician_wages: TechnicianWage[];

  business_expenses_mode: 'lump' | 'itemized';
  business_expenses_lump_sum_monthly: number;
  business_expenses_itemized: ExpenseItem[];
  business_apply_itemized: boolean;

  personal_expenses_mode: 'lump' | 'itemized';
  personal_expenses_lump_sum_monthly: number;
  personal_expenses_itemized: ExpenseItem[];
  personal_apply_itemized: boolean;

  net_profit_goal_mode: 'percent' | 'fixed';
  net_profit_goal_amount_monthly: number;
  net_profit_goal_percent_of_revenue: number;

  revenue_goal_monthly: number;

  company_license_text: string;
  company_warranty_text: string;

  created_at?: string;
  updated_at?: string | null;
};

/* ============================
   Admin Rules (matches AdminRulesPage)
============================ */

export type RuleOperator = '>=' | '>' | '<=' | '<' | '==' | '!=';

export type RuleConditionType =
  | 'expected_labor_hours'
  | 'material_cost'
  | 'line_item_count'
  | 'any_line_item_qty';

export type AdminRule = {
  id: UUID;
  company_id: UUID;

  name: string;
  description?: string | null;

  enabled: boolean;
  priority: number;

  scope: 'estimate' | 'assembly' | 'both';

  condition_type: RuleConditionType;
  operator: RuleOperator;
  threshold_value: number;

  target_job_type_id: UUID | null;

  created_at?: string;
  updated_at?: string | null;
};

/* ============================
   Materials / Assemblies / Estimates
   (kept compatible with current app; will refine later)
============================ */

export type Material = {
  id: UUID;
  company_id: UUID | null;
  library_type?: LibraryType;

  folder_id?: UUID | null;

  name: string;
  sku?: string | null;
  description?: string | null;

  base_cost?: number;
  unit_cost?: number; // legacy UI support
  custom_cost?: number | null;
  use_custom_cost?: boolean;

  taxable?: boolean;
  job_type_id?: UUID | null;

  labor_minutes?: number;
  labor_hours?: number; // UI-only / legacy, never sent to DB

  order_index?: number;
  sort_order?: number;

  created_at?: string | null;
  updated_at?: string | null;
};

export type AssemblyItemType = 'material' | 'labor' | 'blank';

export type AssemblyItem = {
  id: UUID;
  assembly_id: UUID;

  item_type: AssemblyItemType;
  type?: any; // legacy support

  material_id?: UUID | null;
  name?: string | null;

  quantity: number;

  material_cost_override?: number | null;
  material_cost?: number | null; // legacy

  labor_minutes: number;
  sort_order: number;
};

export type Assembly = {
  id: UUID;
  company_id: UUID | null;

  library_type?: LibraryType;
  folder_id: UUID | null;

  name: string;
  description?: string | null;

  job_type_id?: UUID | null;
  use_admin_rules?: boolean;

  customer_supplied_materials?: boolean;
  customer_supplies_materials?: boolean; // legacy
  taxable?: boolean;

  created_at?: string;
  updated_at?: string | null;

  items?: AssemblyItem[];
};

export type Estimate = {
  id: UUID;
  company_id: UUID;

  name: string;

  job_type_id?: UUID | null;
  use_admin_rules?: boolean;

  created_at?: string;
  updated_at?: string | null;
};

/* ============================
   CSV / Branding / Overrides (kept for compilation)
============================ */

export type CsvSettings = {
  company_id: UUID;
  allow_material_import: boolean;
  allow_assembly_import: boolean;
  updated_at?: string | null;
};

export type BrandingSettings = {
  company_id: UUID;
  primary_color?: string | null;
  logo_url?: string | null;
  footer_text?: string | null;
  updated_at?: string | null;
};

export type AppMaterialOverride = {
  id: UUID;
  material_id: UUID;
  company_id: UUID;

  job_type_id?: UUID | null;
  taxable?: boolean;
  custom_cost?: number | null;
  use_custom_cost?: boolean;

  updated_at?: string | null;
};
