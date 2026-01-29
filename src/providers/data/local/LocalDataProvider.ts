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
import { seedCompanySettings } from './seed';

/**
 * LocalDataProvider
 *
 * Mirrors Supabase behavior for UI development.
 * Assemblies are now authoritative in this provider.
 */
export class LocalDataProvider implements IDataProvider {
  private companyId = 'local-company';

  private companySettings: CompanySettings = seedCompanySettings(this.companyId);
  private jobTypes: JobType[] = [];
  private adminRules: AdminRule[] = [];

  private folders: Folder[] = [];
  private materials: Material[] = [];
  private assemblies: Assembly[] = [];
  private assemblyItems: Record<string, any[]> = [];
  private appMaterialOverrides: AppMaterialOverride[] = [];

  /* ============================
     Context
  ============================ */

  async getCurrentCompanyId(): Promise<string> {
    return this.companyId;
  }

  async isAppOwner(): Promise<boolean> {
    return true;
  }

  /* ============================
     Company Settings
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    return this.companySettings;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    this.companySettings = {
      ...this.companySettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    return this.companySettings;
  }

  /* ============================
     Job Types
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    return [...this.jobTypes];
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as JobType;
    const idx = this.jobTypes.findIndex(j => j.id === jobType.id);
    if (idx >= 0) this.jobTypes[idx] = { ...this.jobTypes[idx], ...jobType };
    else this.jobTypes.push({ ...jobType, id: jobType.id ?? crypto.randomUUID() });
    return jobType as JobType;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    this.jobTypes = this.jobTypes.filter(j => j.id !== id);
  }

  /* ============================
     Admin Rules
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    return [...this.adminRules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  async getAdminRules(): Promise<AdminRule[]> {
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as AdminRule;
    const idx = this.adminRules.findIndex(r => r.id === rule.id);
    if (idx >= 0) this.adminRules[idx] = { ...this.adminRules[idx], ...rule };
    else this.adminRules.push({ ...rule, id: rule.id ?? crypto.randomUUID() });
    return rule as AdminRule;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    await this.upsertAdminRule(rule);
  }

  async deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    this.adminRules = this.adminRules.filter(r => r.id !== id);
  }

  /* ============================
     Folders
  ============================ */

  async listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    return this.folders.filter(
      f =>
        f.kind === args.kind &&
        f.library_type === args.libraryType &&
        f.parent_id === args.parentId
    );
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const folder: Folder = {
      id: crypto.randomUUID(),
      kind: args.kind,
      library_type: args.libraryType,
      company_id: this.companyId,
      parent_id: args.parentId,
      name: args.name,
      order_index: 0,
      created_at: new Date().toISOString(),
    };
    this.folders.push(folder);
    return folder;
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const idx = this.folders.findIndex(f => f.id === folder.id);
    if (idx >= 0) {
      this.folders[idx] = { ...this.folders[idx], ...folder } as Folder;
      return this.folders[idx];
    }
    throw new Error('Folder not found');
  }

  async deleteFolder(id: string): Promise<void> {
    this.folders = this.folders.filter(f => f.id !== id);
  }

  /* ============================
     Materials
  ============================ */

  async listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]> {
    return this.materials.filter(
      m => m.library_type === args.libraryType && m.folder_id === args.folderId
    );
  }

  async getMaterial(id: string): Promise<Material | null> {
    return this.materials.find(m => m.id === id) ?? null;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const idx = this.materials.findIndex(m => m.id === material.id);
    if (idx >= 0) {
      this.materials[idx] = { ...this.materials[idx], ...material } as Material;
      return this.materials[idx];
    }

    const created: Material = {
      ...(material as Material),
      id: crypto.randomUUID(),
      company_id: this.companyId,
      library_type: material.library_type ?? 'company',
      folder_id: material.folder_id ?? null,
      labor_minutes: material.labor_minutes ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.materials.push(created);
    return created;
  }

  async deleteMaterial(id: string): Promise<void> {
    this.materials = this.materials.filter(m => m.id !== id);
  }

  /* ============================
     Assemblies (AUTHORITATIVE)
  ============================ */

  async listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]> {
    return this.assemblies.filter(
      a => a.library_type === args.libraryType && a.folder_id === args.folderId
    );
  }

  async getAssembly(id: string): Promise<any | null> {
    const assembly = this.assemblies.find(a => a.id === id);
    if (!assembly) return null;

    return {
      ...assembly,
      items: this.assemblyItems[id] ?? [],
    };
  }

  async upsertAssembly(arg: any): Promise<any> {
    const assembly = arg?.assembly ?? arg;
    const items = arg?.items ?? assembly?.items ?? [];

    let record: Assembly;

    const idx = this.assemblies.findIndex(a => a.id === assembly.id);
    if (idx >= 0) {
      this.assemblies[idx] = { ...this.assemblies[idx], ...assembly };
      record = this.assemblies[idx];
    } else {
      record = {
        ...assembly,
        id: assembly.id ?? crypto.randomUUID(),
        company_id: this.companyId,
        library_type: assembly.library_type ?? 'company',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Assembly;
      this.assemblies.push(record);
    }

    this.assemblyItems[record.id] = items.map((it: any, i: number) => ({
      ...it,
      id: it.id ?? crypto.randomUUID(),
      sort_order: i,
    }));

    return {
      ...record,
      items: this.assemblyItems[record.id],
    };
  }

  async deleteAssembly(id: string): Promise<void> {
    this.assemblies = this.assemblies.filter(a => a.id !== id);
    delete this.assemblyItems[id];
  }

  /* ============================
     Stubbed sections (later)
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    return [];
  }
  async listEstimates(): Promise<Estimate[]> {
    return [];
  }
  async getEstimate(): Promise<Estimate | null> {
    return null;
  }
  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return estimate as Estimate;
  }
  async deleteEstimate(): Promise<void> {}

  async getCsvSettings(): Promise<CsvSettings> {
    return {} as CsvSettings;
  }
  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    return settings as CsvSettings;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    return {} as BrandingSettings;
  }
  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    return settings as BrandingSettings;
  }
}
