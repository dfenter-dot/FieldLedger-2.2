import { nanoid } from 'nanoid';
import { supabase } from '../../../supabase/client';
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

type LibraryType = 'company' | 'personal';

export class SupabaseDataProvider implements IDataProvider {
  /* ----------------------------- helpers ----------------------------- */

  private async requireCompanyId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Not authenticated');

    const companyId = user.user_metadata?.company_id as string | undefined;
    if (!companyId) {
      throw new Error('Missing company_id on user metadata');
    }

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

    const { data, error } = await supabase
      .from('folders')
      .insert({
        id: nanoid(),
        company_id: companyId,
        kind: args.kind,
        library_type: args.libraryType,
        parent_id: args.parentId,
        name: args.name,
      })
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
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as Material | null;
  }

  async upsertMaterial(m: Material): Promise<Material> {
    const companyId = await this.requireCompanyId();
    const id = m.id ?? nanoid();

    const { data, error } = await supabase
      .from('materials')
      .upsert({
        ...m,
        id,
        company_id: companyId,
        folder_id: m.folderId,
        library_type: m.libraryType,
      })
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

  async getAssembly(id: string): Promise<Assembly | null> {
    const companyId = await this.requireCompanyId();

    const { data, error } = await supabase
      .from('assemblies')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as Assembly | null;
  }

  async upsertAssembly(a: Assembly): Promise<Assembly> {
    const companyId = await this.requireCompanyId();
    const id = a.id ?? nanoid();

    const { data, error } = await supabase
      .from('assemblies')
      .upsert({
        ...a,
        id,
        company_id: companyId,
        folder_id: a.folderId,
        library_type: a.libraryType,
      })
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
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as Estimate | null;
  }

  async upsertEstimate(e: Estimate): Promise<Estimate> {
    const companyId = await this.requireCompanyId();
    const id = e.id ?? nanoid();

    const { data, error } = await supabase
      .from('estimates')
      .upsert({
        ...e,
        id,
        company_id: companyId,
      })
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

    const { data, error } = await supabase
      .from('job_types')
      .upsert({
        ...jt,
        id,
        company_id: companyId,
      })
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
      .maybeSingle();

    if (error) throw error;

    return (
      (data as BrandingSettings) ?? {
        companyName: '',
        logoUrl: '',
        primaryColor: '#000000',
      }
    );
  }

  async saveBrandingSettings(
    s: BrandingSettings
  ): Promise<BrandingSettings> {
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
      .maybeSingle();

    if (error) throw error;

    return (
      (data as CompanySettings) ?? {
        name: '',
        address: '',
        phone: '',
        email: '',
      }
    );
  }

  async saveCompanySettings(
    s: CompanySettings
  ): Promise<CompanySettings> {
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
      .maybeSingle();

    if (error) throw error;

    return (
      (data as CsvSettings) ?? {
        includeHeaders: true,
        decimalSeparator: '.',
      }
    );
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

    const { data, error } = await supabase
      .from('admin_rules')
      .upsert({
        ...r,
        id,
        company_id: companyId,
      })
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
