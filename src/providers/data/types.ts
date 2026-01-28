// src/providers/data/types.ts

export type UUID = string;

export type OwnerType = 'user' | 'app';

export type Folder = {
  id: UUID;
  company_id: UUID | null; // null for app-owned
  owner_type: OwnerType;
  parent_id: UUID | null;
  name: string;
  sort_order: number;
  created_at?: string;
};

export type Assembly = {
  id: UUID;
  company_id: UUID | null;
  owner_type: OwnerType;

  folder_id: UUID;

  name: string;
  assembly_code?: string | null;
  description?: string | null;

  use_admin_rules: boolean;
  job_type_id: UUID | null;
  customer_supplied_materials: boolean;

  sort_order: number;

  created_at?: string;
};

export type AssemblyItemType = 'material' | 'labor' | 'blank_material';

export type AssemblyItem = {
  id: UUID;
  assembly_id: UUID;

  type: AssemblyItemType;

  material_id?: UUID | null; // only for referenced material lines
  reference_id?: UUID | null;

  name: string;
  quantity: number;

  material_cost?: number | null;
  taxable?: boolean;

  labor_hours?: number | null;
  labor_minutes?: number | null;

  sort_order: number;
};

export type AppAssemblyOverride = {
  id: UUID;
  company_id: UUID;
  assembly_id: UUID;

  override_job_type_id?: UUID | null;
  override_customer_supplied_materials?: boolean | null;
};

export type JobType = {
  id: UUID;
  name: string;

  billing_type: 'flat_rate' | 'hourly';

  efficiency_percent?: number | null;

  minimum_billable_minutes?: number | null;

  gross_margin_percent?: number | null;

  created_at?: string;
};

export type Material = {
  id: UUID;
  company_id: UUID | null;
  owner_type: OwnerType;

  name: string;
  sku?: string | null;
  description?: string | null;

  base_cost: number;
  taxable: boolean;

  job_type_id?: UUID | null;

  created_at?: string;
};

export type EstimateAssemblyLine = {
  id: UUID;
  estimate_id: UUID;

  assembly_id: UUID;
  quantity: number;
};

export type Estimate = {
  id: UUID;
  company_id: UUID;

  name: string;

  job_type_id: UUID | null;
  use_admin_rules: boolean;

  created_at?: string;
};

export type CompanySettings = {
  id: UUID;
  purchase_tax_percent: number;

  misc_material_percent?: number | null;

  created_at?: string;
};

export type PricingLineBreakdown = {
  name: string;
  quantity: number;

  material_cost: number;
  labor_minutes: number;

  material_price: number;
  labor_price: number;

  total_price: number;
};

export type PricingResult = {
  material_cost_total: number;
  labor_minutes_total: number;

  material_price_total: number;
  labor_price_total: number;

  misc_material_price: number;

  total_price: number;

  lines: PricingLineBreakdown[];
};
