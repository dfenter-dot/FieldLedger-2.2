import { nanoid } from 'nanoid';
import { supabase } from '../../supabaseClient';
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
import type { IDataProvider, LibraryKind } from '../IDataProvider';

const assert = (error: unknown) => {
  if (error) {
    console.error(error);
    throw error;
  }
};

export class SupabaseDataProvider implements IDataProvider {
  /* ----------------------------- helpers ----------------------------- */

  private async companyId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    assert(error);
    if (!user) throw new Error('Not authenticated');
    return user.user_metadata.company_id;
  }

  /* ----------------------------- folders ----------------------------- */

  async listFolders(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
  }): Promise<Folder[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('company_id', companyId)
      .eq('kind', args.kind)
      .eq('library_type', args.libraryType)
      .eq('parent_id', args.parentId);
    assert(error);
    return data ?? [];
  }

  async createFolder(args: {
    kind: LibraryKind;
    libraryType: 'company' | 'personal';
    parentId: string | null;
    name: string;
  }): Promise<Folder> {
    const companyId = await this.companyId();
    const folder: Folder = {
      id: nanoid(),
      name: args.name,
      kind: args.kind,
      libraryType: args.libraryType,
      parentId: args.parentId,
    };
    const { error } = await supabase.from('folders').insert({
      id: folder.id,
      company_id: companyId,
      name: folder.name,
      kind: folder.kind,
      library_type: folder.libraryType,
      parent_id: folder.parentId,
    });
    assert(error);
    return folder;
  }

  /* ---------------------------- materials ---------------------------- */

  async listMaterials(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Material[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('library_type', args.libraryType)
      .eq('folder_id', args.folderId);
    assert(error);
    return data ?? [];
  }

  async getMaterial(id: string): Promise<Material | null> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return data ?? null;
  }

  async upsertMaterial(m: Material): Promise<Material> {
    const companyId = await this.companyId();
    const id = m.id ?? nanoid();
    const { error } = await supabase.from('materials').upsert({
      ...m,
      id,
      company_id: companyId,
      folder_id: m.folderId,
      library_type: m.libraryType,
    });
    assert(error);
    return { ...m, id };
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    assert(error);
  }

  /* ---------------------------- assemblies --------------------------- */

  async getAssembly(id: string): Promise<Assembly | null> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return data ?? null;
  }

  async listAssemblies(args: {
    libraryType: 'company' | 'personal';
    folderId: string | null;
  }): Promise<Assembly[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('library_type', args.libraryType)
      .eq('folder_id', args.folderId);
    assert(error);
    return data ?? [];
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    const companyId = await this.companyId();
    const id = a.id ?? nanoid();
    const { error } = await supabase.from('assemblies').upsert({
      ...a,
      id,
      company_id: companyId,
      folder_id: a.folderId,
      library_type: a.libraryType,
    });
    assert(error);
    return { ...a, id };
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error } = await supabase.from('assemblies').delete().eq('id', id);
    assert(error);
  }

  /* ----------------------------- estimates --------------------------- */

  async listEstimates(): Promise<Estimate[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    assert(error);
    return data ?? [];
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return data ?? null;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    const companyId = await this.companyId();
    const id = e.id ?? nanoid();
    const { error } = await supabase.from('estimates').upsert({
      ...e,
      id,
      company_id: companyId,
    });
    assert(error);
    return { ...e, id };
  }

  async deleteEstimate(id: string): Promise<void> {
    const { error } = await supabase.from('estimates').delete().eq('id', id);
    assert(error);
  }

  /* ----------------------------- job types ---------------------------- */

  async listJobTypes(): Promise<JobType[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId);
    assert(error);
    return data ?? [];
  }

  async upsertJobType(jt: JobType): Promise<JobType> {
    const companyId = await this.companyId();
    const id = jt.id ?? nanoid();
    const { error } = await supabase.from('job_types').upsert({
      ...jt,
      id,
      company_id: companyId,
    });
    assert(error);
    return { ...jt, id };
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.companyId();
    const { error } = await supabase.rpc('set_default_job_type', {
      p_company_id: companyId,
      p_job_type_id: jobTypeId,
    });
    assert(error);
  }

  /* --------------------- branding / company / csv --------------------- */

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return (
      data ?? {
        companyName: '',
        logoUrl: '',
        primaryColor: '#000000',
      }
    );
  }

  async saveBrandingSettings(s: BrandingSettings): Promise<BrandingSettings> {
    const companyId = await this.companyId();
    const { error } = await supabase.from('branding_settings').upsert({
      ...s,
      company_id: companyId,
    });
    assert(error);
    return s;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return (
      data ?? {
        name: '',
        address: '',
        phone: '',
        email: '',
      }
    );
  }

  async saveCompanySettings(s: CompanySettings): Promise<CompanySettings> {
    const companyId = await this.companyId();
    const { error } = await supabase.from('company_settings').upsert({
      ...s,
      company_id: companyId,
    });
    assert(error);
    return s;
  }

  async getCsvSettings(): Promise<CsvSettings> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();
    if (error && error.code !== 'PGRST116') assert(error);
    return (
      data ?? {
        includeHeaders: true,
        decimalSeparator: '.',
      }
    );
  }

  async saveCsvSettings(s: CsvSettings): Promise<CsvSettings> {
    const companyId = await this.companyId();
    const { error } = await supabase.from('csv_settings').upsert({
      ...s,
      company_id: companyId,
    });
    assert(error);
    return s;
  }

  /* ----------------------------- admin rules -------------------------- */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.companyId();
    const { data, error } = await supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId);
    assert(error);
    return data ?? [];
  }

  async upsertAdminRule(r: AdminRule): Promise<AdminRule> {
    const companyId = await this.companyId();
    const id = r.id ?? nanoid();
    const { error } = await supabase.from('admin_rules').upsert({
      ...r,
      id,
      company_id: companyId,
    });
    assert(error);
    return { ...r, id };
  }

  async deleteAdminRule(id: string): Promise<void> {
    const { error } = await supabase.from('admin_rules').delete().eq('id', id);
    assert(error);
  }
}
