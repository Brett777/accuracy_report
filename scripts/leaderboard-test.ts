/**
 * Score report.json properties against specific DataRobot leaderboard models
 * (not deployments) and compare accuracy metrics side by side.
 *
 * Usage:
 *   npx tsx scripts/leaderboard-test.ts
 *
 * Requires: DR_API_KEY and DR_API_BASE_URL in .env
 * Requires: report.json generated with rawFeatures (run `npm run generate` first)
 */

import dotenv from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(process.cwd(), '.env') });

// ── Config ──────────────────────────────────────────────────────────

const DR_APP_URL = (process.env.DR_API_BASE_URL || 'https://app.datarobot.com').replace(/\/+$/, '');

function getApiToken(): string {
  const key = process.env.DR_API_KEY;
  if (!key) throw new Error('DR_API_KEY env var is required');
  try {
    const decoded = Buffer.from(key, 'base64').toString('utf-8');
    const idx = decoded.indexOf(':');
    if (idx > 0) return decoded.slice(idx + 1);
  } catch { /* not base64, use as-is */ }
  return key;
}

const API_TOKEN = getApiToken();

function apiHeaders(contentType?: string): Record<string, string> {
  const h: Record<string, string> = { 'Authorization': `Bearer ${API_TOKEN}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

// ── Model targets ───────────────────────────────────────────────────

interface ModelTarget {
  label: string;
  projectId: string;
  modelId: string;
  featureKey: string; // key in rawFeatures
}

const MODELS: ModelTarget[] = [
  {
    label: 'Off-Market (Quality)',
    projectId: '69b8fee6caee979415033f8a',
    modelId: '69b903251acc8cd3b00345f3',
    featureKey: 'offMarketQuality',
  },
  {
    label: 'Off-Market (No Quality)',
    projectId: '69b6148f95ee776b0d1b2989',
    modelId: '69b63a0b6fa36ed3ec325d46',
    featureKey: 'offMarketNoQuality',
  },
];

// ── Types ───────────────────────────────────────────────────────────

interface PropertyResult {
  listingId: string;
  closePrice: number;
  predictions: Record<string, number | null>;
  errors: Record<string, { absolute: number; pct: number; signed: number; signedPct: number } | null>;
  rawFeatures?: Record<string, Record<string, string | number | null>>;
}

interface ReportData {
  meta: { dateRange: { from: string; to: string }; totalProperties: number };
  properties: PropertyResult[];
}

// ── CSV generation ──────────────────────────────────────────────────

const DATE_COLUMNS = new Set(['CloseDate', 'ListingContractDate']);

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateValue(col: string, value: string | number | null): string | number | null {
  if (!DATE_COLUMNS.has(col) || value === null || typeof value !== 'string') return value;
  if (value.includes('T')) return value.replace(/(\.\d{3})Z$/, '$1000Z');
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toISOString().replace(/(\.\d{3})Z$/, '$1000Z');
  } catch { return value; }
}

function generateModelCSV(
  properties: PropertyResult[],
  featureKey: string,
): string {
  const columnSet = new Set<string>();
  for (const p of properties) {
    const features = p.rawFeatures?.[featureKey];
    if (features) {
      for (const k of Object.keys(features)) columnSet.add(k);
    }
  }

  const featureCols = [...columnSet].sort();
  const headers = [...featureCols, 'ClosePrice'];

  const rows = properties.map(p => {
    const features = p.rawFeatures?.[featureKey] ?? {};
    return [
      ...featureCols.map(col => escapeCSV(formatDateValue(col, features[col] ?? null))),
      escapeCSV(p.closePrice),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ── DataRobot API ───────────────────────────────────────────────────

async function drFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${DR_APP_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { ...apiHeaders(), ...(opts.headers as Record<string, string> || {}) },
  });
  return res;
}

async function pollStatus(statusUrl: string, label: string, maxSeconds = 300): Promise<Response> {
  const interval = 3000;
  const maxAttempts = Math.ceil((maxSeconds * 1000) / interval);

  for (let i = 0; i < maxAttempts; i++) {
    const res = await drFetch(statusUrl, { redirect: 'manual' });

    // 303 = complete, follow redirect
    if (res.status === 303) return res;

    // 200 = might be done, check status field
    if (res.status === 200) {
      const body = await res.clone().json().catch(() => null);
      if (body?.status === 'completed' || body?.status === 'COMPLETED') return res;
      if (body?.status === 'ERROR' || body?.status === 'error') {
        throw new Error(`${label} failed: ${JSON.stringify(body.statusDetails || body.message || body)}`);
      }
    }

    // 201 = created / ready
    if (res.status === 201) return res;

    process.stdout.write('.');
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`${label} timed out after ${maxSeconds}s`);
}

/** Upload CSV directly to project as a prediction dataset. Tries multiple endpoint variants. */
async function uploadPredictionDataset(projectId: string, csvContent: string, name: string): Promise<string> {
  console.log('  Uploading prediction dataset to project...');

  const boundary = `----NodeFormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  const filename = `${name}.csv`;
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n` +
    `\r\n` +
    csvContent +
    `\r\n--${boundary}--\r\n`;

  // Try endpoint variants — DataRobot API uses fileUploads (plural)
  const endpoints = [
    `/api/v2/projects/${projectId}/predictionDatasets/fileUploads/`,
    `/api/v2/projects/${projectId}/predictionDatasets/fileUploads`,
  ];

  for (const endpoint of endpoints) {
    const res = await fetch(`${DR_APP_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (res.status === 405 || res.status === 404) continue; // wrong endpoint, try next

    if (!res.ok && res.status !== 202) {
      const err = await res.text();
      throw new Error(`Upload failed on ${endpoint} (${res.status}): ${err.slice(0, 500)}`);
    }

    const statusUrl = res.headers.get('location');
    if (statusUrl) {
      process.stdout.write('  Waiting for processing');
      const doneRes = await pollStatus(statusUrl, 'Dataset upload');
      console.log(' done');

      if (doneRes.status === 303) {
        const loc = doneRes.headers.get('location');
        if (loc) {
          const match = loc.match(/predictionDatasets\/([a-f0-9]+)/);
          if (match) return match[1];
          const finalRes = await drFetch(loc);
          const finalBody = await finalRes.json();
          return finalBody.id;
        }
      }
      const body = await doneRes.json().catch(() => null);
      if (body?.id) return body.id;
    }

    const body = await res.json();
    return body.id;
  }

  // Fallback: upload to AI Catalog then link via the dataset version approach
  console.log('  Direct upload failed, trying AI Catalog route...');
  const catalogId = await uploadToAICatalog(csvContent, name);

  // Try linking with different body shapes
  const linkBodies = [
    { datasetId: catalogId },
    { sourceDataset: catalogId },
    { catalogId: catalogId },
    { catalogVersionId: catalogId },
  ];

  for (const linkBody of linkBodies) {
    const res = await drFetch(`/api/v2/projects/${projectId}/predictionDatasets`, {
      method: 'POST',
      headers: apiHeaders('application/json'),
      body: JSON.stringify(linkBody),
    });

    if (res.status === 405 || res.status === 404 || res.status === 422) continue;

    if (!res.ok && res.status !== 202) {
      const err = await res.text();
      console.warn(`  Link attempt (${JSON.stringify(linkBody)}) failed: ${res.status} ${err.slice(0, 200)}`);
      continue;
    }

    const statusUrl = res.headers.get('location');
    if (statusUrl) {
      process.stdout.write('  Waiting for link');
      const doneRes = await pollStatus(statusUrl, 'Dataset link');
      console.log(' done');
      if (doneRes.status === 303) {
        const loc = doneRes.headers.get('location');
        if (loc) {
          const match = loc.match(/predictionDatasets\/([a-f0-9]+)/);
          if (match) return match[1];
          const finalRes = await drFetch(loc);
          return (await finalRes.json()).id;
        }
      }
      const body = await doneRes.json().catch(() => null);
      if (body?.id) return body.id;
    }

    const body = await res.json();
    if (body?.id) return body.id;
  }

  throw new Error('All upload methods failed. Check DataRobot API access.');
}

/** Upload CSV to AI Catalog, return the catalog dataset ID. */
async function uploadToAICatalog(csvContent: string, name: string): Promise<string> {
  console.log('  Uploading to AI Catalog...');

  const boundary = `----NodeFormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  const filename = `${name}.csv`;
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n` +
    `\r\n` +
    csvContent +
    `\r\n--${boundary}--\r\n`;

  const res = await fetch(`${DR_APP_URL}/api/v2/datasets/fromFile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok && res.status !== 202) {
    const err = await res.text();
    throw new Error(`AI Catalog upload failed (${res.status}): ${err.slice(0, 500)}`);
  }

  const statusUrl = res.headers.get('location');
  if (statusUrl) {
    process.stdout.write('  Waiting for processing');
    const doneRes = await pollStatus(statusUrl, 'AI Catalog upload');
    console.log(' done');

    // 303 redirect → follow to get dataset object
    if (doneRes.status === 303) {
      const loc = doneRes.headers.get('location');
      if (loc) {
        const finalRes = await drFetch(loc);
        const body = await finalRes.json();
        if (body?.datasetId) return body.datasetId;
        if (body?.id) return body.id;
      }
    }

    const body = await doneRes.json().catch(() => null);
    if (body?.datasetId) return body.datasetId;
    if (body?.id) return body.id;
  }

  const body = await res.json();
  return body.datasetId || body.id;
}


async function requestPredictions(projectId: string, modelId: string, datasetId: string): Promise<string> {
  console.log('  Requesting predictions...');

  const res = await drFetch(`/api/v2/projects/${projectId}/predictions/`, {
    method: 'POST',
    headers: apiHeaders('application/json'),
    body: JSON.stringify({ modelId, datasetId }),
  });

  if (!res.ok && res.status !== 202) {
    const err = await res.text();
    throw new Error(`Prediction request failed (${res.status}): ${err.slice(0, 500)}`);
  }

  const statusUrl = res.headers.get('location');
  if (statusUrl) {
    process.stdout.write('  Waiting for scoring');
    const doneRes = await pollStatus(statusUrl, 'Predictions');
    console.log(' done');

    const loc = doneRes.headers.get('location');
    if (loc) {
      const match = loc.match(/predictions\/([a-f0-9]+)/);
      if (match) return match[1];
    }
    const body = await doneRes.json().catch(() => null);
    if (body?.id) return body.id;
    if (doneRes.status === 303 && loc) {
      const finalRes = await drFetch(loc);
      const finalBody = await finalRes.json();
      return finalBody.id;
    }
  }

  const body = await res.json();
  return body.id;
}

async function downloadPredictions(projectId: string, predictionId: string): Promise<string> {
  console.log('  Downloading predictions...');
  const res = await drFetch(
    `/api/v2/projects/${projectId}/predictions/${predictionId}/download/`,
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Download failed (${res.status}): ${err.slice(0, 500)}`);
  }
  return res.text();
}

