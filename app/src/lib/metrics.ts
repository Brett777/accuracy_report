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
    return { medianError: 0, medianErrorPct: 0, mape: 0, count: 0, pctWithin10: 0, p95ErrorPct: 0, meanError: 0, rmse: 0, pctWithin5: 0, pctWithin20: 0, medianSignedPct: 0, stdErrorPct: 0 };
  }

  const absErrors = withErrors.map(p => p.errors[modelKey]!.absolute);
  const pctErrors = withErrors.map(p => p.errors[modelKey]!.pct);
  const signedPctErrors = withErrors.map(p => p.errors[modelKey]!.signedPct);
  const n = withErrors.length;

  const meanAbsError = absErrors.reduce((s, v) => s + v, 0) / n;
  const mape = pctErrors.reduce((s, v) => s + v, 0) / n;
  const rmse = Math.sqrt(absErrors.reduce((s, v) => s + v * v, 0) / n);

  const meanPctError = pctErrors.reduce((s, v) => s + v, 0) / n;
  const variance = pctErrors.reduce((s, v) => s + (v - meanPctError) ** 2, 0) / n;
  const stdErrorPct = Math.sqrt(variance);

  return {
    medianError: median(absErrors),
    medianErrorPct: median(pctErrors),
    mape,
    count: n,
    pctWithin10: (pctErrors.filter(e => e <= 10).length / n) * 100,
    p95ErrorPct: percentile(pctErrors, 95),
    meanError: meanAbsError,
    rmse,
    pctWithin5: (pctErrors.filter(e => e <= 5).length / n) * 100,
    pctWithin20: (pctErrors.filter(e => e <= 20).length / n) * 100,
    medianSignedPct: median(signedPctErrors),
    stdErrorPct,
  };
}
