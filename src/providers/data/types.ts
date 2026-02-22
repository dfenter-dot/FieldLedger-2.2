// src/providers/data/types.ts

export type UUID = string;

/* ============================
   Core / Context
============================ */

export type LibraryType = 'company' | 'app';

export type OwnerType = 'company' | 'app';

/* ============================
   Company / Admin
============================ */

export interface CompanySettings {
  id?: UUID;
  company_id: UUID;

  // Capacity
  workdays_per_week: number;
  work_hours_per_day: number;
  technicians: number;
  vacation_days_per_year: number;
  sick_days_per_year: number;
  jobs_per_tech_per_day?: number;

  // Expenses
  business_apply_itemized: boolean;
  business_expenses_lump_sum_monthly?: number;
  business_expenses_itemized?: ExpenseItem[];

  personal_apply_itemized: boolean;
  personal_expenses_lump_sum_monthly?: number;
  personal_expenses_itemized?: ExpenseItem[];

  // Wages
  technician_wages: TechnicianWage[];

  // Profit goals
  net_profit_goal_mode: 'percent' | 'fixed';
  net_profit_goal_percent_of_revenue?: number;
  net_profit_goal_amount_monthly?: number;

  // Pricing params
  material_markup_tiers?: MarkupTier[];
  /** Default material markup strategy used by the pricing engine. */
  material_markup_mode?: 'tiered' | 'fixed';
  /** Fixed material markup percent when material_markup_mode = 'fixed'. */
  material_markup_fixed_percent?: number;
  material_purchase_tax_percent?: number;
  misc_material_percent?: number;
  /** Company default: whether misc material is applied at all (can be overridden per estimate/assembly). */
  apply_misc_material_default?: boolean;
  /** Legacy/alternate name tolerated in partially migrated schemas. */
  apply_misc_material?: boolean;
  /** Legacy toggle: apply misc material when customer supplies materials. */
  misc_applies_when_customer_supplies?: boolean;
  discount_percent_default?: number;
  processing_fee_percent?: number;
  min_billable_labor_minutes_per_job?: number;
  estimate_validity_days?: number;
  starting_estimate_number?: number;

  updated_at?: string;
  created_at?: string;
}

export interface ExpenseItem {
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
}

export interface TechnicianWage {
  name: string;
  hourly_rate: number;
}

export interface MarkupTier {
  min: number;
  max: number;
  markup_percent: number;
}

/* ============================
   Job Types / Rules
============================ */

export interface JobType {
  id?: UUID;
  company_id?: UUID | null;

  name: string;
  enabled: boolean;
  is_default?: boolean;

  billing_mode: 'flat' | 'hourly';

  profit_margin_percent: number;
  efficiency_percent?: number;

  allow_discounts?: boolean;

  /**
   * Hourly job types may override the company material markup strategy.
   * - 'company': use Company Setup selection
   * - 'tiered': force tiered markup
   * - 'fixed': force fixed markup (percent stored in hourly_material_markup_fixed_percent)
   */
  hourly_material_markup_mode?: 'company' | 'tiered' | 'fixed';
  /** Hourly-only fixed markup percent when hourly_material_markup_mode = 'fixed'. */
  hourly_material_markup_fixed_percent?: number;

  /** Optional description used by the UI (nullable in DB). */
  description?: string | null;

  /** Optional 3–6 character suffix appended to Assembly task codes (e.g., SRV, INS). */
  assembly_task_code_suffix?: string | null;

  /**
   * Backward-compat alias used by a short-lived migration attempt.
   * If present in DB, the app will treat it the same as assembly_task_code_suffix.
   */
  task_code_suffix?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface AdminRule {
  id?: UUID;
  company_id?: UUID;

  name: string;
  priority: number;

  scope: 'estimate' | 'assembly' | 'both';

  min_expected_labor_minutes?: number;
  min_material_cost?: number;
  min_quantity?: number;

  job_type_id: UUID;

  created_at?: string;
  updated_at?: string;
}

/* ============================
   Folders
============================ */

export interface Folder {
  id: UUID;
  kind: 'materials' | 'assemblies';
  library_type: LibraryType;
  company_id?: UUID | null;
  parent_id: UUID | null;
  name: string;
  order_index: number;
  created_at?: string;
}

/* ============================
   Materials
============================ */

export interface Material {
  id: UUID;
  company_id?: UUID | null;
  folder_id: UUID | null;

  name: string;
  sku?: string | null;
  description?: string | null;

  base_cost: number;

  custom_cost?: number | null;
  use_custom_cost?: boolean;

  taxable: boolean;

  /** Labor-only materials represent non-material charges (diagnostics, dispatch, etc.). */
  labor_only?: boolean;

  job_type_id?: UUID | null;

  labor_hours?: number; // UI only
  labor_minutes: number;

  order_index?: number;

  library_type: LibraryType;

  created_at?: string;
  updated_at?: string;
}

export interface AppMaterialOverride {
  id?: UUID;
  company_id: UUID;
  material_id: UUID;

