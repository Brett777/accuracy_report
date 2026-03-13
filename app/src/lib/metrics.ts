import type { PropertyResult, ModelKey, ModelMetrics } from '../types';

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function computeModelMetrics(properties: PropertyResult[], modelKey: ModelKey): ModelMetrics {
  const withErrors = properties.filter(p => p.errors[modelKey] !== null);
  if (withErrors.length === 0) {
    return { medianError: 0, medianErrorPct: 0, mape: 0, count: 0, pctWithin10: 0, p95ErrorPct: 0 };
  }

  const absErrors = withErrors.map(p => p.errors[modelKey]!.absolute);
  const pctErrors = withErrors.map(p => p.errors[modelKey]!.pct);
  const within10 = pctErrors.filter(e => e <= 10).length;

  return {
    medianError: median(absErrors),
    medianErrorPct: median(pctErrors),
    mape: pctErrors.reduce((s, v) => s + v, 0) / pctErrors.length,
    count: withErrors.length,
    pctWithin10: (within10 / withErrors.length) * 100,
    p95ErrorPct: percentile(pctErrors, 95),
  };
}
