// src/providers/data/local/LocalDataProvider.ts

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
} from '../types';
import type { IDataProvider } from '../IDataProvider';
import { computeAssemblyPricing } from '../pricing';

export class LocalDataProvider implements IDataProvider {
  /* =======================
   * Folders
   * ======================= */
  async listFolders(): Promise<Folder[]> {
    return [];
  }

  async createFolder(folder: Partial<Folder>): Promise<Folder> {
    return folder as Folder;
  }

  async updateFolder(folder: Partial<Folder>): Promise<Folder> {
    return folder as Folder;
  }

  async deleteFolder(): Promise<void> {
    return;
  }

  /* =======================
   * Materials
   * ======================= */
  async listMaterials(): Promise<Material[]> {
    return [];
  }

  async getMaterial(): Promise<Material | null> {
    return null;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    return material as Material;
  }

  async deleteMaterial(): Promise<void> {
    return;
  }

  /* =======================
   * Assemblies
   * ======================= */
  async listAssemblies(): Promise<Assembly[]> {
    return [];
  }

  async getAssembly(): Promise<{
    assembly: Assembly;
    items: AssemblyItem[];
    appOverride?: AppAssemblyOverride | null;
  } | null> {
    return null;
  }

  async upsertAssembly(params: {
    assembly: Partial<Assembly>;
    items: AssemblyItem[];
  }): Promise<Assembly> {
    return params.assembly as Assembly;
  }

  async deleteAssembly(): Promise<void> {
    return;
  }

  /* =======================
   * Assembly Overrides
   * ======================= */
  async getAppAssemblyOverride(): Promise<AppAssemblyOverride | null> {
    return null;
  }

  async upsertAppAssemblyOverride(
    override: Partial<AppAssemblyOverride>
  ): Promise<AppAssemblyOverride> {
    return override as AppAssemblyOverride;
  }

  /* =======================
   * Estimates
   * ======================= */
  async getEstimate(): Promise<Estimate | null> {
    return null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return estimate as Estimate;
  }

  async deleteEstimate(): Promise<void> {
    return;
  }

  async addAssemblyToEstimate(params: {
    estimateId: UUID;
    assemblyId: UUID;
    quantity: number;
  }): Promise<EstimateAssemblyLine> {
    return {
      id: crypto.randomUUID(),
      estimate_id: params.estimateId,
      assembly_id: params.assemblyId,
      quantity: params.quantity,
    };
  }

  async removeAssemblyFromEstimate(): Promise<void> {
    return;
  }

  /* =======================
   * Job Types / Settings
   * ======================= */
  async listJobTypes(): Promise<JobType[]> {
    return [];
  }

  async getCompanySettings(): Promise<CompanySettings> {
    return {
      id: crypto.randomUUID(),
      purchase_tax_percent: 0,
      misc_material_percent: 0,
    };
  }

  /* =======================
   * Pricing
   * ======================= */
  computeAssemblyPricing(params: {
    assembly: Assembly;
    items: AssemblyItem[];
    materialsById: Record<UUID, Material>;
    jobTypesById: Record<UUID, JobType>;
    companySettings: CompanySettings;
  }): PricingResult {
    return computeAssemblyPricing(params);
  }
}
