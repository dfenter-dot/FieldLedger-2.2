import { SupabaseClient } from '@supabase/supabase-js';
import { IDataProvider } from '../IDataProvider';
import {
  AdminRule,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  JobType,
} from '../types';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  /* =========================
     Company / Context
     ========================= */

  async getCurrentCompanyId(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('company_id')
      .single();

    if (error) {
      console.error('getCurrentCompanyId error', error);
      return null;
    }

    return data?.company_id ?? null;
  }

  /* =========================
     Company Settings
     ========================= */

  async getCompanySettings(): Promise<CompanySettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('getCompanySettings error', error);
      return null;
    }

    return data ?? null;
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = {
      ...settings,
      company_id: companyId,
    };

    const { error } = await this.supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) {
      console.error('saveCompanySettings error', error);
    }
  }

  /* =========================
     Job Types
     ========================= */

  async getJobTypes(): Promise<JobType[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('getJobTypes error', error);
      return [];
    }

    return data ?? [];
  }

  async saveJobType(jobType: Partial<JobType>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = {
      ...jobType,
      company_id: companyId,
    };

    const { error } = await this.supabase
      .from('job_types')
      .upsert(payload);

    if (error) {
      console.error('saveJobType error', error);
    }
  }

  // Admin UI compatibility aliases
  async listJobTypes(): Promise<JobType[]> {
    return this.getJobTypes();
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<void> {
    return this.saveJobType(jobType);
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    // Clear existing default
    await this.supabase
      .from('job_types')
      .update({ is_default: false })
      .eq('company_id', companyId);

    // Set new default
    const { error } = await this.supabase
      .from('job_types')
      .update({ is_default: true })
      .eq('id', jobTypeId)
      .eq('company_id', companyId);

    if (error) {
      console.error('setDefaultJobType error', error);
    }
  }

  /* =========================
     Admin Rules
     ========================= */

  async listAdminRules(): Promise<AdminRule[]> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return [];

    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at');

    if (error) {
      console.error('listAdminRules error', error);
      return [];
    }

    return data ?? [];
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = {
      ...rule,
      company_id: companyId,
    };

    const { error } = await this.supabase
      .from('admin_rules')
      .upsert(payload);

    if (error) {
      console.error('saveAdminRule error', error);
    }
  }

  async deleteAdminRule(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('admin_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      console.error('deleteAdminRule error', error);
    }
  }

  /* =========================
     CSV Settings
     ========================= */

  async getCsvSettings(): Promise<CsvSettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('getCsvSettings error', error);
      return null;
    }

    return data ?? null;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = {
      ...settings,
      company_id: companyId,
    };

    const { error } = await this.supabase
      .from('csv_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) {
      console.error('saveCsvSettings error', error);
    }
  }

  /* =========================
     Branding Settings
     ========================= */

  async getBrandingSettings(): Promise<BrandingSettings | null> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('getBrandingSettings error', error);
      return null;
    }

    return data ?? null;
  }

  async saveBrandingSettings(
    settings: Partial<BrandingSettings>
  ): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const payload = {
      ...settings,
      company_id: companyId,
    };

    const { error } = await this.supabase
      .from('branding_settings')
      .upsert(payload, { onConflict: 'company_id' });

    if (error) {
      console.error('saveBrandingSettings error', error);
    }
  }
}