// ── CSV parsing ─────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { cols.push(current); current = ''; }
      else { current += ch; }
    }
  }
  cols.push(current);
  return cols;
}

function parsePredictionCSV(csv: string): { rowId: number; prediction: number }[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
  const rowIdx = header.findIndex(h => h === 'row_id' || h === 'rowid');
  const predIdx = header.findIndex(h => h === 'prediction' || h.includes('prediction'));

  if (predIdx < 0) {
    console.error('  Headers found:', header);
    throw new Error('No prediction column found in results');
  }

  const results: { rowId: number; prediction: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    const pred = parseFloat(cols[predIdx]);
    const rowId = rowIdx >= 0 ? parseInt(cols[rowIdx], 10) : i - 1;
    if (!isNaN(pred)) results.push({ rowId, prediction: pred });
  }

  // Sort by rowId to align with input order
  results.sort((a, b) => a.rowId - b.rowId);
  return results;
}

// ── Metrics ─────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

interface Metrics {
  count: number;
  mape: number;
  medianErrorPct: number;
  meanError: number;
  medianError: number;
  rmse: number;
  pctWithin5: number;
  pctWithin10: number;
  pctWithin20: number;
  medianSignedPct: number;
  p95ErrorPct: number;
  stdErrorPct: number;
}

