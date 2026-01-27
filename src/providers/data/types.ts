// src/providers/data/types.ts

export type UUID = string;

/* ================================
   Core Ownership / Library Types
================================ */

export type OwnerType = 'user' | 'app';
export type LibraryType = 'materials' | 'assemblies';

/* ================================
   Profiles / Company
================================ */

export interface Profile {
  user_id: UUID;
  email: string;
  full_name?: string | null;
  company_id: UUID;
  is_app_owner?: boolean;
}

/* ================================
   Job Types
================================ */

export interface JobType {
  id: UUID;
  name: string;
  efficiency_percent: number;
  billing_type: 'flat' | 'hourly';
  enabled: boolean;
}

/* ================================
   Folders
================================ */

export interface Folder {
  id: UUID;
  company_id: UUID | null;
  owner: OwnerType;
  library: LibraryType;
  parent_id: UUID | null;
  name: string;
  image_path?: string | null;
  sort_order: number;
  created_at: string;
}

/* ================================
   Materials
================================ */

export interface Material {
  id: UUID;
  company_id: UUID | null;
  owner: OwnerType;
  folder_id: UUID;

  name: string;
  sku?: string | null;
  description?: string | null;

  base_cost: number;
  taxable: boolean;

  labor_minutes: number;
  job_type_id: UUID | null;

  image_path?: string | null;

  created_at: string;
  updated_at: string;

  // UI-only merged fields
  custom_cost?: number | null;
  use_custom_cost?: boolean;
  effective_cost?: number;
}

/* ================================
   App Material Overrides
================================ */

export interface AppMaterialOverride {
  company_id: UUID;
  material_id: UUID;

  override_job_type_id?: UUID | null;
  override_taxable?: boolean | null;

  custom_cost?: number | null;
  use_custom_cost?: boolean | null;

  updated_at: string;
}

/* ================================
   Material Picker (Assemblies / Estimates)
================================ */

export interface PickedMaterial {
  material_id: UUID;
  quantity: number;
}

/* ================================
   CSV Import / Export
================================ */

export interface MaterialCsvRow {
  folder_path: string;
  name: string;
  sku?: string;
  description?: string;
  base_cost: number;
  labor_hours: number; // decimal hours in CSV
  taxable: boolean;
  job_type_name?: string;
}

/* ================================
   Data Provider Interface
================================ */

export interface DataProvider {
  /* ---------- Materials ---------- */

  listMaterials(library: OwnerType): Promise<Material[]>;
  getMaterial(id: UUID): Promise<Material | null>;
  upsertMaterial(material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: UUID): Promise<void>;

  /* ---------- Folders ---------- */

  listFolders(library: LibraryType, owner: OwnerType): Promise<Folder[]>;
  upsertFolder(folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: UUID): Promise<void>;

  /* ---------- Overrides ---------- */

  listAppMaterialOverrides(): Promise<AppMaterialOverride[]>;
  upsertAppMaterialOverride(
    override: Partial<AppMaterialOverride>
  ): Promise<void>;
}
