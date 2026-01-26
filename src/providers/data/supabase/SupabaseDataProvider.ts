import { SupabaseClient } from '@supabase/supabase-js';
import { IDataProvider } from '../IDataProvider';
import type {
  AdminRule,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  JobType,
} from '../types';

function isNoRows(err: any) {
  return err?.code === 'PGRST116';
}

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
     Company Settings (Company Setup page)
     ========================= */

  private defaultCompanySettings(companyId: string): Partial<CompanySettings> {
    // Keep defaults conservative; JSON fields can be empty arrays.
    return {
      company_id: companyId,

      workdays_per_week: 5,
      work_hours_per_day: 8,
      technicians: 1,

      vacation_days_per_year: 0,
      sick_days_per_year: 0,

      material_purchase_tax_percent: 0,
      misc_material_percent: 0,
      default_discount_percent: 0,
      processing_fee_percent: 0,

      min_billable_labor_minutes_per_job: 0,
      estimate_validity_days: 30,
      starting_estimate_number: 1000,

      material_markup_tiers: [],
      misc_applies_when_customer_supplies: false,

      technician_wages: [],

      business_expenses_mode: 'lump',
      business_expenses_lump_sum_monthly: 0,
      business_expenses_itemized: [],
      business_apply_itemized: false,

      personal_expenses_mode: 'lump',
      personal_expenses_lump_sum_monthly: 0,
      personal_expenses_itemized: [],
      personal_apply_itemized: false,

      net_profit_goal_mode: 'percent',
      net_profit_goal_amount_monthly: 0,
      net_profit_goal_percent_of_revenue: 0,
      revenue_goal_monthly: 0,
    } as any;
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) throw new Error('No company selected for this user.');

    // Try company_settings first
    {
      const { data, error } = await this.supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (data) return data as any;

      if (error && !isNoRows(error)) {
        console.error('getCompanySettings error', error);
        throw error;
      }
    }

    // Fallback: some builds used company_setup
    {
      const { data, error } = await this.supabase
        .from('company_setup')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (data) return data as any;

      if (error && !isNoRows(error)) {
        console.error('getCompanySettings fallback(company_setup) error', error);
        // don't throw yet; we can still create in company_settings
      }
    }

    // Create default row in company_settings
    const createPayload = this.defaultCompanySettings(companyId);

    const { error: upErr } = await this.supabase
      .from('company_settings')
      .upsert(createPayload as any, { onConflict: 'company_id' });

    if (upErr) {
      console.error('getCompanySettings create default error', upErr);
      throw upErr;
    }

    const { data: created, error: readErr } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (readErr) {
      console.error('getCompanySettings read-after-create error', readErr);
      throw readErr;
    }

    return created as any;
  }

  async saveCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) throw new Error('No company selected for this user.');

    const payload = { ...settings, company_id: companyId };

    const { error } = await this.supabase
      .from('company_settings')
      .upsert(payload as any, { onConflict: 'company_id' });

    if (error) {
      console.error('saveCompanySettings error', error);
      throw error;
    }

    const { data, error: readErr } = await this.supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (readErr) {
      console.error('saveCompanySettings read-back error', readErr);
      throw readErr;
    }

    return data as any;
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

    return (data ?? []) as any;
  }

  async saveJobType(jobType: Partial<JobType>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('job_types')
      .upsert({ ...jobType, company_id: companyId } as any);

    if (error) console.error('saveJobType error', error);
  }

  async listJobTypes(): Promise<JobType[]> {
    return this.getJobTypes();
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<void> {
    return this.saveJobType(jobType);
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
      .eq('id', jobTypeId)
      .eq('company_id', companyId);

    if (error) console.error('setDefaultJobType error', error);
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

    return (data ?? []) as any;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('admin_rules')
      .upsert({ ...rule, company_id: companyId } as any);

    if (error) console.error('saveAdminRule error', error);
  }

  async deleteAdminRule(id: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('admin_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) console.error('deleteAdminRule error', error);
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

    if (error && !isNoRows(error)) {
      console.error('getCsvSettings error', error);
      return null;
    }

    return (data ?? null) as any;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) return;

    const { error } = await this.supabase
      .from('csv_settings')
      .upsert({ ...settings, company_id: companyId } as any, { onConflict: 'company_id' });

    if (error) console.error('saveCsvSettings error', error);
  }

  /* =========================
     Branding Settings
     ========================= */

  private defaultBrandingSettings(companyId: string): Partial<BrandingSettings> {
    return {
      company_id: companyId,
      company_name: '',
      logo_url: null,
      primary_color: null,
      secondary_color: null,
    } as any;
  }

  async getBrandingSettings(): Promise<BrandingSettings> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) throw new Error('No company selected for this user.');

    const { data, error } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (data) return data as any;

    if (error && !isNoRows(error)) {
      console.error('getBrandingSettings error', error);
      throw error;
    }

    // Create default row
    const { error: upErr } = await this.supabase
      .from('branding_settings')
      .upsert(this.defaultBrandingSettings(companyId) as any, { onConflict: 'company_id' });

    if (upErr) {
      console.error('getBrandingSettings create default error', upErr);
      throw upErr;
    }

    const { data: created, error: readErr } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (readErr) {
      console.error('getBrandingSettings read-after-create error', readErr);
      throw readErr;
    }

    return created as any;
  }

  async saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const companyId = await this.getCurrentCompanyId();
    if (!companyId) throw new Error('No company selected for this user.');

    const payload = { ...settings, company_id: companyId };

    const { error } = await this.supabase
      .from('branding_settings')
      .upsert(payload as any, { onConflict: 'company_id' });

    if (error) {
      console.error('saveBrandingSettings error', error);
      throw error;
    }

    const { data, error: readErr } = await this.supabase
      .from('branding_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (readErr) {
      console.error('saveBrandingSettings read-back error', readErr);
      throw readErr;
    }

    return data as any;
  }

  /* =========================
     Estimates (so app can load)
     ========================= */

  async listEstimates(): Promise<any[]> {
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

    return data ?? [];
  }
}
