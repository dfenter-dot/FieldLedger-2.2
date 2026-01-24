// src/providers/data/local/LocalDataProvider.ts

import { IDataProvider } from "../IDataProvider";
import {
  Company,
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
  UUID,
} from "../types";
import {
  seedCompany,
  seedCompanySettings,
  seedJobTypes,
  seedAdminRules,
  seedCsvSettings,
  seedBrandingSettings,
} from "./seed";

export class LocalDataProvider implements IDataProvider {
  private company: Company = seedCompany;
  private companySettings: CompanySettings = seedCompanySettings;
  private jobTypes: JobType[] = [...seedJobTypes];
  private adminRules: AdminRule[] = [...seedAdminRules];
  private csvSettings: CsvSettings = seedCsvSettings;
  private brandingSettings: BrandingSettings = seedBrandingSettings;

  /* Company */
  async getCompany(companyId: UUID): Promise<Company | null> {
    return companyId === this.company.id ? this.company : null;
  }

  /* Company Settings */
  async getCompanySettings(
    companyId: UUID
  ): Promise<CompanySettings | null> {
    return companyId === this.companySettings.company_id
      ? this.companySettings
      : null;
  }

  async upsertCompanySettings(
    settings: Partial<CompanySettings> & { company_id: UUID }
  ): Promise<void> {
    this.companySettings = {
      ...this.companySettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
  }

  /* Job Types */
  async listJobTypes(companyId: UUID): Promise<JobType[]> {
    return this.jobTypes.filter((jt) => jt.company_id === companyId);
  }

  async createJobType(
    jobType: Omit<JobType, "id" | "created_at">
  ): Promise<JobType> {
    const newJobType: JobType = {
      ...jobType,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.jobTypes.push(newJobType);
    return newJobType;
  }

  async updateJobType(jobType: JobType): Promise<void> {
    this.jobTypes = this.jobTypes.map((jt) =>
      jt.id === jobType.id ? jobType : jt
    );
  }

  async deleteJobType(id: UUID): Promise<void> {
    this.jobTypes = this.jobTypes.filter((jt) => jt.id !== id);
  }

  /* Admin Rules */
  async listAdminRules(companyId: UUID): Promise<AdminRule[]> {
    return this.adminRules.filter((r) => r.company_id === companyId);
  }

  async upsertAdminRule(
    rule: Partial<AdminRule> & { company_id: UUID }
  ): Promise<void> {
    const existing = this.adminRules.find((r) => r.id === rule.id);
    if (existing) {
      Object.assign(existing, rule);
    } else {
      this.adminRules.push({
        id: crypto.randomUUID(),
        name: rule.name ?? "New Rule",
        priority: rule.priority ?? 0,
        enabled: rule.enabled ?? true,
        company_id: rule.company_id,
        created_at: new Date().toISOString(),
      });
    }
  }

  /* CSV Settings */
  async getCsvSettings(companyId: UUID): Promise<CsvSettings | null> {
    return companyId === this.csvSettings.company_id
      ? this.csvSettings
      : null;
  }

  async upsertCsvSettings(
    settings: Partial<CsvSettings> & { company_id: UUID }
  ): Promise<void> {
    this.csvSettings = {
      ...this.csvSettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
  }

  /* Branding */
  async getBrandingSettings(
    companyId: UUID
  ): Promise<BrandingSettings | null> {
    return companyId === this.brandingSettings.company_id
      ? this.brandingSettings
      : null;
  }

  async upsertBrandingSettings(
    settings: Partial<BrandingSettings> & { company_id: UUID }
  ): Promise<void> {
    this.brandingSettings = {
      ...this.brandingSettings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
  }
}
