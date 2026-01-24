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
  private companyIdCache: string | null = null;

  private async getCompanyId(): Promise<string> {
    if (this.companyIdCache) return this.companyIdCache;

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) throw new Error('Not authenticated');

    // profiles table is already part of your app + RLS model
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    if (!profile?.company_id) throw new Error('Profile is missing company_id');

    this.companyIdCache = profile.company_id;
    return profile.company_id;
  }

  private applyLibraryFilter<T extends { company_id: string | null }>(
    query: any,
    libraryType: LibraryType
  ) {
    // Company library = scoped to current company_id
    // Personal library = company_id is null (app’s existing convention)
    if (libraryType === 'company') {
      return query.eq('company_id', this.companyIdCache);
    }
    return query.is('company_id', null);
  }

  /* ---------------- Folders ---------------- */

  async listFolders(args: {
    kind: LibraryKind;
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.getCompanyId();

    let q = supabase
      .from('folders')
      .select('*')
      .eq('kind', args.kind)
      .eq('library_type', args.libraryType)
      .order('name', { ascending: true });

    // parent_id: null vs value
    q = args.parentId === null ? q.is('parent_id', null) : q.eq('parent_id', args.parentId);

    // company_id filter depends on library type
    if (args.libraryType === 'company') q = q.eq('company_id', companyId);
    else q = q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Folder[];
  }

  async createFolder(args: {
    kind: LibraryKind;
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.getCompanyId();

    const payload: Partial<Folder> = {
      name: args.name,
      parent_id: args.parentId,
      kind: args.kind,
      library_type: args.libraryType,
      company_id: args.libraryType === 'company' ? companyId : null,
    };

    const { data, error } = await supabase.from('folders').insert(payload).select('*').single();
    if (error) throw error;
    return data as Folder;
  }

  /* ---------------- Materials ---------------- */

  async listMaterials(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Material[]> {
    const companyId = await this.getCompanyId();

    let q = supabase.from('materials').select('*').order('name', { ascending: true });

    q = args.folderId === null ? q.is('folder_id', null) : q.eq('folder_id', args.folderId);

    if (args.libraryType === 'company') q = q.eq('company_id', companyId);
    else q = q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Material[];
  }

  async upsertMaterial(m: Material): Promise<Material> {
    const companyId = await this.getCompanyId();

    // Enforce company_id for company library items (personal stays null if that’s how your app uses it)
    const payload = {
      ...m,
      company_id: m.company_id ?? companyId,
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
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------------- Assemblies ---------------- */

  async listAssemblies(args: {
    libraryType: LibraryType;
    folderId: string | null;
  }): Promise<Assembly[]> {
    const companyId = await this.getCompanyId();

    let q = supabase.from('assemblies').select('*').order('name', { ascending: true });

    q = args.folderId === null ? q.is('folder_id', null) : q.eq('folder_id', args.folderId);

    if (args.libraryType === 'company') q = q.eq('company_id', companyId);
    else q = q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Assembly[];
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    const companyId = await this.getCompanyId();

    const payload = {
      ...a,
      company_id: a.company_id ?? companyId,
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
    const { error } = await supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------------- Estimates ---------------- */

  async listEstimates(): Promise<Estimate[]> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('estimate_number', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Estimate[];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const { data, error } = await supabase.from('estimates').select('*').eq('id', id).single();
    if (error) return null;
    return data as Estimate;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    const companyId = await this.getCompanyId();

    const payload = {
      ...e,
      company_id: e.company_id ?? companyId,
    };

    const { data, error } = await supabase
      .from('estimates')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Estimate;
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------------- Job Types ---------------- */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as JobType[];
  }

  async upsertJobType(jt: JobType): Promise<JobType> {
    const companyId = await this.getCompanyId();

    const payload = {
      ...jt,
      company_id: jt.company_id ?? companyId,
    };

    const { data, error } = await supabase
      .from('job_types')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as JobType;
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.getCompanyId();

    // Clear existing defaults for this company, then set the chosen one.
    const { error: clearErr } = await supabase
      .from('job_types')
      .update({ is_default: false })
      .eq('company_id', companyId);

    if (clearErr) throw clearErr;

    const { error: setErr } = await supabase
      .from('job_types')
      .update({ is_default: true })
      .eq('id', jobTypeId)
      .eq('company_id', companyId);

    if (setErr) throw setErr;
  }

  /* ---------------- Branding / Company / CSV ---------------- */

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data as BrandingSettings;
  }

  async saveBrandingSettings(s: BrandingSettings): Promise<BrandingSettings> {
    const companyId = await this.getCompanyId();

    const payload = { ...s, company_id: companyId };

    const { data, error } = await supabase
      .from('branding_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as BrandingSettings;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data as CompanySettings;
  }

  async saveCompanySettings(s: CompanySettings): Promise<CompanySettings> {
    const companyId = await this.getCompanyId();

    const payload = { ...s, company_id: companyId };

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CompanySettings;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data as CsvSettings;
  }

  async saveCsvSettings(s: CsvSettings): Promise<CsvSettings> {
    const companyId = await this.getCompanyId();

    const payload = { ...s, company_id: companyId };

    const { data, error } = await supabase
      .from('csv_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CsvSettings;
  }

  /* ---------------- Admin Rules ---------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AdminRule[];
  }

  async upsertAdminRule(r: AdminRule): Promise<AdminRule> {
    const companyId = await this.getCompanyId();

    const payload = { ...r, company_id: r.company_id ?? companyId };

    const { data, error } = await supabase
      .from('admin_rules')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as AdminRule;
  }

  async deleteAdminRule(id: string): Promise<void> {
    const { error } = await supabase.from('admin_rules').delete().eq('id', id);
    if (error) throw error;
  }
}
