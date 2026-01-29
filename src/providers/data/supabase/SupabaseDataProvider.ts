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
 * ADMIN PHASE SCOPE:
 * - Company Setup
 * - Job Types
 * - Rules
 *
 * Other sections are intentionally present only to satisfy
 * IDataProvider and will be completed later.
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

  private toDbOwner(libraryType: any): DbOwner {
    const v = String(libraryType ?? '').toLowerCase().trim();
    if (v === 'company' || v === 'user') return 'company';
    return 'app';
  }

  private fromDbOwner(owner: DbOwner): LibraryType {
    return (owner === 'company' ? 'company' : 'app') as any;
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
     The remaining methods are
     intentionally stubbed for now
  ============================ */

  async listFolders(): Promise<Folder[]> {
    return [];
  }
  async createFolder(): Promise<Folder> {
    throw new Error('Not implemented');
  }
  async saveFolder(): Promise<Folder> {
    throw new Error('Not implemented');
  }
  async deleteFolder(): Promise<void> {}

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
