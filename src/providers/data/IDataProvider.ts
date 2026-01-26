import {
  AdminRule,
  BrandingSettings,
  CompanySettings,
  CsvSettings,
  JobType,
} from './types';

export interface IDataProvider {
  /* =========================
     Company / Context
     ========================= */
  getCurrentCompanyId(): Promise<string | null>;

  /* =========================
     Company Setup / Settings
     ========================= */
  getCompanySettings(): Promise<CompanySettings | null>;
  saveCompanySettings(settings: Partial<CompanySettings>): Promise<void>;

  /* =========================
     Job Types
     ========================= */
  getJobTypes(): Promise<JobType[]>;
  saveJobType(jobType: Partial<JobType>): Promise<void>;

  // Admin UI compatibility (aliases / required API)
  listJobTypes(): Promise<JobType[]>;
  upsertJobType(jobType: Partial<JobType>): Promise<void>;
  setDefaultJobType(jobTypeId: string): Promise<void>;

  /* =========================
     Admin Rules
     ========================= */
  listAdminRules(): Promise<AdminRule[]>;
  saveAdminRule(rule: Partial<AdminRule>): Promise<void>;
  deleteAdminRule(id: string): Promise<void>;

  /* =========================
     CSV Settings
     ========================= */
  getCsvSettings(): Promise<CsvSettings | null>;
  saveCsvSettings(settings: Partial<CsvSettings>): Promise<void>;

  /* =========================
     Branding Settings
     ========================= */
  getBrandingSettings(): Promise<BrandingSettings | null>;
  saveBrandingSettings(settings: Partial<BrandingSettings>): Promise<void>;
}
