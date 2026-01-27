import { SupabaseClient } from '@supabase/supabase-js';
import {
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
} from '../types';
import { IDataProvider } from '../IDataProvider';

export class SupabaseDataProvider implements IDataProvider {
  constructor(private supabase: SupabaseClient) {}

  /* =========================
     Company
     ========================= */

  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    const { data, error } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  }

  async upsertCompanySettings(
    companyId: string,
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CompanySettings;
  }

  /* =========================
     Job Types
     ========================= */

  async getJobTypes(companyId: string): Promise<JobType[]> {
    const { data, error } = await this.supabase
      .from('job_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) throw error;
    return (data ?? []) as JobType[];
  }

  async upsertJobType(
    companyId: string,
    jobType: Partial<JobType>
  ): Promise<JobType> {
    const payload = {
      ...jobType,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('job_types')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as JobType;
  }

  async deleteJobType(companyId: string, jobTypeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_types')
      .delete()
      .eq('company_id', companyId)
      .eq('id', jobTypeId);

    if (error) throw error;
  }

  /* =========================
     Admin Rules
     ========================= */

  async getAdminRules(companyId: string): Promise<AdminRule[]> {
    const { data, error } = await this.supabase
      .from('admin_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('priority');

    if (error) throw error;
    return (data ?? []) as AdminRule[];
  }

  async upsertAdminRule(
    companyId: string,
    rule: Partial<AdminRule>
  ): Promise<AdminRule> {
    const payload = {
      ...rule,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('admin_rules')
      .upsert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as AdminRule;
  }

  async deleteAdminRule(companyId: string, ruleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('admin_rules')
      .delete()
      .eq('company_id', companyId)
      .eq('id', ruleId);

    if (error) throw error;
  }

  /* =========================
     CSV Settings
     ========================= */

  async getCsvSettings(companyId: string): Promise<CsvSettings | null> {
    const { data, error } = await this.supabase
      .from('csv_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  }

  async upsertCsvSettings(
    companyId: string,
    settings: Partial<CsvSettings>
  ): Promise<CsvSettings> {
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('csv_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as CsvSettings;
  }

  /* =========================
     Branding
     ========================= */

  async getBrandingSettings(companyId: string): Promise<BrandingSettings | null> {
    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  }

  async upsertBrandingSettings(
    companyId: string,
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    const payload = {
      ...settings,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('branding_settings')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) throw error;
    return data as BrandingSettings;
  }
}
