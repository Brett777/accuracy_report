import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from the working directory (should be report/)
dotenv.config({ path: resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export const config = {
  dataRobot: {
    baseUrl: requireEnv('DR_API_BASE_URL'),
    apiKey: requireEnv('DR_API_KEY'),
    onMarketQualityDeploymentId: requireEnv('DR_ON_MARKET_QUALITY_DEPLOYMENT_ID'),
    offMarketQualityDeploymentId: requireEnv('DR_OFF_MARKET_QUALITY_DEPLOYMENT_ID'),
    onMarketBaseDeploymentId: optionalEnv('DR_ON_MARKET_BASE_DEPLOYMENT_ID', '688796baf9e189bc35fa586c'),
    offMarketBaseDeploymentId: optionalEnv('DR_OFF_MARKET_BASE_DEPLOYMENT_ID', '6886c0b032d426ccafb983c8'),
    compEstimateDeploymentId: optionalEnv('DR_COMP_ESTIMATE_DEPLOYMENT_ID', '6954cbb890167e52edcfe674'),
    hedonicIndexDeploymentId: optionalEnv('DR_HEDONIC_INDEX_DEPLOYMENT_ID', '69372e3d384111b63582c4b2'),
    serverUrl: optionalEnv('DR_SERVER_URL', 'https://app.datarobot.com'),
  },
  database: {
    host: requireEnv('DB_HOST'),
    port: parseInt(optionalEnv('DB_PORT', '3306'), 10),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASS'),
    database: requireEnv('DB_NAME'),
  },
};
