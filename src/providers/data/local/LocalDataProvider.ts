import { IDataProvider } from '../IDataProvider';
import {
  AdminRule,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  JobType,
} from '../types';

/**
 * Local / in-memory provider.
 * Used only for dev or fallback; not production-safe.
 */
export class LocalDataProvider implements IDataProvider {
  private companyId: string | null;

  private companySettings: CompanySettings | null = null;
  private jobTypes: JobType[] = [];
  private adminRules: AdminRule[] = [];
  private csvSettings: CsvSettings | null = null;
  private brandingSettings: BrandingSettings | null = null;

  constructor(companyId: string | null = null) {
    this.companyId = companyId;
  }

  /* =========================
     Company / Context
     ========================= */

  async getCurrentCompanyId(): Promise<string | null> {
    return this.companyId;
  }

  /* =========================
     Company Settings
     ========================= */

  async getCompanySettings(): Promise<CompanySettings | null> {
    return this.companySettings;
  }

  async saveCompanySettings(
    settings: Partial<CompanySettings>
  ): Promise<void> {
    this.companySettings = {
      ...(this.companySettings ?? {
        id: 'local',
        company_id: this.companyId ?? 'local',
      }),
      ...settings,
    } as CompanySettings;
  }

  /* =========================
     Job Types
     ========================= */

  async getJobTypes(): Promise<JobType[]> {
    return this.jobTypes;
  }

  async saveJobType(jobType: Partial<JobType>): Promise<void> {
    const existing = this.jobTypes.find(j => j.id === jobType.id);

    if (existing) {
      Object.assign(existing, jobType);
    } else {
      this.jobTypes.push({
        id: jobType.id ?? crypto.randomUUID(),
        company_id: this.companyId ?? 'local',
        name: jobType.name ?? 'New Job Type',
        billing_mode: jobType.billing_mode ?? 'hourly',
        is_default: !!jobType.is_default,
      });
    }
  }

  async listJobTypes(): Promise<JobType[]> {
    return this.getJobTypes();
  }

  async upsertJobType(jobType: Partial<JobType>): Promise<void> {
    return this.saveJobType(jobType);
  }

  async setDefaultJobType(jobTypeId: string): Promise<void> {
    this.jobTypes.forEach(j => {
      j.is_default = j.id === jobTypeId;
    });
  }

  /* =========================
     Admin Rules
     ========================= */

  async listAdminRules(): Promise<AdminRule[]> {
    return this.adminRules;
  }

  async saveAdminRule(rule: Partial<AdminRule>): Promise<void> {
    const existing = this.adminRules.find(r => r.id === rule.id);

    if (existing) {
      Object.assign(existing, rule);
    } else {
      this.adminRules.push({
        id: rule.id ?? crypto.randomUUID(),
        company_id: this.companyId ?? 'local',
        name: rule.name ?? 'New Rule',
        rule_type: rule.rule_type ?? 'custom',
        rule_value: rule.rule_value ?? null,
      });
    }
  }

  async deleteAdminRule(id: string): Promise<void> {
    this.adminRules = this.adminRules.filter(r => r.id !== id);
  }

  /* =========================
     CSV Settings
     ========================= */

  async getCsvSettings(): Promise<CsvSettings | null> {
    return this.csvSettings;
  }

  async saveCsvSettings(settings: Partial<CsvSettings>): Promise<void> {
    this.csvSettings = {
      ...(this.csvSettings ?? {
        id: 'local',
        company_id: this.companyId ?? 'local',
      }),
      ...settings,
    } as CsvSettings;
  }

  /* =========================
     Branding Settings
     ========================= */

  async getBrandingSettings(): Promise<BrandingSettings | null> {
    return this.brandingSettings;
  }

  async saveBrandingSettings(
    settings: Partial<BrandingSettings>
  ): Promise<void> {
    this.brandingSettings = {
      ...(this.brandingSettings ?? {
        id: 'local',
        company_id: this.companyId ?? 'local',
        company_name: 'Local Company',
      }),
      ...settings,
    } as BrandingSettings;
  }
}
