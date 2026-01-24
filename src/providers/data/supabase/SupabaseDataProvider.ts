import { SupabaseClient } from '@supabase/supabase-js';
import {
  Assembly,
  CompanySettings,
  Estimate,
  Folder,
  JobType,
  Material,
} from '../types';
import { IDataProvider } from '../IDataProvider';

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

  // Compatibility alias (older UI code expects this)
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

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.currentCompanyId();

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data;
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
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
}
