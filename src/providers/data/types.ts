// src/providers/data/types.ts

export type ID = string;

/* ---------- Core ---------- */

export interface Folder {
  id: ID;
  name: string;
  parent_id: ID | null;
  kind: 'materials' | 'assemblies' | 'estimates';
  library_type: 'company' | 'personal';
  company_id: ID | null;
  created_at: string;
}

export interface Material {
  id: ID;
  company_id: ID | null;
  name: string;
  description?: string | null;
  unit_cost: number;
  taxable: boolean;
  labor_minutes: number;
  folder_id: ID | null;
  created_at: string;
}

export interface AssemblyItem {
  id: ID;
  material_id: ID;
  quantity: number;
}

export interface Assembly {
  id: ID;
  company_id: ID | null;
  name: string;
  description?: string | null;
  items: AssemblyItem[];
  labor_minutes: number;
  folder_id: ID | null;
  created_at: string;
}

export interface EstimateItem {
  id: ID;
  material_id?: ID | null;
  assembly_id?: ID | null;
  quantity: number;
}

export interface Estimate {
  id: ID;
  company_id: ID;
  estimate_number: number;
  name: string;
  job_type_id: ID | null;
  items: EstimateItem[];
  created_at: string;
}

/* ---------- Admin ---------- */

export interface JobType {
  id: ID;
  company_id: ID;
  name: string;
  description?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AdminRule {
  id: ID;
  company_id: ID;
  name: string;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface CompanySettings {
  id: ID;
  company_id: ID;
  starting_estimate_number: number;
  min_labor_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface CsvSettings {
  id: ID;
  company_id: ID;
  allow_material_import: boolean;
  allow_assembly_import: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandingSettings {
  id: ID;
  company_id: ID;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
}
