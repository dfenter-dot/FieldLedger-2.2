// src/providers/data/local/seed.ts

import {
  Company,
  CompanySettings,
  JobType,
  AdminRule,
  CsvSettings,
  BrandingSettings,
} from "../types";

export const seedCompany: Company = {
  id: "demo-company-id",
  name: "Demo Company",
  created_at: new Date().toISOString(),
};

export const seedCompanySettings: CompanySettings = {
  id: "company-settings-id",
  company_id: seedCompany.id,
  starting_estimate_number: 1000,
  min_labor_minutes: 15,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const seedJobTypes: JobType[] = [
  {
    id: "job-type-1",
    company_id: seedCompany.id,
    name: "Service Call",
    description: "General service work",
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "job-type-2",
    company_id: seedCompany.id,
    name: "Install",
    description: "New installations",
    active: true,
    created_at: new Date().toISOString(),
  },
];

export const seedAdminRules: AdminRule[] = [
  {
    id: "rule-1",
    company_id: seedCompany.id,
    name: "Minimum Labor Rule",
    priority: 1,
    enabled: true,
    created_at: new Date().toISOString(),
  },
];

export const seedCsvSettings: CsvSettings = {
  id: "csv-settings-id",
  company_id: seedCompany.id,
  allow_material_import: true,
  allow_assembly_import: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const seedBrandingSettings: BrandingSettings = {
  id: "branding-settings-id",
  company_id: seedCompany.id,
  logo_url: null,
  primary_color: "#3b82f6",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
