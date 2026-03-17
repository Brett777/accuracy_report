import type { PropertyResult } from '../types';
import { MODEL_LABELS, type ModelKey } from '../types';

type FeatureModelKey = Exclude<ModelKey, 'compEstimate'>;

const MERGE_ORDER: FeatureModelKey[] = [
  'offMarketNoQuality',
  'onMarketNoQuality',
  'offMarketQuality',
  'onMarketQuality',
];

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Columns where DataRobot expects full ISO 8601 timestamps with microsecond precision. */
const DATE_COLUMNS = new Set(['CloseDate', 'ListingContractDate']);

/**
 * Convert date-only strings (YYYY-MM-DD) to full ISO timestamps (YYYY-MM-DDTHH:MM:SS.ffffffZ)
 * to match the format DataRobot was trained with.
 */
function formatDateValue(col: string, value: string | number | null): string | number | null {
  if (!DATE_COLUMNS.has(col) || value === null || typeof value !== 'string') return value;
  // Already a full timestamp — just ensure microsecond precision
  if (value.includes('T')) return value.replace(/(\.\d{3})Z$/, '$1000Z');
  // Date-only (YYYY-MM-DD) — expand to full ISO with microseconds
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toISOString().replace(/(\.\d{3})Z$/, '$1000Z');
  } catch { return value; }
}

/**
 * Merge raw features from all 4 models into a single row.
 * Non-null values are never overwritten by null — this prevents
 * the property_clone table's missing categorical fields from
 * clobbering populated values from the legacy property table.
 */
function mergeRawFeatures(
  rawFeatures: PropertyResult['rawFeatures'],
): Record<string, string | number | null> {
  if (!rawFeatures) return {};
  const merged: Record<string, string | number | null> = {};
  for (const key of MERGE_ORDER) {
    const features = rawFeatures[key];
    if (!features) continue;
    for (const [col, val] of Object.entries(features)) {
      // Only overwrite if the incoming value is non-null,
      // or the column hasn't been set yet
      if (val !== null && val !== undefined) {
        merged[col] = val;
      } else if (!(col in merged)) {
        merged[col] = val;
      }
    }
  }
  return merged;
}

const MODEL_KEYS_ALL: ModelKey[] = [
  'onMarketQuality',
  'offMarketQuality',
  'onMarketNoQuality',
  'offMarketNoQuality',
  'compEstimate',
];

/**
 * Generate a comprehensive CSV from filtered properties.
 * Includes the union of all raw feature columns across all 4 models,
 * the target (ClosePrice), predictions from every model, and per-model error metrics.
 */
export function generateCSV(properties: PropertyResult[]): string {
  // Collect the union of all feature column names across all models and properties
  const columnSet = new Set<string>();
  for (const p of properties) {
    if (!p.rawFeatures) continue;
    for (const key of MERGE_ORDER) {
      const features = p.rawFeatures[key];
      if (features) {
        for (const col of Object.keys(features)) columnSet.add(col);
      }
    }
  }

  const featureCols = [...columnSet].sort();

  // Build prediction + error suffix columns for each model
  const modelSuffixCols: string[] = [];
  for (const mk of MODEL_KEYS_ALL) {
    const label = MODEL_LABELS[mk].replace(/[^a-zA-Z0-9]/g, '_');
    modelSuffixCols.push(
      `Prediction_${label}`,
      `Error_Pct_${label}`,
      `Error_SignedPct_${label}`,
      `Error_Absolute_${label}`,
    );
  }

  const headers = [...featureCols, 'ClosePrice', ...modelSuffixCols];

  const rows = properties.map(p => {
    const merged = mergeRawFeatures(p.rawFeatures);
    const featureValues = featureCols.map(col => escapeCSV(formatDateValue(col, merged[col])));

    const modelValues: string[] = [];
    for (const mk of MODEL_KEYS_ALL) {
      modelValues.push(
        escapeCSV(p.predictions[mk]),
        escapeCSV(p.errors[mk]?.pct ?? null),
        escapeCSV(p.errors[mk]?.signedPct ?? null),
        escapeCSV(p.errors[mk]?.absolute ?? null),
      );
    }

    return [...featureValues, escapeCSV(p.closePrice), ...modelValues].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