  custom_cost?: number | null;
  use_custom_cost?: boolean;
  taxable?: boolean;
  job_type_id?: UUID | null;

  updated_at?: string;
}

/* ============================
   Assemblies
============================ */

export interface Assembly {
  id: UUID;
  company_id?: UUID | null;
  folder_id: UUID | null;

  name: string;
  description?: string | null;

  job_type_id?: UUID | null;
  use_admin_rules?: boolean;

  customer_supplied_materials?: boolean;

  /** User-entered master task code (base), e.g., 134205 */
  task_code_base?: string | null;
  /** Derived full task code based on job type suffix, e.g., 134205SRV */
  task_code?: string | null;


  /**
   * App-assembly task-code override behavior (company-scoped).
   * - When viewing an app-owned assembly as a normal company, the UI may allow overriding ONLY task_code_base.
   * - use_app_task_code=true means use the app-owned base task code (still applies the selected job type suffix).
   * - use_app_task_code=false means use the company override value stored in app_assembly_overrides.task_code_base.
   */
  use_app_task_code?: boolean;
  /** The original app-owned base task code (for display when use_app_task_code=true). */
  app_task_code_base?: string | null;

  library_type: LibraryType;

  created_at?: string;
  updated_at?: string;
}

export interface AssemblyItem {
  id?: UUID;
  assembly_id?: UUID;

  /** Grouping support: when an Assembly is added to an Estimate, its child items live in the Estimate and reference the parent's group_id. */
  group_id?: UUID;
  parent_group_id?: UUID;
  /** For children: quantity per 1 unit of the parent assembly (used to scale when parent quantity changes). */
  quantity_factor?: number;

  type: 'material' | 'labor' | 'blank_material';

  material_id?: UUID | null;
  name?: string | null;

  quantity: number;

  material_cost_override?: number | null;

  labor_hours?: number; // UI convenience
  labor_minutes?: number;

  sort_order?: number;
}

/* ============================
   Estimates
============================ */

export interface Estimate {
  id: UUID;
  company_id: UUID;

  estimate_number?: number;
  name?: string;

  status?: 'draft' | 'sent' | 'approved' | 'declined' | 'archived';

  job_type_id?: UUID | null;
  use_admin_rules?: boolean;

  customer_supplied_materials?: boolean;

  /** User-entered master task code (base), e.g., 134205 */
  task_code_base?: string | null;
  /** Derived full task code based on job type suffix, e.g., 134205SRV */
  task_code?: string | null;
  /** Deprecated: misc material is governed solely by Admin configuration. */
  apply_misc_material?: boolean;
  apply_processing_fees?: boolean;

  discount_percent?: number;

  /** Multi-option support (Bronze/Silver/Gold). v1 UI may treat the first option as active. */
  options?: EstimateOption[];
  active_option_id?: UUID | null;

  items?: EstimateItem[];

  created_at?: string;
  updated_at?: string;
}

export interface EstimateOption {
  id: UUID;
  estimate_id: UUID;

  /** Stable suffix identity: 1 => -1, 2 => -2, etc. */
  option_number?: number | null;

  option_name: string;
  option_description?: string | null;

  /** Display order only (drag/drop). Does NOT affect option_number. */
  sort_order: number;

  /** Option-scoped pricing controls */
  job_type_id?: UUID | null;
  use_admin_rules?: boolean;
  customer_supplies_materials?: boolean;
  apply_discount?: boolean;
  discount_percent?: number | null;
  apply_processing_fees?: boolean;

  created_at?: string;
  updated_at?: string;
}


export interface EstimateItem {
  id?: UUID;

  type: 'material' | 'assembly' | 'labor';

  material_id?: UUID;
  assembly_id?: UUID;

  /** Grouping support: when an Assembly is added to an Estimate, its child items live in the Estimate and reference the parent's group_id. */
  group_id?: UUID;
  parent_group_id?: UUID;
  /** For children: quantity per 1 unit of the parent assembly (used to scale when parent quantity changes). */
  quantity_factor?: number;

  /** For labor lines */
  name?: string;
  description?: string;
  labor_minutes?: number;

  quantity: number;
}

/* ============================
   Pricing Output
============================ */

export interface PricingLineBreakdown {
  name?: string | null;
  quantity: number;

  material_cost: number;
  labor_minutes: number;

  material_price: number;
  labor_price: number;

  total_price: number;
}

export interface PricingResult {
  material_cost_total: number;
  labor_minutes_total: number;

  material_price_total: number;
  labor_price_total: number;
  misc_material_price: number;

  total_price: number;

  lines: PricingLineBreakdown[];
}

/* ============================
   CSV / Branding (Deferred)
============================ */

export interface CsvSettings {
  company_id: UUID;
  allow_material_import?: boolean;
  allow_assembly_import?: boolean;
  updated_at?: string;
}

export interface BrandingSettings {
  company_id: UUID;
  company_display_name?: string | null;
  license_info?: string | null;
  warranty_info?: string | null;
  terms_info?: string | null;
  logo_storage_path?: string | null;
  updated_at?: string;
}











