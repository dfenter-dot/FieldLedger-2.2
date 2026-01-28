// src/providers/data/IDataProvider.ts

import type {
  Assembly,
  AssemblyItem,
  AppAssemblyOverride,
  CompanySettings,
  Estimate,
  EstimateAssemblyLine,
  Folder,
  JobType,
  Material,
  PricingResult,
  UUID,
} from './types';

export type AssemblyListParams = {
  libraryType: 'user' | 'app';
  folderId: UUID;
};

export interface IDataProvider {
  /* =======================
   * Folders
   * ======================= */
  listFolders(params: {
    ownerType: 'user' | 'app';
    parentId: UUID | null;
  }): Promise<Folder[]>;

  createFolder(folder: Partial<Folder>): Promise<Folder>;
  updateFolder(folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(folderId: UUID): Promise<void>;

  /* =======================
   * Materials
   * ======================= */
  listMaterials(params: {
    ownerType: 'user' | 'app';
    folderId: UUID;
  }): Promise<Material[]>;

  getMaterial(id: UUID): Promise<Material | null>;
  upsertMaterial(material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: UUID): Promise<void>;

  /* =======================
   * Assemblies
   * ======================= */
  listAssemblies(params: AssemblyListParams): Promise<Assembly[]>;

  getAssembly(id: UUID): Promise<{
    assembly: Assembly;
    items: AssemblyItem[];
    appOverride?: AppAssemblyOverride | null;
  } | null>;

  upsertAssembly(params: {
    assembly: Partial<Assembly>;
    items: AssemblyItem[];
  }): Promise<Assembly>;

  deleteAssembly(id: UUID): Promise<void>;

  /* =======================
   * Assembly Overrides
   * ======================= */
  getAppAssemblyOverride(
    assemblyId: UUID,
    companyId: UUID
  ): Promise<AppAssemblyOverride | null>;

  upsertAppAssemblyOverride(
    override: Partial<AppAssemblyOverride>
  ): Promise<AppAssemblyOverride>;

  /* =======================
   * Estimates
   * ======================= */
  getEstimate(id: UUID): Promise<Estimate | null>;
  upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(id: UUID): Promise<void>;

  addAssemblyToEstimate(params: {
    estimateId: UUID;
    assemblyId: UUID;
    quantity: number;
  }): Promise<EstimateAssemblyLine>;

  removeAssemblyFromEstimate(
    estimateAssemblyLineId: UUID
  ): Promise<void>;

  /* =======================
   * Job Types / Settings
   * ======================= */
  listJobTypes(): Promise<JobType[]>;
  getCompanySettings(): Promise<CompanySettings>;

  /* =======================
   * Pricing
   * ======================= */
  computeAssemblyPricing(params: {
    assembly: Assembly;
    items: AssemblyItem[];
    materialsById: Record<UUID, Material>;
    jobTypesById: Record<UUID, JobType>;
    companySettings: CompanySettings;
  }): PricingResult;
}
