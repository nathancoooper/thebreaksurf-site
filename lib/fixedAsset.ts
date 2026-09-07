import { erpCreate, erpList } from '@/lib/erpnext';

export const CAPITAL_ALLOWANCE_PO_FIELD = 'custom_fixed_asset_details';

export interface FixedAssetDetails {
  asset_category: string;
  location: string;
  available_for_use_date: string;
  depreciation_start_date: string;
  depreciation_method: 'Straight Line' | 'Written Down Value' | 'Double Declining Balance';
  useful_life_years: number;
  posting_frequency_months: 1 | 3 | 12;
  residual_value: number;
  ca_pool: 'Main Pool' | 'Special Rate Pool' | 'Single Asset Pool' | 'Not Applicable' | 'Review Required';
  ca_treatment: 'Annual Investment Allowance' | 'Full Expensing' | 'First-Year Allowance' | 'Writing-Down Allowance' | 'No Claim' | 'Review Required';
  ca_qualifying_cost: number;
  ca_eligibility_status: 'Unreviewed' | 'Provisionally Eligible' | 'Confirmed' | 'Not Eligible';
  tax_notes: string;
}

interface CustomFieldDefinition {
  dt: 'Asset' | 'Purchase Order';
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string;
  insert_after?: string;
  hidden?: 0 | 1;
  print_hide?: 0 | 1;
  allow_on_submit?: 0 | 1;
  default?: string;
}

const CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    dt: 'Purchase Order',
    fieldname: CAPITAL_ALLOWANCE_PO_FIELD,
    label: 'Fixed Asset Details',
    fieldtype: 'Long Text',
    insert_after: 'title',
    hidden: 1,
    print_hide: 1,
  },
  {
    dt: 'Asset',
    fieldname: 'custom_tax_information_section',
    label: 'Tax Information — does not affect accounting entries',
    fieldtype: 'Section Break',
    insert_after: 'finance_books',
    print_hide: 1,
  },
  {
    dt: 'Asset',
    fieldname: 'custom_ca_pool',
    label: 'Capital Allowance Pool',
    fieldtype: 'Select',
    options: 'Main Pool\nSpecial Rate Pool\nSingle Asset Pool\nNot Applicable\nReview Required',
    insert_after: 'custom_tax_information_section',
    print_hide: 1,
    allow_on_submit: 1,
    default: 'Main Pool',
  },
  {
    dt: 'Asset',
    fieldname: 'custom_ca_treatment',
    label: 'Intended Capital Allowance Treatment',
    fieldtype: 'Select',
    options: 'Annual Investment Allowance\nFull Expensing\nFirst-Year Allowance\nWriting-Down Allowance\nNo Claim\nReview Required',
    insert_after: 'custom_ca_pool',
    print_hide: 1,
    allow_on_submit: 1,
    default: 'Review Required',
  },
  {
    dt: 'Asset',
    fieldname: 'custom_ca_qualifying_cost',
    label: 'Capital Allowance Qualifying Cost',
    fieldtype: 'Currency',
    options: 'Company:company:default_currency',
    insert_after: 'custom_ca_treatment',
    print_hide: 1,
    allow_on_submit: 1,
  },
  {
    dt: 'Asset',
    fieldname: 'custom_ca_eligibility_status',
    label: 'Capital Allowance Eligibility Status',
    fieldtype: 'Select',
    options: 'Unreviewed\nProvisionally Eligible\nConfirmed\nNot Eligible',
    insert_after: 'custom_ca_qualifying_cost',
    print_hide: 1,
    allow_on_submit: 1,
    default: 'Unreviewed',
  },
  {
    dt: 'Asset',
    fieldname: 'custom_tax_notes',
    label: 'Tax Notes',
    fieldtype: 'Small Text',
    insert_after: 'custom_ca_eligibility_status',
    print_hide: 1,
    allow_on_submit: 1,
  },
];

let setupPromise: Promise<void> | null = null;

/**
 * Custom fields live in ERPNext rather than the website volume, so the tax
 * metadata stays with the Asset through normal ERPNext backups and restores.
 * This is deliberately idempotent: a restored/new ERPNext site can repair its
 * schema on the first fixed-asset form load without a separate manual step.
 */
export function ensureFixedAssetCustomFields(): Promise<void> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    const existing = await erpList<{ dt: string; fieldname: string }>('Custom Field', {
      fields: ['dt', 'fieldname'],
      filters: [['dt', 'in', ['Asset', 'Purchase Order']]],
      limit: 500,
    });
    const keys = new Set(existing.map(field => `${field.dt}:${field.fieldname}`));
    for (const field of CUSTOM_FIELDS) {
      if (keys.has(`${field.dt}:${field.fieldname}`)) continue;
      await erpCreate('Custom Field', {
        doctype: 'Custom Field',
        ...field,
      });
    }
  })().catch(error => {
    setupPromise = null;
    throw error;
  });
  return setupPromise;
}

export function parseFixedAssetDetails(value: unknown): FixedAssetDetails {
  const raw = typeof value === 'string' ? JSON.parse(value) as Partial<FixedAssetDetails> : value as Partial<FixedAssetDetails>;
  const allowedMethods = ['Straight Line', 'Written Down Value', 'Double Declining Balance'];
  const allowedFrequencies = [1, 3, 12];
  if (!raw || !raw.asset_category || !raw.location || !raw.available_for_use_date) {
    throw new Error('Complete the fixed asset accounting details before creating the purchase order.');
  }
  if (!allowedMethods.includes(raw.depreciation_method ?? '')) throw new Error('Choose a valid depreciation method.');
  if (!allowedFrequencies.includes(Number(raw.posting_frequency_months))) throw new Error('Choose a valid depreciation posting frequency.');
  const life = Number(raw.useful_life_years);
  const residual = Number(raw.residual_value ?? 0);
  const qualifyingCost = Number(raw.ca_qualifying_cost ?? 0);
  if (!Number.isInteger(life) || life <= 0) throw new Error('Useful life must be a whole number of years greater than zero.');
  if (!Number.isFinite(residual) || residual < 0) throw new Error('Residual value cannot be negative.');
  if (!Number.isFinite(qualifyingCost) || qualifyingCost < 0) throw new Error('Qualifying cost cannot be negative.');

  return {
    asset_category: raw.asset_category,
    location: raw.location,
    available_for_use_date: raw.available_for_use_date,
    depreciation_start_date: raw.depreciation_start_date ?? raw.available_for_use_date,
    depreciation_method: raw.depreciation_method as FixedAssetDetails['depreciation_method'],
    useful_life_years: life,
    posting_frequency_months: Number(raw.posting_frequency_months) as FixedAssetDetails['posting_frequency_months'],
    residual_value: residual,
    ca_pool: raw.ca_pool ?? 'Main Pool',
    ca_treatment: raw.ca_treatment ?? 'Review Required',
    ca_qualifying_cost: qualifyingCost,
    ca_eligibility_status: raw.ca_eligibility_status ?? 'Unreviewed',
    tax_notes: String(raw.tax_notes ?? '').trim(),
  };
}
