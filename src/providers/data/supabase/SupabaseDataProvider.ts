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
 * Admin focus (for now):
 * - Company Setup (authoritative)
 * - Job Types
 * - Rules
 *
 * Other sections are present only to satisfy IDataProvider and will be
 * stabilized later when their phase begins.
 */

type DbOwner = 'company' | 'app';

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

  /**
   * Normalize UI library vocabulary:
   * UI may pass 'company' | 'user' | 'app'
   * DB uses only 'company' | 'app'
   */
  private toDbOwner(libraryType: any): DbOwner {
    const v = String(libraryType ?? '').toLowerCase().trim();
    if (v === 'company' || v === 'user') return 'company';
    return 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return (owner === 'company' ? 'company' : 'app') as any;
  }

  /* ============================
     Folders (kept minimal)
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
      library: args.kind,
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
     Company Settings (ADMIN — AUTHORITATIVE)
  ============================ */

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;

    if (data) {
      return data as CompanySettings;
    }

    // Seed defaults if missing
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
     Job Types (ADMIN — STUBBED)
     Will be finalized in next step
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
    const payload = { ...jobType, company_id: jobType.company_id ?? companyId };

    const { data, error } = await this.supabase
      .from('job_types')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  }

  async deleteJobType(companyIdOrId: any, maybeId?: any): Promise<void> {
    const id = (maybeId ?? companyIdOrId) as string;
    const { error } = await this.supabase.from('job_types').delete().eq('id', id);
    if (error) throw error;
  }

  /* ============================
     Admin Rules (ADMIN — STUBBED)
     Will be finalized in next step
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
    return this.listAdminRules();
  }

  async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
    const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;
    const companyId = await this.currentCompanyId();
    const payload = {
      ...rule,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('admin_rules')
      .upsert(payload as any)
      .select()
      .single();
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
     The remaining IDataProvider methods
     are intentionally unimplemented or minimal
     and will be completed in later phases.
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
  async deleteMaterial(): Promise<void> {}

  async getAppMaterialOverride(): Promise<AppMaterialOverride | null> {
    return null;
  }
  async upsertAppMaterialOverride(override: Partial<AppMaterialOverride>): Promise<AppMaterialOverride> {
    return override as AppMaterialOverride;
  }

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
