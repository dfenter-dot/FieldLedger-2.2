import {
  AdminRule,
  Assembly,
  AssemblyItem,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  LibraryType,
  Material,
  AppMaterialOverride,
} from '../types';
import { IDataProvider } from '../IDataProvider';

/**
 * LocalDataProvider
 *
 * Non-persistent, in-memory provider.
 * Used ONLY for local/dev scenarios.
 * Must match IDataProvider shape exactly.
 */
export class LocalDataProvider implements IDataProvider {
  /* ============================
     Context
  ============================ */

  async getCurrentCompanyId(): Promise<string> {
    return 'local-company';
  }

  async isAppOwner(): Promise<boolean> {
    return true;
  }

  /* ============================
     Folders
  ============================ */

  async listFolders(): Promise<Folder[]> {
    return [];
  }

  async createFolder(): Promise<Folder> {
    throw new Error('LocalDataProvider.createFolder not implemented');
  }

  async saveFolder(): Promise<Folder> {
    throw new Error('LocalDataProvider.saveFolder not implemented');
  }

  async deleteFolder(): Promise<void> {
    return;
  }

  /* ============================
     Materials
  ============================ */

  async listMaterials(): Promise<Material[]> {
    return [];
  }

  async getMaterial(): Promise<Material | null> {
    return null;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    return material as Material;
  }

  async deleteMaterial(): Promise<void> {
    return;
  }

  async getAppMaterialOverride(): Promise<AppMaterialOverride | null> {
    return null;
  }

  async upsertAppMaterialOverride(
    override: Partial<AppMaterialOverride>
  ): Promise<AppMaterialOverride> {
    return override as AppMaterialOverride;
  }

  /* ============================
     Assemblies
  ============================ */

  async listAssemblies(): Promise<Assembly[]> {
    return [];
  }

  async getAssembly(): Promise<Assembly | null> {
    return null;
  }

  async saveAssembly(args: {
    assembly: Partial<Assembly>;
    items?: AssemblyItem[];
  }): Promise<Assembly> {
    return {
      ...(args.assembly as Assembly),
      items: args.items ?? [],
    };
  }

  async deleteAssembly(): Promise<void> {
    return;
  }

  /* ============================
     Estimates
  ============================ */

  async listEstimates(): Promise<Estimate[]> {
    return [];
  }

  async getEstimate(): Promise<Estimate | null> {
    return null;
  }

  async saveEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return estimate as Estimate;
  }

  async deleteEstimate(): Promise<void> {
    return;
  }

  /* ============================
     Job Types
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    return [];
  }

  async saveJobType(jobType: Partial<JobType>): Promise<JobType> {
    return jobType as JobType;
  }

  async deleteJobType(): Promise<void> {
    return;
  }

  /* ============================
     Admin Rules
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    return [];
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<AdminRule> {
    return rule as AdminRule;
  }

  async deleteAdminRule(): Promise<void> {
    return;
  }

  /* ============================
     Company Settings
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    throw new Error('LocalDataProvider.getCompanySettings not implemented');
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
    return settings as CompanySettings;
  }

  /* ============================
     CSV / Branding
  ============================ */

  async getCsvSettings(): Promise<CsvSettings> {
    throw new Error('LocalDataProvider.getCsvSettings not implemented');
  }

  async saveCsvSettings(
    settings: Partial<CsvSettings>
  ): Promise<CsvSettings> {
    return settings as CsvSettings;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    throw new Error('LocalDataProvider.getBrandingSettings not implemented');
  }

  async saveBrandingSettings(
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    return settings as BrandingSettings;
  }
}
