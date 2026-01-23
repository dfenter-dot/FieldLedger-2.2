export type LibraryType = 'app' | 'user';

export type Folder = {
  id: string;
  companyId: string;
  libraryType: LibraryType;
  parentId: string | null;
  name: string;
  imageUrl?: string | null;
  sortOrder: number;
};

export type Material = {
  id: string;
  companyId: string;
  libraryType: LibraryType;
  folderId: string;
  name: string;
  sku?: string | null;
  description?: string | null;

  baseCost: number; // cost-side, before purchase tax
  useCustomCost: boolean;
  customCost?: number | null;

  taxable: boolean;
  jobTypeId?: string | null;

  laborMinutes: number; // stored as minutes
  imageUrl?: string | null;
  sortOrder: number;
};

export type Assembly = {
  id: string;
  companyId: string;
  libraryType: LibraryType;
  folderId: string;
  name: string;
  description?: string | null;
  code?: string | null; // numeric-ish identifier
  jobTypeId?: string | null;
  useAdminRules: boolean;
  customerSuppliesMaterials: boolean;

  // v0.1 placeholders; line items will be added once UI finalized
  sortOrder: number;
};

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'archived';

export type Estimate = {
  id: string;
  companyId: string;
  number: number;

  name: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;

  privateNotes?: string | null;

  jobTypeId?: string | null;
  useAdminRules: boolean;
  customerSuppliesMaterials: boolean;

  discountId?: string | null;
  applyProcessingFees: boolean;
  applyMiscMaterial: boolean;

  status: EstimateStatus;
  createdAt: string;
  validUntil?: string | null;
};

export type JobType = {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  mode: 'flat' | 'hourly';
  grossMarginPct: number; // 0-100
  efficiencyPct: number; // 0-100
  allowDiscount: boolean;
};

export type BrandingSettings = {
  companyName?: string | null;
  licenseInfo?: string | null;
  warrantyInfo?: string | null;
  logoUrl?: string | null;
};
