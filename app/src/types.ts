export type ModelKey = 'onMarketQuality' | 'onMarketNoQuality' | 'offMarketQuality' | 'offMarketNoQuality' | 'compEstimate';

export interface ErrorMetrics {
  absolute: number;
  pct: number;
  signed: number;
  signedPct: number;
}

export interface PropertyResult {
  listingId: string;
  closePrice: number;
  listPrice: number | null;
  closeDate: string;
  city: string | null;
  board: string;
  propertySubType: string | null;
  postalCode: string | null;
  fsa: string | null;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: string | null;
  overallQuality: number | null;
  predictions: Record<ModelKey, number | null>;
  errors: Record<ModelKey, ErrorMetrics | null>;
  priceBand: string;
}

export interface ReportData {
  meta: {
    generatedAt: string;
    dateRange: { from: string; to: string };
    totalProperties: number;
    scriptDurationMs: number;
  };
  properties: PropertyResult[];
}

export interface ModelMetrics {
  medianError: number;
  medianErrorPct: number;
  mape: number;
  count: number;
  pctWithin10: number;
  p95ErrorPct: number;
}

export const MODEL_LABELS: Record<ModelKey, string> = {
  onMarketQuality: 'On-Market (Quality)',
  offMarketQuality: 'Off-Market (Quality)',
  onMarketNoQuality: 'On-Market (No Quality)',
  offMarketNoQuality: 'Off-Market (No Quality)',
  compEstimate: 'Comp Estimate',
};

export const MODEL_KEYS: ModelKey[] = [
  'offMarketQuality',
  'offMarketNoQuality',
  'onMarketQuality',
  'onMarketNoQuality',
  'compEstimate',
];

/** Model keys used in charts (excludes compEstimate) */
export const CHART_MODEL_KEYS: ModelKey[] = [
  'offMarketQuality',
  'offMarketNoQuality',
  'onMarketQuality',
  'onMarketNoQuality',
];

/** Grouped model keys for side-by-side comparison */
export const MODEL_GROUPS: { label: string; keys: ModelKey[] }[] = [
  { label: 'Off-Market Models', keys: ['offMarketQuality', 'offMarketNoQuality'] },
  { label: 'On-Market Models', keys: ['onMarketQuality', 'onMarketNoQuality'] },
  { label: 'Comparable Estimate', keys: ['compEstimate'] },
];

export const PRICE_BANDS = [
  'Under $300K',
  '$300K-$500K',
  '$500K-$750K',
  '$750K-$1M',
  '$1M-$1.5M',
  '$1.5M-$2M',
  '$2M+',
];
