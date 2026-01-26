import { SupabaseClient } from '@supabase/supabase-js';
import {
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
} from '../types';
import { IDataProvider } from '../IDataProvider';
import { seedCompanySettings } from '../local/seed';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  /* -------------------------------------------------------
   * Helpers
   * ----------------------------------------------------- */

  private async currentUserId(): Promise<string | null> {
    const { data } = await this.supabase.auth.getUser();
    return data?.user?.id ?? null;
  }

  async getCurrentCompanyId(): Promise<string | null> {
    const userId = await this.currentUserId();
    if (!userId) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('getCurrentCompanyId error', error);
      return null;
    }

    return (data?.company_id as string | null) ?? null;
  }

  /* -------------------------------------------------------
   * Company Settings (Fix A: auto-create default row)
   * ----------------------------------------------------- */

  async getCompanySettings(): Promise<CompanySettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    // Try to read existing row (maybeSingle avoids 406 when none exists)
    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('getCompanySettings error', error);
      return null;
    }

    // If missing, create seeded defaults (Fix A)
    if (!data) {
      const seed = seedCompanySettings(companyId) as any;

      const { error: upsertErr } = await this.supabase
        .from('company_settings')
        .upsert(seed, { onConflict: 'company_id' });

      if (upsertErr) {
        console.error('getCompanySettings seed upsert error', upsertErr);
        return null;
      }

      const { data: created, error: readErr } = await this.supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (readErr) {
        console.error('getCompanySettings read after seed error', readErr);
        return null;
      }

      return (created as any) ?? null;
    }

    return data as any;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...settings, company_id: companyId } as any;

    const { error } = await this.supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) console.error('saveCompanySettings error', error);
  }

  /* -------------------------------------------------------
   * Branding Settings
   * ----------------------------------------------------- */

  async getBrandingSettings(): Promise<BrandingSettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('getBrandingSettings error', error);
      return null;
    }

    return (data as any) ?? null;
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...settings, company_id: companyId } as any;

    const { error } = await this.supabase
      .from('branding_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) console.error('saveBrandingSettings error', error);
  }

  /* -------------------------------------------------------
   * CSV Settings
   * ----------------------------------------------------- */

  async getCsvSettings(): Promise<CsvSettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('getCsvSettings error', error);
      return null;
    }

    return (data as any) ?? null;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...settings, company_id: companyId } as any;

    const { error } = await this.supabase
      .from('csv_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) console.error('saveCsvSettings error', error);
  }

  /* -------------------------------------------------------
   * Job Types
   * ----------------------------------------------------- */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('listJobTypes error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...jobType, company_id: companyId } as any;
    const { error } = await this.supabase.from('job_types').upsert(payload);

    if (error) console.error('upsertJobType error', error);
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    await this.supabase
      .from('job_types')
      .update({ is_default: false })
      .eq('company_id', companyId);

    const { error } = await this.supabase
      .from('job_types')
      .update({ is_default: true })
      .eq('company_id', companyId)
      .eq('id', jobTypeId);

    if (error) console.error('setDefaultJobType error', error);
  }

  /* -------------------------------------------------------
   * Admin Rules
   * ----------------------------------------------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('listAdminRules error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async upsertAdminRule(rule: Partial<AdminRule>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...rule, company_id: companyId } as any;
    const { error } = await this.supabase.from('admin_rules').upsert(payload);

    if (error) console.error('upsertAdminRule error', error);
  }

  async deleteAdminRule(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('admin_rules')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) console.error('deleteAdminRule error', error);
  }

  /* -------------------------------------------------------
   * Folders
   * ----------------------------------------------------- */

  async listFolders(type: LibraryType): Promise<Folder[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('folders')
      .select('*')
      .eq('company_id', companyId)
      .eq('type', type)
      .order('name');

    if (error) {
      console.error('listFolders error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async upsertFolder(folder: Partial<Folder>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...folder, company_id: companyId } as any;
    const { error } = await this.supabase.from('folders').upsert(payload);

    if (error) console.error('upsertFolder error', error);
  }

  async deleteFolder(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('folders')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) console.error('deleteFolder error', error);
  }

  /* -------------------------------------------------------
   * Materials
   * ----------------------------------------------------- */

  async listMaterials(type: LibraryType): Promise<Material[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('library', type)
      .order('name');

    if (error) {
      console.error('listMaterials error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async getMaterial(id: string): Promise<Material | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('getMaterial error', error);
      return null;
    }

    return (data as any) ?? null;
  }

  async upsertMaterial(material: Partial<Material>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...material, company_id: companyId } as any;
    const { error } = await this.supabase.from('materials').upsert(payload);

    if (error) console.error('upsertMaterial error', error);
  }

  async deleteMaterial(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('materials')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) console.error('deleteMaterial error', error);
  }

  /* -------------------------------------------------------
   * Assemblies
   * ----------------------------------------------------- */

  async listAssemblies(type: LibraryType): Promise<Assembly[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('library', type)
      .order('name');

    if (error) {
      console.error('listAssemblies error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async getAssembly(id: string): Promise<Assembly | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('getAssembly error', error);
      return null;
    }

    return (data as any) ?? null;
  }

  async upsertAssembly(assembly: Partial<Assembly>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...assembly, company_id: companyId } as any;
    const { error } = await this.supabase.from('assemblies').upsert(payload);

    if (error) console.error('upsertAssembly error', error);
  }

  async deleteAssembly(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('assemblies')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) console.error('deleteAssembly error', error);
  }

  /* -------------------------------------------------------
   * Estimates
   * ----------------------------------------------------- */

  async listEstimates(): Promise<Estimate[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('listEstimates error', error);
      return [];
    }

    return (data as any) ?? [];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('getEstimate error', error);
      return null;
    }

    return (data as any) ?? null;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = { ...estimate, company_id: companyId } as any;
    const { error } = await this.supabase.from('estimates').upsert(payload);

    if (error) console.error('upsertEstimate error', error);
  }

  async deleteEstimate(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('estimates')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) console.error('deleteEstimate error', error);
  }
}
