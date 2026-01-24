// src/providers/data/types.ts

export type UUID = string;

export interface Company {
  id: UUID;
  name: string;
  created_at: string;
}

export interface CompanySettings {
  id: UUID;
  company_id: UUID;
  starting_estimate_number: number | null;
  min_labor_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobType {
  id: UUID;
  company_id: UUID;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
}

export interface AdminRule {
  id: UUID;
  company_id: UUID;
  name: string;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface CsvSettings {
  id: UUID;
  company_id: UUID;
  allow_material_import: boolean;
  allow_assembly_import: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandingSettings {
  id: UUID;
  company_id: UUID;
  logo_url?: string | null;
  primary_color?: string | null;
  created_at: string;
  updated_at: string;
}
