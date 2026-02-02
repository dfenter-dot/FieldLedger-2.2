/* =========================
   Core / Company
   ========================= */

export interface MaterialMarkupTier {
  min: number;
  max: number;
  markup_percent: number;
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

export interface CompanySettings {
  id: string;
  company_id: string;

  /* -------------------------
     Company capacity inputs
     ------------------------- */
  workdays_per_week: number;
  work_hours_per_day: number;
  vacation_days_per_year: number;
  sick_days_per_year: number;

  /**
   * Source-of-truth technician count for capacity.
   * (Tech wages live in Technicians table; this is capacity count / override.)
   */
  technicians: number;

  /* -------------------------
     Defaults / policies
     ------------------------- */
  material_purchase_tax_percent: number;
  misc_material_percent: number;
  default_discount_percent: number;
  processing_fee_percent: number;

  min_billable_labor_minutes_per_job: number;
  estimate_validity_days: number;
  starting_estimate_number: number;

  material_markup_tiers: MaterialMarkupTier[];
  /** Default material markup strategy used by the pricing engine. */
  material_markup_mode?: 'tiered' | 'fixed';
  /** Fixed material markup percent when material_markup_mode = 'fixed'. */
  material_markup_fixed_percent?: number;
  misc_applies_when_customer_supplies: boolean;

  /* -------------------------
     Labor cost inputs
     ------------------------- */
  technician_wages: TechnicianWage[];

  /* -------------------------
     Expenses (raw monthly dollars)
     ------------------------- */
  business_expenses_mode: 'lump' | 'itemized';
  business_expenses_lump_sum_monthly: number;
  business_expenses_itemized: ExpenseItem[];
  business_apply_itemized: boolean;

  personal_expenses_mode: 'lump' | 'itemized';
  personal_expenses_lump_sum_monthly: number;
  personal_expenses_itemized: ExpenseItem[];
  personal_apply_itemized: boolean;

  /** Cached computed totals (raw monthly dollars). */
  business_expenses_monthly?: number;
  personal_expenses_monthly?: number;
  overhead_monthly?: number;

  /* -------------------------
     Net profit goal
     ------------------------- */
  net_profit_goal_mode: 'percent' | 'dollar';
  /** Dollar mode: fixed monthly net profit target (converted to per-hour in calculations). */
  net_profit_goal_amount_monthly: number;
  /** Percent mode: percent of final revenue. */
  net_profit_goal_percent_of_revenue: number;

  /* -------------------------
     Cached computed “truth” values (system-derived)
     ------------------------- */
  /** Overhead per billable hour (efficiency applied). */
  overhead_per_billable_hour?: number;
  /** Required revenue per billable hour (includes wage + overhead + margin + net profit). */
  required_revenue_per_billable_hour?: number;

  /** Derived monthly revenue goal (required revenue/hr × billable hours/month). */
  revenue_goal_monthly: number;

  /* -------------------------
     Text blocks
     ------------------------- */
  company_license_text: string;
  company_warranty_text: string;

  /** Controls visibility of Tech View breakdown across Estimates and Assemblies. */
  show_tech_view_breakdown?: boolean;

  created_at?: string;
  updated_at?: string;
}


/* =========================
   Job Types
   ========================= */

export interface JobType {
  id: string;
  company_id: string;

  name: string;
  description?: string;

  enabled: boolean;

  /**
   * Target gross margin (percent) for this job type.
   * Job Type overrides Company default when selected.
   */
  profit_margin_percent: number;

  /** Efficiency percent used for billable-hour conversion (default job type drives Company Setup calc). */
  efficiency_percent: number;

  allow_discounts: boolean;

  billing_mode: 'hourly' | 'flat';

  is_default: boolean;

  created_at?: string;
  updated_at?: string;
}


/* =========================
   Admin Rules
   ========================= */

export interface AdminRule {
  id: string;
  company_id: string;

  name: string;
  description?: string;

  rule_type: string;
  rule_value: any;

  created_at?: string;
  updated_at?: string;
}

/* =========================
   CSV Settings
   ========================= */

export interface CsvSettings {
  id: string;
  company_id: string;

  include_headers: boolean;
  decimal_hours: boolean;
  round_minutes: boolean;

  created_at?: string;
  updated_at?: string;
}

/* =========================
   Branding Settings
   ========================= */

export interface BrandingSettings {
  id: string;
  company_id: string;

  company_name: string;
  /** Storage-backed logo path (resolved via signed URL). */
  logo_storage_path?: string | null;
  primary_color?: string;
  secondary_color?: string;

  created_at?: string;
  updated_at?: string;
}


