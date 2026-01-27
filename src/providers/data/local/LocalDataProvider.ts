import {
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
} from '../types';
import { IDataProvider } from '../IDataProvider';

/**
 * LocalDataProvider
 *
 * Used for local/dev mode.
 * Phase 1 Rules: simple in-memory storage.
 */
export class LocalDataProvider implements IDataProvider {
  private companySettings = new Map<string, CompanySettings>();
  private jobTypes = new Map<string, JobType[]>();
  private adminRules = new Map<string, AdminRule[]>();
  private csvSettings = new Map<string, CsvSettings>();
  private brandingSettings = new Map<string, BrandingSettings>();

  /* =========================
     Company
     ========================= */

  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    return this.companySettings.get(companyId) ?? null;
  }

  async upsertCompanySettings(
    companyId: string,
    settings: Partial<CompanySettings>
  ): Promise<CompanySettings> {
    const existing = this.companySettings.get(companyId) ?? ({} as CompanySettings);
    const updated = { ...existing, ...settings, company_id: companyId } as CompanySettings;
    this.companySettings.set(companyId, updated);
    return updated;
  }

  /* =========================
     Job Types
     ========================= */

  async getJobTypes(companyId: string): Promise<JobType[]> {
    return this.jobTypes.get(companyId) ?? [];
  }

  async upsertJobType(
    companyId: string,
    jobType: Partial<JobType>
  ): Promise<JobType> {
    const list = this.jobTypes.get(companyId) ?? [];
    let updated: JobType;

    if (jobType.id) {
      updated = { ...list.find(j => j.id === jobType.id)!, ...jobType } as JobType;
      this.jobTypes.set(
        companyId,
        list.map(j => (j.id === updated.id ? updated : j))
      );
    } else {
      updated = {
        ...(jobType as JobType),
        id: crypto.randomUUID(),
        company_id: companyId,
      };
      this.jobTypes.set(companyId, [...list, updated]);
    }

    return updated;
  }

  async deleteJobType(companyId: string, jobTypeId: string): Promise<void> {
    const list = this.jobTypes.get(companyId) ?? [];
    this.jobTypes.set(
      companyId,
      list.filter(j => j.id !== jobTypeId)
    );
  }

  /* =========================
     Admin Rules
     ========================= */

  async getAdminRules(companyId: string): Promise<AdminRule[]> {
    return this.adminRules.get(companyId) ?? [];
  }

  async upsertAdminRule(
    companyId: string,
    rule: Partial<AdminRule>
  ): Promise<AdminRule> {
    const list = this.adminRules.get(companyId) ?? [];
    let updated: AdminRule;

    if (rule.id) {
      updated = { ...list.find(r => r.id === rule.id)!, ...rule } as AdminRule;
      this.adminRules.set(
        companyId,
        list.map(r => (r.id === updated.id ? updated : r))
      );
    } else {
      updated = {
        ...(rule as AdminRule),
        id: crypto.randomUUID(),
        company_id: companyId,
      };
      this.adminRules.set(companyId, [...list, updated]);
    }

    return updated;
  }

  async deleteAdminRule(companyId: string, ruleId: string): Promise<void> {
    const list = this.adminRules.get(companyId) ?? [];
    this.adminRules.set(
      companyId,
      list.filter(r => r.id !== ruleId)
    );
  }

  /* =========================
     CSV Settings
     ========================= */

  async getCsvSettings(companyId: string): Promise<CsvSettings | null> {
    return this.csvSettings.get(companyId) ?? null;
  }

  async upsertCsvSettings(
    companyId: string,
    settings: Partial<CsvSettings>
  ): Promise<CsvSettings> {
    const existing = this.csvSettings.get(companyId) ?? ({} as CsvSettings);
    const updated = { ...existing, ...settings, company_id: companyId } as CsvSettings;
    this.csvSettings.set(companyId, updated);
    return updated;
  }

  /* =========================
     Branding
     ========================= */

  async getBrandingSettings(companyId: string): Promise<BrandingSettings | null> {
    return this.brandingSettings.get(companyId) ?? null;
  }

  async upsertBrandingSettings(
    companyId: string,
    settings: Partial<BrandingSettings>
  ): Promise<BrandingSettings> {
    const existing = this.brandingSettings.get(companyId) ?? ({} as BrandingSettings);
    const updated = { ...existing, ...settings, company_id: companyId } as BrandingSettings;
    this.brandingSettings.set(companyId, updated);
    return updated;
  }
}
