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
 * DB enums (your Supabase):
 * - owner: 'app' | 'company'
 * - folders.library: 'materials' | 'assemblies'
 *
 * This Admin pass is constrained to:
 * - Company Setup
 * - Job Types
 * - Rules
 *
 * CSV / Branding / Job Costing are NOT expanded unless absolutely necessary.
 */

type DbOwner = 'company' | 'app';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  private _isAppOwner: boolean | null = null;

  /* ============================
     Context
  ============================ */

  private async currentCompanyId(): Promise<string> {
    const { data, error } = await this.supabase.from('profiles').select('company_id').single();
    if (error || !data?.company_id) throw new Error('No company context available');
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
      const { data, error } = await this.supabase.from('profiles').select('is_app_owner').single();
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

  /**
   * Normalize UI library vocabulary:
   * UI might pass: 'company' | 'user' | 'app'
   * DB uses: 'company' | 'app'
   */
  private toDbOwner(libraryType: any): DbOwner {
    const v = String(libraryType ?? '').toLowerCase().trim();
    if (v === 'company' || v === 'user') return 'company';
    return 'app';
  }

  /**
   * Emit a stable UI library_type:
   * - company rows -> 'company'
   * - app rows -> 'app'
   */
  private fromDbOwner(owner: DbOwner): LibraryType {
    return (owner === 'company' ? 'company' : 'app') as any;
  }

  /* ============================
     Folders
     (needed for Admin indirectly through other pages; keep stable)
  ============================ */

  async listFolders(args: { kind: 'materials' | 'assemblies'; libraryType: LibraryType; parentId: string | null }): Promise<Folder[]> {
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

  async createFolder(args: { kind: 'materials' | 'assemblies'; libraryType: LibraryType; parentId: string | null; name: string }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    const payload: any = {
      owner,
      library: args.kind,
      name: args.name,
      parent_id: args.parentId,
      sort_order: 0,
      company_id: owner === 'company' ? companyId : null,
      created_at: new Date().toISOString(),
      // NO updated_at on folders table
    };

    const { data, error } = await this.supabase.from('folders').insert(payload).select().single();
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
    const owner = this.toDbOwner((folder as any).library_type ?? 'company');

    const payload: any = {
      id: (folder as any).id,
      owner,
      library: (folder as any).kind ?? 'materials',
      company_id: owner === 'company' ? companyId : null,
      parent_id: (folder as any).parent_id ?? null,
      name: (folder as any).name,
      sort_order: (folder as any).order_index ?? 0,
      created_at: (folder as any).created_at,
    };

    const { data, error } = await this.supabase.from('folders').upsert(payload).select().single();
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
     Materials (kept minimal for compilation; will be prioritized later)
  ============================ */

  async listMaterials(args: { libraryType: LibraryType; folderId: string | null }): Promise<Material[]> {
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
      labor_hours: 0, // UI-only legacy
      order_index: Number(row.sort_order ?? 0),
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      library_type: this.fromDbOwner(row.owner),
    })) as any;
  }

  async getMaterial(id: string): Promise<Material | null> {
    const { data, error } = await this.supabase.from('materials').select('*').eq('id', id).maybeSingle();
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
      created_at: data.created_at ?? null,
      updated_at: data.updated_at ?? null,
      library_type: this.fromDbOwner(data.owner),
    } as any;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner((material as any).library_type ?? 'company');

    if (owner === 'app' && !(await this.isAppOwner())) throw new Error('App materials cannot be edited directly');

    const payload: any = {
      id: (material as any).id,
      owner,
      company_id: owner === 'company' ? companyId : null,
      folder_id: (material as any).folder_id ?? null,
      name: (material as any).name,
      sku: (material as any).sku ?? null,
      description: (material as any).description ?? null,
      base_cost: (material as any).base_cost ?? (material as any).unit_cost ?? 0,
      taxable: (material as any).taxable ?? false,
      job_type_id: (material as any).job_type_id ?? null,
      labor_minutes: (material as any).labor_minutes ?? 0,
      sort_order: (material as any).order_index ?? 0,
      updated_at: new Date().toISOString(),
      created_at: (material as any).created_at ?? new Date().toISOString(),
    };

    // IMPORTANT: do NOT send labor_hours — column does not exist in DB
    delete payload.labor_hours;

    if (!payload.id) delete payload.id;

    const { data, error } = await this.supabase.from('materials').upsert(payload).select().single();
    if (error) throw error;

    return this.getMaterial(data.id) as Promise<Material>;
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     App Material Overrides (kept; will be used later in Materials)
  ============================ */

  async getAppMaterialOverride(materialId: string, companyId: string): Promise<AppMaterialOverride | null> {
    const { data, error } = await this.supabase
      .from('app_material_overrides')
      .select('*')
      .eq('material_id', materialId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  async upsertAppMaterialOverride(override: Partial<AppMaterialOverride>): Promise<AppMaterialOverride> {
    const companyId = await this.currentCompanyId();
    const payload = { ...override, company_id: (override as any).company_id ?? companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('app_material_overrides').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Assemblies (kept minimal for compilation; will be prioritized later)
  ============================ */

  async listAssemblies(args: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();
    const owner = this.toDbOwner(args.libraryType);

    let q = this.supabase
      .from('assemblies')
      .select('*')
      .eq('owner', owner)
      .order('name', { ascending: true });

    q = owner === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []) as any;
  }

  async getAssembly(id: string): Promise<any | null> {
    const { data, error } = await this.supabase.from('assemblies').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  async upsertAssembly(arg: any): Promise<any> {
    // Assemblies will be stabilized later. Keep existing behavior to avoid breaking the current UI.
    const assembly: any = arg?.assembly ? arg.assembly : arg;
    const { data, error } = await this.supabase.from('assemblies').upsert(assembly).select().single();
    if (error) throw error;
    return data as any;
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error } = await this.supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Estimates (kept for compilation; will be prioritized later)
  ============================ */

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('estimates').select('*').eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []) as any;
  }

  async listEstimates(): Promise<Estimate[]> {
    return this.getEstimates();
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('estimates').select('*').eq('company_id', companyId).eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();
    const payload = { ...estimate, company_id: (estimate as any).company_id ?? companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('estimates').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await this.supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Job Types (ADMIN — PRIORITY)
  ============================ */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  }

  async upsertJobType(companyIdOrJobType: any, maybeJobType?: any): Promise<JobType> {
    const jobType = (maybeJobType ?? companyIdOrJobType) as Partial<JobType>;
    const companyId = await this.currentCompanyId();

    const payload: any = { ...jobType };
    if (!payload.company_id) payload.company_id = companyId;

    const { data, error } = await this.supabase.from('job_types').upsert(payload).select().single();
    if (error) throw error;
    return data as any;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Company Settings (ADMIN — PRIORITY)
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;

    if (data) return data as any;

    // seed if missing
    const seeded = seedCompanySettings(companyId);
    const { data: created, error: createErr } = await this.supabase
      .from('company_settings')
      .insert(seeded as any)
      .select()
      .single();
    if (createErr) throw createErr;
    return created as any;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('company_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  /* ============================
     Admin Rules (ADMIN — PRIORITY)
  ============================ */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getAdminRules(_companyId: string): Promise<AdminRule[]> {
    // Current UI calls provider.getAdminRules(companyId) in some places
    // and provider.listAdminRules() in others. Keep both supported.
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    const companyId = await this.currentCompanyId();
    const payload = { ...rule, company_id: companyId, updated_at: new Date().toISOString() };

    const { data, error } = await this.supabase.from('admin_rules').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
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
     CSV / Branding (NOT prioritized now)
  ============================ */

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase.from('csv_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (error) throw error;
    return (data as any) ?? ({} as any);
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('csv_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? ({} as any);
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const payload = { ...settings, company_id: companyId, updated_at: new Date().toISOString() };
    const { data, error } = await this.supabase.from('branding_settings').upsert(payload as any).select().single();
    if (error) throw error;
    return data as any;
  }
}
