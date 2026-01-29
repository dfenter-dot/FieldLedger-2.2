import type {
  AdminRule,
  Assembly,
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
import type { IDataProvider } from '../IDataProvider';

/**
 * LocalDataProvider
 *
 * In-memory provider used only for dev/testing.
 * MUST satisfy IDataProvider signatures so pages compile.
 *
 * For the Admin phase, this intentionally focuses on:
 * - Company Setup
 * - Job Types
 * - Rules
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

  async listFolders(_args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    return [];
  }

  async createFolder(_args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    throw new Error('LocalDataProvider.createFolder not implemented');
  }

  async saveFolder(_folder: Partial<Folder>): Promise<Folder> {
    throw new Error('LocalDataProvider.saveFolder not implemented');
  }

  async deleteFolder(_id: string): Promise<void> {
    return;
  }

  /* ============================
     Materials
  ============================ */

  async listMaterials(_args: { libraryType: LibraryType; folderId: string | null }): Promise<Material[]> {
    return [];
  }

  async getMaterial(_id: string): Promise<Material | null> {
    return null;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    return material as Material;
  }

  async deleteMaterial(_id: string): Promise<void> {
    return;
  }

  async getAppMaterialOverride(_materialId: string, _companyId: string): Promise<AppMaterialOverride | null> {
    return null;
  }

  async upsertAppMaterialOverride(override: Partial<AppMaterialOverride>): Promise<AppMaterialOverride> {
    return override as AppMaterialOverride;
  }

  /* ============================
     Assemblies
  ============================ */

  async listAssemblies(_args: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    return [];
  }

  async getAssembly(_id: string): Promise<any | null> {
    return null;
  }

  async upsertAssembly(arg: any): Promise<any> {
    return arg;
  }

  async deleteAssembly(_id: string): Promise<void> {
    return;
  }

  /* ============================
     Estimates
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    return [];
  }

  async listEstimates(): Promise<Estimate[]> {
    return [];
  }

  async getEstimate(_id: string): Promise<Estimate | null> {
    return null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return estimate as Estimate;
  }

  async deleteEstimate(_id: string): Promise<void> {
    return;
  }

  /* ============================
     Job Types (Admin)
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    return [];
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as Partial<JobType>;
    return jobType as JobType;
  }

  async deleteJobType(_companyIdOrId: any, _maybeId?: any): Promise<void> {
    return;
  }

  /* ============================
     Company Settings (Admin)
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    throw new Error('LocalDataProvider.getCompanySettings not implemented');
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    return settings as CompanySettings;
  }

  /* ============================
     Admin Rules (Admin)
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    return [];
  }

  async getAdminRules(_companyId: string): Promise<AdminRule[]> {
    return [];
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    return rule as AdminRule;
  }

  async saveAdminRule(_rule: Partial<AdminRule>): Promise<void> {
    return;
  }

  async deleteAdminRule(_companyIdOrId: any, _maybeId?: any): Promise<void> {
    return;
  }

  /* ============================
     CSV / Branding (not prioritized yet)
  ============================ */

  async getCsvSettings(): Promise<CsvSettings> {
    throw new Error('LocalDataProvider.getCsvSettings not implemented');
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    return settings as CsvSettings;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    throw new Error('LocalDataProvider.getBrandingSettings not implemented');
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    return settings as BrandingSettings;
  }
}
