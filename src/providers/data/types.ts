/* =========================
   Core / Company
   ========================= */

export interface CompanySettings {
  id: string;
  company_id: string;

  labor_rate: number;
  overhead_percent: number;
  target_profit_percent: number;

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

  billing_mode: 'hourly' | 'flat';
  labor_margin_percent?: number;
  efficiency_percent?: number;

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
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;

  created_at?: string;
  updated_at?: string;
}
