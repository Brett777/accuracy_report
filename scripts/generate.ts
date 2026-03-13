import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import { createPool, fetchProperties, fetchLegacyProperties, closePool } from './lib/db.js';
import { predictOnMarketQuality, predictOffMarketQuality, predictOnMarketBase, predictOffMarketBase, predictWeightedCompEstimate } from './lib/datarobot.js';
import {
  mapDbRowToOnMarketDRRow,
  mapDbRowToOffMarketDRRow,
  mapDbRowToOldOnMarketDRRow,
  mapDbRowToOldOffMarketDRRow,
  toCompInput,
  parseNumericValue,
  extractDbQualityScores,
} from './lib/featureMapper.js';
import type { DbPropertyRow, DRPrediction, DRPredictionRow, PropertyResult, ReportData, ModelKey, ErrorMetrics } from './lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BATCH_SIZE = 500;

// ── CLI args ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 7;
  let from: string | null = null;
  let to: string | null = null;
  let output = resolve(__dirname, '../app/public/data/report.json');

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--days': days = parseInt(args[++i], 10); break;
      case '--from': from = args[++i]; break;
      case '--to': to = args[++i]; break;
      case '--output': output = resolve(args[++i]); break;
    }
  }

  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = from ?? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  return { from: fromDate, to: toDate, output };
}

// ── Price band ────────────────────────────────────────────────────────

function getPriceBand(price: number): string {
  if (price < 300000) return 'Under $300K';
  if (price < 500000) return '$300K-$500K';
  if (price < 750000) return '$500K-$750K';
  if (price < 1000000) return '$750K-$1M';
  if (price < 1500000) return '$1M-$1.5M';
  if (price < 2000000) return '$1.5M-$2M';
  return '$2M+';
}

// ── Error calculation ─────────────────────────────────────────────────

function computeErrors(predicted: number | null, actual: number): ErrorMetrics | null {
  if (predicted === null || predicted <= 0) return null;
  const signed = predicted - actual;
  const absolute = Math.abs(signed);
  const signedPct = (signed / actual) * 100;
  const pct = Math.abs(signedPct);
  return { absolute, pct, signed, signedPct };
}

// ── Days since list ───────────────────────────────────────────────────

