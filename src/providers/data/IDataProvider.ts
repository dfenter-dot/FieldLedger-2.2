import type {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  EstimateOption,
  EstimateItem,
  Folder,
  JobType,
  LibraryType,
  Material,
  AppMaterialOverride,
} from './types';

/**
 * IDataProvider
 *
 * Authoritative contract between UI and persistence.
 *
 * STATUS:
 * - Admin ✅
 * - Materials ✅
 * - Assemblies ✅
 * - Estimates ✅ (this phase)
 */
export interface IDataProvider {
  /* ============================
     Context
  ============================ */
  getCurrentCompanyId(): Promise<string>;
  isAppOwner(): Promise<boolean>;

  /* ============================
     Company Settings (Admin)
  ============================ */
  getCompanySettings(): Promise<CompanySettings>;
  saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;

  /* ============================
     Job Types (Admin)
  ============================ */
  listJobTypes(): Promise<JobType[]>;
  upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType>;
  deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void>;

  /* ============================
     Admin Rules
  ============================ */
  listAdminRules(): Promise<AdminRule[]>;
  getAdminRules(companyId: string): Promise<AdminRule[]>;
  upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule>;
  saveAdminRule(rule: Partial<AdminRule>): Promise<void>;
  deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void>;

  /* ============================
     Folders
  ============================ */
  listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]>;

  createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder>;

  saveFolder(folder: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  /* ============================
     Materials
  ============================ */
  listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]>;

  getMaterial(id: string): Promise<Material | null>;
  saveMaterial(material: Partial<Material>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;

  /* ============================
     App Material Overrides
  ============================ */
  getAppMaterialOverride(materialId: string, companyId: string): Promise<AppMaterialOverride | null>;
  upsertAppMaterialOverride(materialId: string, patch: Partial<AppMaterialOverride>): Promise<AppMaterialOverride>;

  /* ============================
     Assemblies
  ============================ */
  listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]>;

  getAssembly(id: string): Promise<any | null>;

  upsertAssembly(arg: any): Promise<any>;
  deleteAssembly(id: string): Promise<void>;

  /* ============================
     Estimates (AUTHORITATIVE)
  ============================ */
  listEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | null>;
  upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate>;
  updateEstimateHeader(estimate: Partial<Estimate>): Promise<Estimate>;
  listEstimateOptions(estimateId: string): Promise<EstimateOption[]>;
  getEstimateItemsForOption(optionId: string): Promise<EstimateItem[]>;
  replaceEstimateItemsForOption(optionId: string, items: EstimateItem[]): Promise<void>;
  updateEstimateOption(option: Partial<EstimateOption> & { id: string }): Promise<EstimateOption>;
  createEstimateOption(estimateId: string, optionName: string): Promise<EstimateOption>;

  copyEstimateOption(estimateId: string, fromOptionId: string): Promise<EstimateOption>;
  deleteEstimate(id: string): Promise<void>;

  deleteEstimateOption(optionId: string): Promise<void>;

  /* ============================
     CSV / Branding (later)
  ============================ */
  getCsvSettings(): Promise<CsvSettings>;
  saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings>;

  getBrandingSettings(): Promise<BrandingSettings>;
  saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings>;
}




