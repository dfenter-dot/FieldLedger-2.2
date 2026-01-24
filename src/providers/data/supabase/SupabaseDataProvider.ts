// src/providers/data/supabase/SupabaseDataProvider.ts

import type { IDataProvider, LibraryKind } from '../IDataProvider';
import type {
  AdminRule,
  Assembly,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from '../types';

import { supabase } from '../../../supabase/client';

type LibraryType = 'company' | 'personal';

export class SupabaseDataProvider implements IDataProvider {
  private async requireCompanyId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Not authenticated');

    const companyId = user.user_metadata?.company_id as string | undefined;
    if (!companyId) throw new Error('Missing company_id on user metadata');

    return companyId;
  }

  /* ----------------------------- folders ----------------------------- */

  async listFolders(args: {
    kind: LibraryKind;
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('company_id', companyId)
      .eq('kind', args.kind)
      .eq('library_type', args.libraryType)
      .eq('parent_id', args.parentId);

    if (error) throw error;
    return (data ?? []) as Folder[];
  }

  async createFolder(args: {
    kind: LibraryKind;
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.requireCompanyId();

    const payload = {
      company_id: companyId,
      kind: args.kind,
      library_type: args.libraryType,
      parent_id: args.parentId,
      name: args.name,
    };

    const { data, error } = await supabase
      .from('folders')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Folder;
  }

  /* ---------------------------- materials ---------------------------- */

  async listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('library_type', args.libraryType)
      .eq('folder_id', args.folderId);

    if (error) throw error;
    return (data ?? []) as Material[];
  }

  async getMaterial(id: string): Promise<Material | null> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    // PostgREST "No rows found" commonly surfaces as an error; treat as null.
    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;

    return (data ?? null) as Material | null;
  }

  async upsertMaterial(m: Material): Promise<Material> {
    const companyId = await this.requireCompanyId();

    const id = m.id ?? nanoid();
    const payload = {
      ...m,
      id,
      company_id: companyId,
      folder_id: m.folderId,
      library_type: m.libraryType,
    };

    const { data, error } = await supabase
      .from('materials')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Material;
  }

  async deleteMaterial(id: string): Promise<void> {
    const companyId = await this.requireCompanyId();

    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) throw error;
  }

  /* ---------------------------- assemblies --------------------------- */

  async getAssembly(id: string): Promise<Assembly | null> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;

    return (data ?? null) as Assembly | null;
  }

  async listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('library_type', args.libraryType)
      .eq('folder_id', args.folderId);

    if (error) throw error;
    return (data ?? []) as Assembly[];
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    const companyId = await this.requireCompanyId();

    const id = a.id ?? nanoid();
    const payload = {
      ...a,
      id,
      company_id: companyId,
      folder_id: a.folderId,
      library_type: a.libraryType,
    };

    const { data, error } = await supabase
      .from('assemblies')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Assembly;
  }

  async deleteAssembly(id: string): Promise<void> {
    const companyId = await this.requireCompanyId();

    const { error } = await supabase
      .from('assemblies')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) throw error;
  }

  /* ----------------------------- estimates --------------------------- */

  async listEstimates(): Promise<Estimate[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Estimate[];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();

    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;

    return (data ?? null) as Estimate | null;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    const companyId = await this.requireCompanyId();

    const id = e.id ?? nanoid();
    const payload = { ...e, id, company_id: companyId };

    const { data, error } = await supabase
      .from('estimates')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Estimate;
  }

  async deleteEstimate(id: string): Promise<void> {
    const companyId = await this.requireCompanyId();

    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) throw error;
  }

  /* ----------------------------- job types ---------------------------- */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data ?? []) as JobType[];
  }

  async upsertJobType(jt: JobType): Promise<JobType> {
    const companyId = await this.requireCompanyId();

    const id = jt.id ?? nanoid();
    const payload = { ...jt, id, company_id: companyId };

    const { data, error } = await supabase
      .from('job_types')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as JobType;
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.requireCompanyId();

    const { error } = await supabase.rpc('set_default_job_type', {
      p_company_id: companyId,
      p_job_type_id: jobTypeId,
    });

    if (error) throw error;
  }

  /* --------------------- branding / company / csv --------------------- */

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && (error as any).code === 'PGRST116') {
      return { companyName: '', logoUrl: '', primaryColor: '#000000' };
    }
    if (error) throw error;

    return data as BrandingSettings;
  }

  async saveBrandingSettings(s: BrandingSettings): Promise<BrandingSettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('branding_settings')
      .upsert({ ...s, company_id: companyId })
      .select('*')
      .single();

    if (error) throw error;
    return data as BrandingSettings;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && (error as any).code === 'PGRST116') {
      return { name: '', address: '', phone: '', email: '' };
    }
    if (error) throw error;

    return data as CompanySettings;
  }

  async saveCompanySettings(s: CompanySettings): Promise<CompanySettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('company_settings')
      .upsert({ ...s, company_id: companyId })
      .select('*')
      .single();

    if (error) throw error;
    return data as CompanySettings;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && (error as any).code === 'PGRST116') {
      return { includeHeaders: true, decimalSeparator: '.' };
    }
    if (error) throw error;

    return data as CsvSettings;
  }

  async saveCsvSettings(s: CsvSettings): Promise<CsvSettings> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('csv_settings')
      .upsert({ ...s, company_id: companyId })
      .select('*')
      .single();

    if (error) throw error;
    return data as CsvSettings;
  }

  /* ----------------------------- admin rules -------------------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data ?? []) as AdminRule[];
  }

  async upsertAdminRule(r: AdminRule): Promise<AdminRule> {
    const companyId = await this.requireCompanyId();

    const id = r.id ?? nanoid();
    const payload = { ...r, id, company_id: companyId };

    const { data, error } = await supabase
      .from('admin_rules')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as AdminRule;
  }

  async deleteAdminRule(id: string): Promise<void> {
    const companyId = await this.requireCompanyId();

    const { error } = await supabase
      .from('admin_rules')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id);

    if (error) throw error;
  }
}
