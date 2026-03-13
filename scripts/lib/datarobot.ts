import { config } from './config.js';
import type { DRPredictionRow, DRPrediction, DRPredictionResponse, WeightedCompEstimateInput, WeightedCompEstimateResult, HedonicIndexInput, HedonicIndexResult } from './types.js';

function getAuthHeaders(contentType = 'application/json; charset=UTF-8'): Record<string, string> {
  const apiKey = config.dataRobot.apiKey;
  const isBase64 = !apiKey.includes(':') && /^[A-Za-z0-9+/=]+$/.test(apiKey) && apiKey.length > 50;

  return {
    'Content-Type': contentType,
    'Authorization': isBase64 ? `Basic ${apiKey}` : `Bearer ${apiKey}`,
  };
}

export async function postPredictions(
  deploymentId: string,
  rows: DRPredictionRow[]
): Promise<DRPrediction[]> {
  const baseUrl = config.dataRobot.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/v2/deployments/${deploymentId}/predictions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`DR prediction failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const data = (await response.json()) as DRPredictionResponse;
  return data.data;
}

export async function predictOnMarketQuality(rows: DRPredictionRow[]): Promise<DRPrediction[]> {
  return postPredictions(config.dataRobot.onMarketQualityDeploymentId, rows);
}

export async function predictOffMarketQuality(rows: DRPredictionRow[]): Promise<DRPrediction[]> {
  return postPredictions(config.dataRobot.offMarketQualityDeploymentId, rows);
}

export async function predictOnMarketBase(rows: DRPredictionRow[]): Promise<DRPrediction[]> {
  return postPredictions(config.dataRobot.onMarketBaseDeploymentId, rows);
}

export async function predictOffMarketBase(rows: DRPredictionRow[]): Promise<DRPrediction[]> {
  return postPredictions(config.dataRobot.offMarketBaseDeploymentId, rows);
}

export async function predictWeightedCompEstimate(inputs: WeightedCompEstimateInput[]): Promise<WeightedCompEstimateResult[]> {
  const serverUrl = config.dataRobot.serverUrl.replace(/\/+$/, '');
  const deploymentId = config.dataRobot.compEstimateDeploymentId;
  const url = `${serverUrl}/api/v2/deployments/${deploymentId}/predictionsUnstructured`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders('application/json'),
      body: JSON.stringify(inputs),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Comp estimate failed (${response.status}): ${errorBody.slice(0, 500)}`);
    }

    let responseText = await response.text();
    // The API returns NaN for missing comp values
    responseText = responseText.replace(/:\s*NaN\s*([,}])/g, ': null$1');
    return JSON.parse(responseText) as WeightedCompEstimateResult[];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Comp estimate timed out after 120s');
    }
    throw error;
  }
}

export async function predictHedonicIndex(inputs: HedonicIndexInput[]): Promise<HedonicIndexResult[]> {
  const serverUrl = config.dataRobot.serverUrl.replace(/\/+$/, '');
  const deploymentId = config.dataRobot.hedonicIndexDeploymentId;
  const url = `${serverUrl}/api/v2/deployments/${deploymentId}/predictionsUnstructured`;

  // Build CSV — the hedonic model expects CSV format
  const csvHeader = 'CurrentPrice,LookbackDays,City,PropertyType,PropertySubType,ReferenceDate';
  const csvRows = inputs.map(input => [
    input.CurrentPrice,
    input.LookbackDays,
    input.City,
    input.PropertyType ?? '',
    input.PropertySubType,
    input.ReferenceDate ?? '',
  ].join(','));
  const csvData = [csvHeader, ...csvRows].join('\n');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders('text/csv'),
      body: csvData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Hedonic index failed (${response.status}): ${errorBody.slice(0, 500)}`);
    }

    return await response.json() as HedonicIndexResult[];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Hedonic index timed out after 120s');
    }
    throw error;
  }
}
