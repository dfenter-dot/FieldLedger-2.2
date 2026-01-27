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

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* Folders                                                            */
  /* ------------------------------------------------------------------ */

  async getFolders(kind: 'materials' | 'assemblies'): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('folders')
      .select('*')
      .eq('kind', kind)
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('order_index');

    if (error) throw error;
    return data ?? [];
  }

  // Newer library API used across the UI
  async listFolders(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.currentCompanyId();
    let q = this.supabase
      .from('folders')
      .select('*')
      .eq('kind', args.kind)
      .eq('library_type', args.libraryType)
      .order('order_index');

    q = args.parentId ? q.eq('parent_id', args.parentId) : q.is('parent_id', null);
    q = args.libraryType === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any;
  }

  async createFolder(args: {
    kind: 'materials' | 'assemblies';
    libraryType: LibraryType;
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.currentCompanyId();
    const payload: Partial<Folder> = {
      id: crypto.randomUUID?.() ?? `folder_${Date.now()}`,
      kind: args.kind,
      library_type: args.libraryType,
      name: args.name,
      parent_id: args.parentId,
      order_index: 0,
      company_id: args.libraryType === 'company' ? companyId : null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('folders')
      .insert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  async saveFolder(folder: Partial<Folder>): Promise<Folder> {
    const companyId = await this.currentCompanyId();

    const payload = {
      ...folder,
      company_id: folder.company_id ?? companyId,
    };

    const { data, error } = await this.supabase
      .from('folders')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Materials                                                          */
  /* ------------------------------------------------------------------ */

  async getMaterials(): Promise<Material[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('order_index');

    if (error) throw error;
    return data ?? [];
  }

  async listMaterials(args: { libraryType: LibraryType; folderId: string | null }): Promise<Material[]> {
    const companyId = await this.currentCompanyId();

    let q = this.supabase
      .from('materials')
      .select('*')
      .order('order_index');

    q = args.libraryType === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getMaterial(id: string): Promise<Material> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Material not found');
    if (data.company_id && data.company_id !== companyId) throw new Error('Material not found');
    return data as any;
  }

  async upsertMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...material,
      company_id: material.company_id ?? companyId,
    };

    if (material.company_id === null) (payload as any).company_id = null;

    const { data, error } = await this.supabase
      .from('materials')
      .upsert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  async saveMaterial(material: Partial<Material>): Promise<Material> {
    const companyId = await this.currentCompanyId();

    const payload = {
      ...material,
      company_id: material.company_id ?? companyId,
    };

    const { data, error } = await this.supabase
      .from('materials')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Assemblies                                                         */
  /* ------------------------------------------------------------------ */

  async getAssemblies(): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('order_index');

    if (error) throw error;
    return data ?? [];
  }

  async listAssemblies(args: { libraryType: LibraryType; folderId: string | null }): Promise<Assembly[]> {
    const companyId = await this.currentCompanyId();

    let q = this.supabase
      .from('assemblies')
      .select('*')
      .order('order_index');

    q = args.libraryType === 'company' ? q.eq('company_id', companyId) : q.is('company_id', null);
    q = args.folderId ? q.eq('folder_id', args.folderId) : q.is('folder_id', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any;
  }

  async getAssembly(id: string): Promise<Assembly> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('assemblies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Assembly not found');
    if (data.company_id && data.company_id !== companyId) throw new Error('Assembly not found');
    return data as any;
  }

  async upsertAssembly(assembly: Partial<Assembly>): Promise<Assembly> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...assembly,
      company_id: assembly.company_id ?? companyId,
    };
    if (assembly.company_id === null) (payload as any).company_id = null;

    const { data, error } = await this.supabase
      .from('assemblies')
      .upsert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  async saveAssembly(assembly: Partial<Assembly>): Promise<Assembly> {
    const companyId = await this.currentCompanyId();

    const payload = {
      ...assembly,
      company_id: assembly.company_id ?? companyId,
    };

    const { data, error } = await this.supabase
      .from('assemblies')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('assemblies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Estimates                                                          */
  /* ------------------------------------------------------------------ */

  // ✅ THIS is what your error is complaining about
  async listEstimates(): Promise<Estimate[]> {
    return this.getEstimates();
  }

  async getEstimates(): Promise<Estimate[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getEstimate(id: string): Promise<Estimate> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Estimate not found');
    return data as any;
  }

  async saveEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    const companyId = await this.currentCompanyId();

    const payload = {
      ...estimate,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('estimates')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async upsertEstimate(estimate: Partial<Estimate>): Promise<Estimate> {
    return this.saveEstimate(estimate);
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('estimates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /* ------------------------------------------------------------------ */
  /* Admin                                                              */
  /* ------------------------------------------------------------------ */

  async getJobTypes(): Promise<JobType[]> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async listJobTypes(): Promise<JobType[]> {
    return this.getJobTypes();
  }

  async saveJobType(jobType: Partial<JobType>): Promise<JobType> {
    const companyId = await this.currentCompanyId();

    const payload = {
      ...jobType,
      company_id: companyId,
    };

    const { data, error } = await this.supabase
      .from('job_types')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<JobType> {
    return this.saveJobType(jobType);
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.currentCompanyId();
    const { error: clearErr } = await this.supabase
      .from('job_types')
      .update({ is_default: false })
      .eq('company_id', companyId);
    if (clearErr) throw clearErr;

    const { error: setErr } = await this.supabase
      .from('job_types')
      .update({ is_default: true })
      .eq('company_id', companyId)
      .eq('id', jobTypeId);
    if (setErr) throw setErr;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as any;

    const payload = seedCompanySettings(companyId);
    const { data: created, error: createErr } = await this.supabase
      .from('company_settings')
      .insert(payload as any)
      .select()
      .single();

    if (createErr) throw createErr;
    return created as any;
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
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* Admin Rules                                                        */
  /* ------------------------------------------------------------------ */

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
  
// Compatibility wrapper for Admin Rules UI (Phase 1)
async getAdminRules(companyId: string): Promise<AdminRule[]> {
  // companyId param is accepted for compatibility
  return this.listAdminRules();
}

 async upsertAdminRule(companyIdOrRule: any, maybeRule?: any): Promise<AdminRule> {
  // Supports BOTH signatures:
  // upsertAdminRule(rule)
  // upsertAdminRule(companyId, rule)
  const rule = (maybeRule ?? companyIdOrRule) as Partial<AdminRule>;

  const companyId = await this.currentCompanyId();
  const payload = { ...rule, company_id: companyId };

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
  // Supports BOTH signatures:
  // deleteAdminRule(id)
  // deleteAdminRule(companyId, id)
  const id = (maybeId ?? companyIdOrId) as string;

  const { error } = await this.supabase
    .from('admin_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

  /* ------------------------------------------------------------------ */
  /* CSV Settings                                                       */
  /* ------------------------------------------------------------------ */

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as any;

    const payload = {
      company_id: companyId,
      allow_material_import: true,
      allow_assembly_import: true,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await this.supabase
      .from('csv_settings')
      .insert(payload as any)
      .select()
      .single();

    if (createErr) throw createErr;
    return created as any;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<CsvSettings> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.supabase
      .from('csv_settings')
      .upsert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }

  /* ------------------------------------------------------------------ */
  /* Branding Settings                                                  */
  /* ------------------------------------------------------------------ */

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as any;

    const payload = {
      company_id: companyId,
      primary_color: null,
      logo_url: null,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await this.supabase
      .from('branding_settings')
      .insert(payload as any)
      .select()
      .single();

    if (createErr) throw createErr;
    return created as any;
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const companyId = await this.currentCompanyId();
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('branding_settings')
      .upsert(payload as any)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  }
}
