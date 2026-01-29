/* ============================
   Core Shared Types — AUTHORITATIVE
   ============================ */

/**
 * Canonical ownership model.
 * DB uses owner = 'app' | 'company'
 */
export type OwnerType = 'app' | 'company';

/**
 * Canonical library type used by UI.
 * This maps to DB owner via DataProvider.
 */
export type LibraryType = 'app' | 'company';

/**
 * Folder library kind
 */
export type FolderKind = 'materials' | 'assemblies';

/* ============================
   Folder
   ============================ */

export interface Folder {
  id: string;
  kind: FolderKind;            // materials | assemblies
  library_type: LibraryType;   // app | company
  company_id: string | null;
  parent_id: string | null;
  name: string;
  order_index: number;
  created_at: string;
}

/* ============================
   Job Types
   ============================ */

export interface JobType {
  id: string;
  company_id: string | null;
  name: string;
  enabled: boolean;
  is_default: boolean;
  mode: 'flat-rate' | 'hourly';
  gross_margin_target: number;
  efficiency_percent: number | null;
  allow_discounts: boolean;
  created_at: string;
  updated_at: string | null;
}

/* ============================
   Materials
   ============================ */

export interface Material {
  id: string;
  company_id: string | null;
  folder_id: string | null;
  library_type: LibraryType;

  name: string;
  sku?: string | null;
  description?: string | null;

  base_cost: number;
  taxable: boolean;
  job_type_id: string | null;

  // Canonical labor representation
  labor_minutes: number;

  // UI-only convenience (derived)
  labor_hours?: number;

  order_index: number;
  created_at: string | null;
  updated_at: string | null;
}

/* ============================
   Assembly Items
   ============================ */

export type AssemblyItemType = 'material' | 'labor' | 'blank';

export interface AssemblyItem {
  id: string;
  assembly_id: string;
  item_type: AssemblyItemType;

  material_id?: string | null;
  name?: string | null;

  quantity: number;
  material_cost_override?: number | null;

  labor_minutes: number;
  sort_order: number;
}

/* ============================
   Assemblies
   ============================ */

export interface Assembly {
  id: string;
  company_id: string | null;
  library_type: LibraryType;
  folder_id: string;

  name: string;
  description?: string | null;

  job_type_id: string | null;
  use_admin_rules: boolean;
  customer_supplied_materials: boolean;
  taxable: boolean;

  items?: AssemblyItem[];

  created_at: string;
  updated_at: string | null;
}

/* ============================
   Estimates
   ============================ */

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'declined'
  | 'archived';

export interface Estimate {
  id: string;
  company_id: string;

  estimate_number: number;
  name: string;
  status: EstimateStatus;

  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;

  notes_private?: string | null;

  job_type_id: string | null;
  use_admin_rules: boolean;
  customer_supplied_materials: boolean;

  apply_discount: boolean;
  discount_percent?: number | null;

  apply_processing_fees: boolean;
  apply_misc_material: boolean;

  created_at: string;
  updated_at: string | null;
}

/* ============================
   Admin Rules
   ============================ */

export interface AdminRule {
  id: string;
  company_id: string;
  name: string;
  priority: number;
  scope: 'estimate' | 'assembly' | 'both';

  min_labor_minutes?: number | null;
  min_material_cost?: number | null;

  job_type_id: string;
  created_at: string;
  updated_at: string | null;
}

/* ============================
   Company Settings
   ============================ */

export interface CompanySettings {
  company_id: string;

  workdays_per_week: number;
  work_hours_per_day: number;
  tech_count: number;

  vacation_days_per_year: number;
  sick_days_per_year: number;

  jobs_per_tech_per_day: number;

  monthly_business_expenses: number;
  monthly_personal_expenses: number;

  average_tech_hourly_wage: number;

  profit_goal_type: 'percent' | 'fixed';
  profit_goal_value: number;

  purchase_tax_percent: number;
  misc_material_percent: number;
  processing_fee_percent: number;

  minimum_billable_labor_minutes: number;
  estimate_validity_days: number;
  starting_estimate_number: number;

  created_at: string;
  updated_at: string | null;
}

/* ============================
   CSV / Branding
   ============================ */

export interface CsvSettings {
  company_id: string;
  allow_material_import: boolean;
  allow_assembly_import: boolean;
  updated_at: string | null;
}

export interface BrandingSettings {
  company_id: string;
  logo_url?: string | null;
  primary_color?: string | null;
  footer_text?: string | null;
  updated_at: string | null;
}

/* ============================
   App Material Overrides
   ============================ */

export interface AppMaterialOverride {
  id: string;
  material_id: string;
  company_id: string;

  job_type_id?: string | null;
  taxable?: boolean;
  custom_cost?: number | null;
  use_custom_cost?: boolean;

  updated_at: string | null;
}