function computeMetrics(predictions: number[], actuals: number[]): Metrics {
  const n = predictions.length;
  const pctErrors: number[] = [];
  const signedPctErrors: number[] = [];
  const absErrors: number[] = [];

  for (let i = 0; i < n; i++) {
    const signed = predictions[i] - actuals[i];
    const abs = Math.abs(signed);
    const pct = (abs / actuals[i]) * 100;
    absErrors.push(abs);
    pctErrors.push(pct);
    signedPctErrors.push((signed / actuals[i]) * 100);
  }

  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const meanPct = sum(pctErrors) / n;
  const variance = pctErrors.reduce((s, v) => s + (v - meanPct) ** 2, 0) / n;

  return {
    count: n,
    mape: meanPct,
    medianErrorPct: median(pctErrors),
    meanError: sum(absErrors) / n,
    medianError: median(absErrors),
    rmse: Math.sqrt(sum(absErrors.map(e => e * e)) / n),
    pctWithin5: (pctErrors.filter(e => e <= 5).length / n) * 100,
    pctWithin10: (pctErrors.filter(e => e <= 10).length / n) * 100,
    pctWithin20: (pctErrors.filter(e => e <= 20).length / n) * 100,
    medianSignedPct: median(signedPctErrors),
    p95ErrorPct: percentile(pctErrors, 95),
    stdErrorPct: Math.sqrt(variance),
  };
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading report data...');
  const reportPath = resolve(__dirname, '../app/public/data/report.json');
  const reportData: ReportData = JSON.parse(readFileSync(reportPath, 'utf-8'));

  const properties = reportData.properties.filter(p => p.rawFeatures != null);
  if (properties.length === 0) {
    console.error('No properties with rawFeatures. Run `npm run generate` first.');
    process.exit(1);
  }

  console.log(`${properties.length} properties | ${reportData.meta.dateRange.from} to ${reportData.meta.dateRange.to}`);

  const allResults: { label: string; source: string; metrics: Metrics; predictions: number[] }[] = [];
  const closePrices = properties.map(p => p.closePrice);

  // ── Score each leaderboard model ──────────────────────────────────

  for (const model of MODELS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`LEADERBOARD: ${model.label}`);
    console.log(`  Project: ${model.projectId}`);
    console.log(`  Model:   ${model.modelId}`);
    console.log('─'.repeat(60));

    try {
      const csv = generateModelCSV(properties, model.featureKey);
      const colCount = csv.split('\n')[0].split(',').length;
      console.log(`  CSV: ${properties.length} rows, ${colCount} columns`);

      const datasetId = await uploadPredictionDataset(model.projectId, csv, `leaderboard_test_${model.featureKey}`);
      console.log(`  Dataset ID: ${datasetId}`);

      const predictionId = await requestPredictions(model.projectId, model.modelId, datasetId);
      console.log(`  Prediction ID: ${predictionId}`);

      const predCSV = await downloadPredictions(model.projectId, predictionId);
      const parsed = parsePredictionCSV(predCSV);
      console.log(`  Got ${parsed.length} predictions`);

      const preds = parsed.map(r => r.prediction);
      const metrics = computeMetrics(preds, closePrices.slice(0, preds.length));

      allResults.push({ label: model.label, source: 'leaderboard', metrics, predictions: preds });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : '';
      console.error(`  FAILED: ${msg}`);
      if (msg === 'fetch failed' && err instanceof Error && 'cause' in err) {
        console.error(`  Cause: ${(err as any).cause}`);
      }
      if (stack) console.error(`  Stack: ${stack.split('\n').slice(0, 3).join('\n  ')}`);
    }
  }

  // ── Also compute deployment metrics from report.json for comparison ─

  for (const model of MODELS) {
    const deploymentPreds: number[] = [];
    const deploymentActuals: number[] = [];

    for (const p of properties) {
      const pred = p.predictions[model.featureKey];
      if (pred !== null && pred !== undefined) {
        deploymentPreds.push(pred);
        deploymentActuals.push(p.closePrice);
      }
    }

    if (deploymentPreds.length > 0) {
      const metrics = computeMetrics(deploymentPreds, deploymentActuals);
      allResults.push({ label: model.label, source: 'deployment', metrics, predictions: deploymentPreds });
    }
  }

  // ── Comparison table ──────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('COMPARISON: Leaderboard vs Deployment');
  console.log('═'.repeat(80));

  const metricDefs: { key: keyof Metrics; label: string; dollar: boolean; higherBetter: boolean; absCompare: boolean }[] = [
    { key: 'count',          label: 'Count',            dollar: false, higherBetter: true,  absCompare: false },
    { key: 'mape',           label: 'MAPE',             dollar: false, higherBetter: false, absCompare: false },
    { key: 'medianErrorPct', label: 'Median Error %',   dollar: false, higherBetter: false, absCompare: false },
    { key: 'meanError',      label: 'Mean Error',       dollar: true,  higherBetter: false, absCompare: false },
    { key: 'medianError',    label: 'Median Error',     dollar: true,  higherBetter: false, absCompare: false },
    { key: 'rmse',           label: 'RMSE',             dollar: true,  higherBetter: false, absCompare: false },
    { key: 'pctWithin5',     label: 'Within 5%',        dollar: false, higherBetter: true,  absCompare: false },
    { key: 'pctWithin10',    label: 'Within 10%',       dollar: false, higherBetter: true,  absCompare: false },
    { key: 'pctWithin20',    label: 'Within 20%',       dollar: false, higherBetter: true,  absCompare: false },
    { key: 'medianSignedPct',label: 'Median Bias',      dollar: false, higherBetter: false, absCompare: true  },
    { key: 'p95ErrorPct',    label: 'P95 Error',        dollar: false, higherBetter: false, absCompare: false },
    { key: 'stdErrorPct',    label: 'Std Error %',      dollar: false, higherBetter: false, absCompare: false },
  ];

  // Group results by model label
  for (const model of MODELS) {
    const lb = allResults.find(r => r.label === model.label && r.source === 'leaderboard');
    const dp = allResults.find(r => r.label === model.label && r.source === 'deployment');

    if (!lb && !dp) continue;

    console.log(`\n  ${model.label}`);
    console.log(`  ${'Metric'.padEnd(18)} ${'Leaderboard'.padStart(14)} ${'Deployment'.padStart(14)} ${'Delta'.padStart(14)}`);
    console.log(`  ${'─'.repeat(62)}`);

    for (const md of metricDefs) {
      const lbVal = lb ? lb.metrics[md.key] : null;
      const dpVal = dp ? dp.metrics[md.key] : null;
      const fmt = (v: number | null) => {
        if (v === null) return '—';
        return md.dollar ? `$${v.toFixed(0)}` : `${v.toFixed(2)}${md.key === 'count' ? '' : '%'}`;
      };
      const delta = (lbVal !== null && dpVal !== null) ? lbVal - dpVal : null;
      const deltaStr = delta !== null ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—';

      console.log(`  ${md.label.padEnd(18)} ${fmt(lbVal).padStart(14)} ${fmt(dpVal).padStart(14)} ${deltaStr.padStart(14)}`);
    }
  }

  // ── Cross-model comparison (leaderboard only) ─────────────────────

  const lbResults = allResults.filter(r => r.source === 'leaderboard');
  if (lbResults.length === 2) {
    const [a, b] = lbResults;
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log(`HEAD-TO-HEAD (Leaderboard): ${a.label} vs ${b.label}`);
    console.log('═'.repeat(80));

    console.log(`  ${'Metric'.padEnd(18)} ${a.label.padStart(14)} ${b.label.padStart(14)} ${'Winner'.padStart(16)}`);
    console.log(`  ${'─'.repeat(64)}`);

    for (const md of metricDefs) {
      if (md.key === 'count') continue;
      const va = a.metrics[md.key];
      const vb = b.metrics[md.key];
      const fmt = (v: number) => md.dollar ? `$${v.toFixed(0)}` : `${v.toFixed(2)}%`;

      let winner: string;
      if (md.absCompare) {
        winner = Math.abs(va) < Math.abs(vb) ? a.label : b.label;
      } else if (md.higherBetter) {
        winner = va > vb ? a.label : b.label;
      } else {
        winner = va < vb ? a.label : b.label;
      }

      console.log(`  ${md.label.padEnd(18)} ${fmt(va).padStart(14)} ${fmt(vb).padStart(14)} ${winner.padStart(16)}`);
    }
  }

  // ── Save detailed results ─────────────────────────────────────────

  const outputDir = resolve(__dirname, '../app/public/data');
  mkdirSync(outputDir, { recursive: true });

  const detailedOutput = allResults.map(r => ({
    label: r.label,
    source: r.source,
    metrics: r.metrics,
    propertyPredictions: properties.slice(0, r.predictions.length).map((p, i) => ({
      listingId: p.listingId,
      closePrice: p.closePrice,
      prediction: r.predictions[i],
      errorPct: Math.abs((r.predictions[i] - p.closePrice) / p.closePrice) * 100,
      signedPct: ((r.predictions[i] - p.closePrice) / p.closePrice) * 100,
    })),
  }));

  const outputPath = resolve(outputDir, 'leaderboard-test-results.json');
  writeFileSync(outputPath, JSON.stringify(detailedOutput, null, 2));
  console.log(`\nDetailed results saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
