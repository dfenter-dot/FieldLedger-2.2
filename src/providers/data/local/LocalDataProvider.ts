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
 * Estimates are now authoritative in this provider.
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

  private estimates: Estimate[] = [];
  private estimateOptionItems: Record<string, any[]> = {};

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
  const root = this.folders.find(f => f.id === id);
  if (!root) return;

  // Collect subtree folder ids
  const folderIds: string[] = [id];
  let frontier: string[] = [id];
  while (frontier.length) {
    const kids = this.folders.filter(f => f.parent_id && frontier.includes(f.parent_id) && f.kind === root.kind && f.library_type === root.library_type);
    const next = kids.map(k => k.id).filter(Boolean);
    if (!next.length) break;
    folderIds.push(...next);
    frontier = next;
  }

  if (root.kind === 'materials') {
    const materialIds = this.materials.filter(m => folderIds.includes(m.folder_id ?? '') && m.library_type === root.library_type).map(m => m.id);
    if (materialIds.length) {
      // Remove references from assembly items
      for (const [asmId, items] of Object.entries(this.assemblyItems)) {
        this.assemblyItems[asmId] = (items ?? []).filter((it: any) => !materialIds.includes(it.material_id));
      }
      this.materials = this.materials.filter(m => !materialIds.includes(m.id));
    }
  } else {
    const assemblyIds = this.assemblies.filter(a => folderIds.includes(a.folder_id ?? '') && a.library_type === root.library_type).map(a => a.id);
    if (assemblyIds.length) {
      this.assemblies = this.assemblies.filter(a => !assemblyIds.includes(a.id));
      for (const id of assemblyIds) delete this.assemblyItems[id];
    }
  }

  // Delete folders
  this.folders = this.folders.filter(f => !folderIds.includes(f.id));
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
     Assemblies
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
     Estimates (AUTHORITATIVE)
  ============================ */

  async listEstimates(): Promise<Estimate[]> {
    return [...this.estimates];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    return this.estimates.find(e => e.id === id) ?? null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const idx = this.estimates.findIndex(e => e.id === estimate.id);
    if (idx >= 0) {
      this.estimates[idx] = {
        ...this.estimates[idx],
        ...estimate,
        updated_at: new Date().toISOString(),
      } as Estimate;
      return this.estimates[idx];
    }

    const created: Estimate = {
      ...(estimate as Estimate),
      id: estimate.id ?? crypto.randomUUID(),
      company_id: this.companyId,
      status: estimate.status ?? 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.estimates.push(created);
    return created;
  }

  
  async updateEstimateHeader(estimate: Partial<Estimate>): Promise<Estimate> {
    // Local provider: treat as upsert without touching items/options.
    return this.upsertEstimate(estimate);
  }

  async listEstimateOptions(estimateId: string): Promise<EstimateOption[]> {
    const est = this.estimates.find(e => e.id === estimateId) as any;
    return (est?.options ?? []) as EstimateOption[];
  }

  async createEstimateOption(estimateId: string, optionName: string): Promise<EstimateOption> {
    const estIdx = this.estimates.findIndex(e => (e as any).id === estimateId);
    if (estIdx < 0) throw new Error('Estimate not found');
    const est: any = this.estimates[estIdx] as any;

    const existing: any[] = Array.isArray(est.options) ? est.options : [];
    const nextSort = existing.reduce((mx, o) => Math.max(mx, Number(o.sort_order ?? 0)), 0) + 1;
    const nextNum = existing.reduce((mx, o) => Math.max(mx, Number(o.option_number ?? 0)), 0) + 1;

    const opt: any = {
      id: crypto.randomUUID(),
      estimate_id: estimateId,
      option_number: nextNum,
      option_name: optionName,
      option_description: null,
      sort_order: nextSort,

      job_type_id: null,
      use_admin_rules: false,
      customer_supplies_materials: false,
      apply_discount: false,
      discount_percent: null,
      apply_processing_fees: false,
    };

    est.options = [...existing, opt];
    est.active_option_id = opt.id;
    this.estimates[estIdx] = est;
    this.estimateOptionItems[opt.id] = [];
    return opt as EstimateOption;
  }


  async updateEstimateOption(option: Partial<EstimateOption> & { id: string }): Promise<EstimateOption> {
    // Local provider: options stored in-memory on the estimate.
    for (const e of this.estimates as any[]) {
      const opts: any[] = e?.options ?? [];
      const idx = opts.findIndex(o => o.id === option.id);
      if (idx >= 0) {
        opts[idx] = { ...opts[idx], ...option };
        e.options = opts;
        return opts[idx] as EstimateOption;
      }
    }
    throw new Error('Estimate option not found');
  }

  async getEstimateItemsForOption(optionId: string): Promise<EstimateItem[]> {
    return (this.estimateOptionItems[optionId] ?? []) as any;
  }

  async replaceEstimateItemsForOption(optionId: string, items: EstimateItem[]): Promise<void> {
    this.estimateOptionItems[optionId] = Array.isArray(items) ? [...items] : [];
  }

  async copyEstimateOption(estimateId: string, fromOptionId: string): Promise<EstimateOption> {
    const estIdx = this.estimates.findIndex(e => (e as any).id === estimateId);
    if (estIdx < 0) throw new Error('Estimate not found');
    const est: any = this.estimates[estIdx] as any;

    const existing: any[] = Array.isArray(est.options) ? est.options : [];
    if (existing.length === 0) {
      this.createEstimateOption(estimateId, 'Option 1');
    }

    const refreshed: any[] = Array.isArray(est.options) ? est.options : [];
    const nextSort = refreshed.reduce((mx, o) => Math.max(mx, Number(o.sort_order ?? 0)), 0) + 1;
    const nextNum = refreshed.reduce((mx, o) => Math.max(mx, Number(o.option_number ?? 0)), 0) + 1;

    const src = refreshed.find(o => String(o.id) === String(fromOptionId)) ?? null;

    const opt: any = {
      id: crypto.randomUUID(),
      estimate_id: estimateId,
      option_number: nextNum,
      option_name: `Option ${nextNum}`,
      option_description: null,
      sort_order: nextSort,

      job_type_id: src?.job_type_id ?? null,
      use_admin_rules: Boolean(src?.use_admin_rules ?? false),
      customer_supplies_materials: Boolean(src?.customer_supplies_materials ?? false),
      apply_discount: Boolean(src?.apply_discount ?? false),
      discount_percent: src?.discount_percent ?? null,
      apply_processing_fees: Boolean(src?.apply_processing_fees ?? false),
    };

    est.options = [...refreshed, opt];
    est.active_option_id = opt.id;
    this.estimates[estIdx] = est;

    const srcItems = this.estimateOptionItems[fromOptionId] ?? [];
    this.estimateOptionItems[opt.id] = srcItems.map((x: any) => ({ ...x, id: crypto.randomUUID() }));

    return Promise.resolve(opt as any);
  }
async deleteEstimate(id: string): Promise<void> {
    this.estimates = this.estimates.filter(e => e.id !== id);
  }

  async deleteEstimateOption(optionId: string): Promise<void> {
    // Local provider: remove items + option, keep estimate.
    const opt = this.estimateOptions.find(o => (o as any).id === optionId) as any;
    if (!opt) return;
    const estimateId = opt.estimate_id;

    const remaining = this.estimateOptions.filter(o => (o as any).estimate_id === estimateId && (o as any).id !== optionId);
    if (remaining.length === 0) throw new Error('Cannot delete the last option.');

    this.estimateItems = this.estimateItems.filter(i => (i as any).estimate_option_id !== optionId);
    this.estimateOptions = this.estimateOptions.filter(o => (o as any).id !== optionId);

    // Fix active option if needed
    const est = this.estimates.find(e => (e as any).id === estimateId) as any;
    if (est && est.active_option_id === optionId) {
      est.active_option_id = (remaining[0] as any).id;
    }
  }

  /* ============================
     CSV / Branding (later)
  ============================ */

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





