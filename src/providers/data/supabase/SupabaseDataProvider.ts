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
  AppMaterialOverride,
} from '../types';
import { IDataProvider } from '../IDataProvider';
import { seedCompanySettings } from '../local/seed';

/**
 * SupabaseDataProvider
 *
 * DB enums:
 * - owner: 'app' | 'company'
 * - library_type: 'materials' | 'assemblies'
 *
 * IMPORTANT DB NOTES:
 * - Assemblies table uses `owner`, not `owner_type`
 * - Uses `customer_supplies_materials` (plural supplies)
 * - RLS must allow insert/select/update/delete for company-owned rows
 */

export class SupabaseDataProvider implements IDataProvider {
  constructor(
    private supabase: SupabaseClient,
    private companyId: string,
  ) {}

  /* -----------------------------------------------------
   * Helpers
   * --------------------------------------------------- */

  private async requireUser() {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();
    if (error || !user) throw error ?? new Error('Not authenticated');
    return user;
  }

  /* -----------------------------------------------------
   * Company / Settings
   * --------------------------------------------------- */

  async getCompanySettings(): Promise<CompanySettings> {
    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', this.companyId)
      .single();

    if (error && error.code === 'PGRST116') {
      return seedCompanySettings(this.companyId);
    }
    if (error) throw error;
    return data;
  }

  async updateCompanySettings(settings: CompanySettings): Promise<void> {
    const { error } = await this.supabase
      .from('company_settings')
      .upsert(settings, { onConflict: 'company_id' });
    if (error) throw error;
  }

  async getBrandingSettings(): Promise<BrandingSettings | null> {
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', this.companyId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateBrandingSettings(settings: BrandingSettings): Promise<void> {
    const { error } = await this.supabase
      .from('branding_settings')
      .upsert(settings, { onConflict: 'company_id' });
    if (error) throw error;
  }

  async getCsvSettings(): Promise<CsvSettings | null> {
    const { data, error } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', this.companyId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateCsvSettings(settings: CsvSettings): Promise<void> {
    const { error } = await this.supabase
      .from('csv_settings')
      .upsert(settings, { onConflict: 'company_id' });
    if (error) throw error;
  }

  /* -----------------------------------------------------
   * Folders (Materials + Assemblies)
   * --------------------------------------------------- */

  async getFolders(library: LibraryType): Promise<Folder[]> {
    const { data, error } = await this.supabase
      .from('folders')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('library_type', library)
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async createFolder(folder: Partial<Folder>): Promise<Folder> {
    const { data, error } = await this.supabase
      .from('folders')
      .insert({
        ...folder,
        company_id: this.companyId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateFolder(folder: Folder): Promise<void> {
    const { error } = await this.supabase
      .from('folders')
      .update(folder)
      .eq('id', folder.id);
    if (error) throw error;
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  /* -----------------------------------------------------
   * Assemblies
   * --------------------------------------------------- */

  async getAssemblies(library: LibraryType): Promise<Assembly[]> {
    const { data, error } = await this.supabase
      .from('assemblies')
      .select(
        `
        *,
        items:assembly_items(*)
      `,
      )
      .eq('company_id', this.companyId)
      .eq('library_type', library)
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async getAssembly(id: string): Promise<Assembly> {
    const { data, error } = await this.supabase
      .from('assemblies')
      .select(
        `
        *,
        items:assembly_items(*)
      `,
      )
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async createAssembly(
    assembly: Partial<Assembly>,
  ): Promise<Assembly> {
    const { data, error } = await this.supabase
      .from('assemblies')
      .insert({
        ...assembly,
        company_id: this.companyId,
        owner: 'company',
        library_type: 'assemblies',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAssembly(assembly: Assembly): Promise<void> {
    const { error } = await this.supabase
      .from('assemblies')
      .update(assembly)
      .eq('id', assembly.id);
    if (error) throw error;
  }

  async deleteAssembly(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('assemblies')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /* -----------------------------------------------------
   * Assembly Items
   * --------------------------------------------------- */

  async createAssemblyItem(item: any): Promise<void> {
    const { error } = await this.supabase
      .from('assembly_items')
      .insert(item);
    if (error) throw error;
  }

  async updateAssemblyItem(item: any): Promise<void> {
    const { error } = await this.supabase
      .from('assembly_items')
      .update(item)
      .eq('id', item.id);
    if (error) throw error;
  }

  async deleteAssemblyItem(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('assembly_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /* -----------------------------------------------------
   * Materials (existing, unchanged)
   * --------------------------------------------------- */

  async getMaterials(library: LibraryType): Promise<Material[]> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('library_type', library)
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async createMaterial(material: Partial<Material>): Promise<Material> {
    const { data, error } = await this.supabase
      .from('materials')
      .insert({
        ...material,
        company_id: this.companyId,
        owner: 'company',
        library_type: 'materials',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateMaterial(material: Material): Promise<void> {
    const { error } = await this.supabase
      .from('materials')
      .update(material)
      .eq('id', material.id);
    if (error) throw error;
  }

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('materials')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /* -----------------------------------------------------
   * Admin / Rules / Job Types
   * --------------------------------------------------- */

  async getJobTypes(): Promise<JobType[]> {
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .order('priority');
    if (error) throw error;
    return data;
  }

  async getAdminRules(): Promise<AdminRule[]> {
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .order('priority');
    if (error) throw error;
    return data;
  }

  /* -----------------------------------------------------
   * Estimates (unchanged)
   * --------------------------------------------------- */

  async getEstimates(): Promise<Estimate[]> {
    const { data, error } = await this.supabase
      .from('estimates')
      .select('*')
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
