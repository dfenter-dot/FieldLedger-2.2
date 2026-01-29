import { SupabaseClient } from '@supabase/supabase-js';
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
import { seedCompanySettings } from '../local/seed';

/**
 * SupabaseDataProvider
 *
 * PHASE SCOPE (current):
 * - Admin (Company Setup, Job Types, Rules) ✅
 * - Materials ✅ (authoritative)
 *
 * Assemblies / Estimates / CSV / Branding are intentionally
 * stubbed and will be completed in later phases.
 */

type DbOwner = 'company' | 'app';
type DbLibrary = 'materials' | 'assemblies';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  private _isAppOwner: boolean | null = null;

  /* ============================
     Context
  ============================ */

  private async currentCompanyId(): Promise<string> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('company_id')
      .single();
    if (error || !data?.company_id) {
      throw new Error('No company context available');
    }
    return data.company_id;
  }

  async getCurrentCompanyId(): Promise<string> {
    return this.currentCompanyId();
  }

  async isAppOwner(): Promise<boolean> {
    if (this._isAppOwner !== null) return this._isAppOwner;

    // ENV VAR CHECK
    try {
      const envEmail = (import.meta as any)?.env?.VITE_APP_OWNER_EMAIL;
      if (envEmail) {
        const { data } = await this.supabase.auth.getUser();
        const email = data?.user?.email ?? '';
        if (email && email.toLowerCase() === String(envEmail).toLowerCase()) {
          this._isAppOwner = true;
          return true;
        }
      }
    } catch {
      // ignore
    }

    // DB FLAG CHECK
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('is_app_owner')
        .single();
      if (!error && typeof (data as any)?.is_app_owner === 'boolean') {
        this._isAppOwner = Boolean((data as any).is_app_owner);
        return this._isAppOwner;
      }
    } catch {
      // ignore
    }

    this._isAppOwner = false;
    return false;
  }

  private toDbOwner(libraryType: LibraryType): DbOwner {
    return libraryType === 'company' ? 'company' : 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return owner === 'company' ? 'company' : 'app';
  }

  /* ============================
     Company Settings (ADMIN)
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;

    if (data) return data as CompanySettings;

    const seeded = seedCompanySettings(companyId);
    const { data: created, error: createErr } = await this.supabase
      .from('company_settings')
      .insert(seeded as any)
      .select()
      .single();
    if (createErr) throw createErr;

    return created as CompanySettings;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('company_settings')
      .upsert(payload as any)
      .select()
      .single();
    if (error) throw error;

    return data as CompanySettings;
  }

  /* ============================
     Job Types (ADMIN)
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as JobType[];
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as Partial<JobType>;
    const companyId = await this.currentCompanyId();

    const payload: any = {
      ...jobType,
      company_id: jobType.company_id ?? companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('job_types')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return data as JobType;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Admin Rules (ADMIN)
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });
    if (error) throw error;

    return (data ?? []) as AdminRule[];
  }

  async getAdminRules(_companyId: string): Promise<AdminRule[]> {
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    const companyId = await this.currentCompanyId();

    const payload: any = {
      ...rule,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('admin_rules')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return data as AdminRule;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    await this.upsertAdminRule(rule);
  }

  async deleteAdminRule(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('admin_rules').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Folders (Materials)
  ============================ */

  async listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('folders')
      .select('*')
      .eq('library', args.kind)
      .eq('owner', owner)
      .order('sort_order', { ascending: true });

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      kind: row.library,
      library_type: this.fromDbOwner(row.owner),
      company_id: row.company_id ?? null,
      parent_id: row.parent_id ?? null,
      name: row.name,
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at,
    })) as any;
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    const payload: any = {
      owner,
      library: args.kind as DbLibrary,
      name: args.name,
      parent_id: args.parentId,
      sort_order: 0,
      company_id: owner === 'company' ? companyId : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('folders')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      kind: data.library,
      library_type: this.fromDbOwner(data.owner),
      company_id: data.company_id ?? null,
      parent_id: data.parent_id ?? null,
      name: data.name,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
    } as any;
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(folder.library_type ?? 'company');

    const payload: any = {
      id: folder.id,
      owner,
      library: folder.kind ?? 'materials',
      company_id: owner === 'company' ? companyId : null,
      parent_id: folder.parent_id ?? null,
      name: folder.name,
      sort_order: folder.order_index ?? 0,
      created_at: folder.created_at,
    };

    const { data, error } = await this.supabase
      .from('folders')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      kind: data.library,
      library_type: this.fromDbOwner(data.owner),
      company_id: data.company_id ?? null,
      parent_id: data.parent_id ?? null,
      name: data.name,
      order_index: Number(data.sort_order ?? 0),
      created_at: data.created_at,
    } as any;
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Materials (AUTHORITATIVE)
  ============================ */

  async listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('materials')
      .select('*')
      .eq('owner', owner)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id ?? null,
      folder_id: row.folder_id ?? null,
      name: row.name,
      sku: row.sku ?? null,
      description: row.description ?? null,
      base_cost: Number(row.base_cost ?? 0),
      taxable: Boolean(row.taxable ?? false),
      job_type_id: row.job_type_id ?? null,
      labor_minutes: Number(row.labor_minutes ?? 0),
      labor_hours: 0, // DB does not store hours
      order_index: Number(row.sort_order ?? 0),
      updated_at: row.updated_at ?? null,
      created_at: row.created_at ?? null,
      library_type: this.fromDbOwner(row.owner),
    })) as any;
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable ?? false),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
      library_type: this.fromDbOwner(data.owner),
    } as any;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    if (material.company_id === null) {
      const isOwner = await this.isAppOwner();
      if (!isOwner) {
        throw new Error('App materials cannot be edited directly');
      }
    }

    const owner = this.toDbOwner(material.library_type ?? 'company');

    const payload: any = {
      id: material.id,
      owner,
      company_id: owner === 'company' ? (material.company_id ?? companyId) : null,
      folder_id: material.folder_id ?? null,
      name: material.name,
      sku: material.sku ?? null,
      description: material.description ?? null,
      base_cost: material.base_cost ?? 0,
      taxable: material.taxable ?? false,
      job_type_id: material.job_type_id ?? null,
      labor_minutes: material.labor_minutes ?? 0,
      sort_order: material.order_index ?? 0,
      updated_at: new Date().toISOString(),
      created_at: material.created_at,
    };

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase
      .from('materials')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      company_id: data.company_id ?? null,
      folder_id: data.folder_id ?? null,
      name: data.name,
      sku: data.sku ?? null,
      description: data.description ?? null,
      base_cost: Number(data.base_cost ?? 0),
      taxable: Boolean(data.taxable ?? false),
      job_type_id: data.job_type_id ?? null,
      labor_minutes: Number(data.labor_minutes ?? 0),
      labor_hours: 0,
      order_index: Number(data.sort_order ?? 0),
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
      library_type: this.fromDbOwner(data.owner),
    } as any;
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     App Material Overrides
  ============================ */

  async getAppMaterialOverride(
    materialId: string,
    companyId: string
  ): Promise<AppMaterialOverride | null> {
    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('material_id', materialId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;

    return (data as any) ?? null;
  }

  async upsertAppMaterialOverride(
    override: Partial<AppMaterialOverride>
  ): Promise<AppMaterialOverride> {
    const companyId = await this.currentCompanyId();

    const payload: any = {
      ...override,
      company_id: override.company_id ?? companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return data as AppMaterialOverride;
  }

  /* ============================
     Stubbed sections (later)
  ============================ */

  async listAssemblies(): Promise<Assembly[]> {
    return [];
  }
  async getAssembly(): Promise<any | null> {
    return null;
  }
  async upsertAssembly(arg: any): Promise<any> {
    return arg;
  }
  async deleteAssembly(): Promise<void> {}

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