function calcDaysSinceList(row: DbPropertyRow): number {
  if (!row.ListingContractDate) return 1;
  try {
    const listDateStr = String(row.ListingContractDate).slice(0, 10);
    const listDate = new Date(listDateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - listDate.getTime()) / 86400000);
    return Math.max(1, diffDays);
  } catch { return 1; }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const { from, to, output } = parseArgs();
  console.log(`Generating report for ${from} to ${to}...`);

  // 1. Connect & fetch properties
  const db = createPool();
  console.log('Fetching properties from property_clone...');
  const properties = await fetchProperties(db, { from, to });
  console.log(`  Found ${properties.length} properties`);

  if (properties.length === 0) {
    console.log('No properties found. Exiting.');
    await closePool();
    return;
  }

  // 2. Fetch legacy property data for base (no-quality) models
  console.log('Fetching legacy property data...');
  const listingIds = properties.map(p => p.ListingId);
  const legacyMap = await fetchLegacyProperties(db, listingIds);
  console.log(`  Found ${legacyMap.size} legacy properties`);

  // 3. Score comp estimates FIRST — quality models need these as input features
  console.log('Scoring weighted comp estimates...');
  const compInputs = properties.map(p => toCompInput(p));
  const compResults: { estimate: number | null; count: number | null }[] =
    new Array(properties.length).fill(null).map(() => ({ estimate: null, count: null }));
  const COMP_BATCH_SIZE = 100;
  const compBatches = Math.ceil(properties.length / COMP_BATCH_SIZE);

  for (let i = 0; i < properties.length; i += COMP_BATCH_SIZE) {
    const batchNum = Math.floor(i / COMP_BATCH_SIZE) + 1;
    const end = Math.min(i + COMP_BATCH_SIZE, properties.length);
    console.log(`  Comp batch ${batchNum}/${compBatches} (${end - i} rows)...`);
    try {
      const results = await predictWeightedCompEstimate(compInputs.slice(i, end));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const est = r?.weighted_comp_estimate;
        compResults[i + j] = {
          estimate: (est != null && !isNaN(est) && est > 0) ? est : null,
          count: r?.comp_count ?? null,
        };
      }
    } catch (err) {
      console.warn(`  Comp batch ${batchNum} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const compScoredCount = compResults.filter(v => v.estimate !== null).length;
  console.log(`  Comp estimates scored: ${compScoredCount}/${properties.length}`);

  // 3. Hedonic index value — at inference time (predicting today's value),
  // the reference month is today, so the index is always 100 by definition.
  const HEDONIC_INDEX_VALUE = 100;

  // 4. Map feature rows — inject comp estimates and hedonic values into quality model rows
  console.log('Mapping feature rows...');
  const onMarketQualityRows: DRPredictionRow[] = [];
  const offMarketQualityRows: DRPredictionRow[] = [];
  const onMarketNoQualityRows: DRPredictionRow[] = [];
  const offMarketNoQualityRows: DRPredictionRow[] = [];

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const daysSinceList = calcDaysSinceList(prop);
    const legacyProp = legacyMap.get(prop.ListingId) ?? prop;
    const comp = compResults[i];

    // Quality model rows — inject comp estimate, comp count, and hedonic index
    const onMktRow = mapDbRowToOnMarketDRRow(prop, daysSinceList);
    onMktRow['weighted_comp_estimate'] = comp.estimate;
    onMktRow['comp_count'] = comp.count;
    onMktRow['hedonic_index_value'] = HEDONIC_INDEX_VALUE;
    onMarketQualityRows.push(onMktRow);

    const offMktRow = mapDbRowToOffMarketDRRow(prop, daysSinceList);
    offMktRow['weighted_comp_estimate'] = comp.estimate;
    offMktRow['comp_count'] = comp.count;
    offMktRow['hedonic_index_value'] = HEDONIC_INDEX_VALUE;
    offMarketQualityRows.push(offMktRow);

    // Base model rows — use legacy property table data
    onMarketNoQualityRows.push(mapDbRowToOldOnMarketDRRow(legacyProp, daysSinceList));
    offMarketNoQualityRows.push(mapDbRowToOldOffMarketDRRow(legacyProp, daysSinceList));
  }

  // 5. Batch predict — 4 models in parallel per batch
  console.log(`Scoring ${properties.length} properties across 4 models (batch size ${BATCH_SIZE})...`);
  const allOnMarketQuality: DRPrediction[] = [];
  const allOffMarketQuality: DRPrediction[] = [];
  const allOnMarketNoQuality: DRPrediction[] = [];
  const allOffMarketNoQuality: DRPrediction[] = [];

  const totalBatches = Math.ceil(properties.length / BATCH_SIZE);

  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const end = Math.min(i + BATCH_SIZE, properties.length);
    console.log(`  Batch ${batchNum}/${totalBatches} (${end - i} rows)...`);

    const [onMQ, offMQ, onMNQ, offMNQ] = await Promise.all([
      predictOnMarketQuality(onMarketQualityRows.slice(i, end)),
      predictOffMarketQuality(offMarketQualityRows.slice(i, end)),
      predictOnMarketBase(onMarketNoQualityRows.slice(i, end)),
      predictOffMarketBase(offMarketNoQualityRows.slice(i, end)),
    ]);

    allOnMarketQuality.push(...onMQ);
    allOffMarketQuality.push(...offMQ);
    allOnMarketNoQuality.push(...onMNQ);
    allOffMarketNoQuality.push(...offMNQ);
  }

  // 6. Assemble results
  console.log('Computing errors and assembling results...');
  const results: PropertyResult[] = [];

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const closePrice = parseNumericValue(prop.ClosePrice);
    if (!closePrice || closePrice <= 0) continue;

    const listPrice = parseNumericValue(prop.ListPrice);
    const closeDateRaw = prop.CloseDate ?? prop.CloseDateTimestamp?.toISOString().slice(0, 10) ?? '';
    const closeDate = typeof closeDateRaw === 'string' ? closeDateRaw.slice(0, 10) : '';
    const qualityScores = extractDbQualityScores(prop);

    const getPred = (pred: DRPrediction | undefined): number | null => {
      if (!pred) return null;
      const v = typeof pred.prediction === 'string' ? parseFloat(pred.prediction) : pred.prediction;
      return isNaN(v) ? null : v;
    };

    const predictions: Record<ModelKey, number | null> = {
      onMarketQuality: getPred(allOnMarketQuality[i]),
      offMarketQuality: getPred(allOffMarketQuality[i]),
      onMarketNoQuality: getPred(allOnMarketNoQuality[i]),
      offMarketNoQuality: getPred(allOffMarketNoQuality[i]),
      compEstimate: compResults[i].estimate,
    };

    const errors: Record<ModelKey, ErrorMetrics | null> = {
      onMarketQuality: computeErrors(predictions.onMarketQuality, closePrice),
      offMarketQuality: computeErrors(predictions.offMarketQuality, closePrice),
      onMarketNoQuality: computeErrors(predictions.onMarketNoQuality, closePrice),
      offMarketNoQuality: computeErrors(predictions.offMarketNoQuality, closePrice),
      compEstimate: computeErrors(predictions.compEstimate, closePrice),
    };

    const postalCode = prop.PostalCode ?? null;
    const fsa = postalCode ? postalCode.replace(/\s/g, '').toUpperCase().substring(0, 3) : null;

    results.push({
      listingId: prop.ListingId,
      closePrice,
      listPrice,
      closeDate,
      city: prop.City ?? null,
      board: prop.OriginatingSystemName,
      propertySubType: prop.PropertySubType ?? null,
      postalCode,
      fsa,
      sqft: parseNumericValue(prop.AboveGradeFinishedArea),
      bedrooms: parseNumericValue(prop.BedroomsPossible),
      bathrooms: parseNumericValue(prop.BathroomsFull),
      yearBuilt: prop.YearBuiltDetails ?? null,
      overallQuality: qualityScores.overallQuality,
      predictions,
      errors,
      priceBand: getPriceBand(closePrice),
    });
  }

  // 7. Write JSON
  const reportData: ReportData = {
    meta: {
      generatedAt: new Date().toISOString(),
      dateRange: { from, to },
      totalProperties: results.length,
      scriptDurationMs: Date.now() - startTime,
    },
    properties: results,
  };

  const outputDir = dirname(output);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(output, JSON.stringify(reportData, null, 2));

  // 8. Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${duration}s`);
  console.log(`  Properties: ${results.length}`);
  console.log(`  On-Market Quality scored:   ${results.filter(r => r.predictions.onMarketQuality !== null).length}`);
  console.log(`  Off-Market Quality scored:  ${results.filter(r => r.predictions.offMarketQuality !== null).length}`);
  console.log(`  On-Market No-Quality scored: ${results.filter(r => r.predictions.onMarketNoQuality !== null).length}`);
  console.log(`  Off-Market No-Quality scored: ${results.filter(r => r.predictions.offMarketNoQuality !== null).length}`);
  console.log(`  Comp Estimate available:    ${results.filter(r => r.predictions.compEstimate !== null).length}`);
  console.log(`  Hedonic Index value:        ${HEDONIC_INDEX_VALUE} (reference month)`);
  console.log(`  Output: ${output}`);

  await closePool();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  closePool().finally(() => process.exit(1));
});
