# Model Performance Report

An interactive accuracy report for DataRobot property valuation models. Queries recently sold properties from a MySQL database, runs predictions through multiple DataRobot deployments, and renders a React dashboard comparing model performance.

## Quick Start

```bash
# 1. Install dependencies
npm run setup

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Generate report data and launch dev server
npm start
```

The report will be available at `http://localhost:5173`.

## How It Works

### Data Generation (`scripts/generate.ts`)

The generate script:

1. Queries closed property sales from MySQL (Repliers database) within a configurable date range
2. Maps each property's features to the input format expected by each DataRobot model
3. Sends batch prediction requests to 5 DataRobot deployments (on-market quality, on-market base, off-market quality, off-market base, weighted comp estimate)
4. Computes error metrics (absolute, percentage, signed) for each prediction against the actual close price
5. Writes results to `app/public/data/report.json`

### Dashboard (`app/`)

A Vite + React + TypeScript frontend that reads the generated JSON and renders:

- **Summary Metrics** — median error, MAPE, % within 10%, P95 error for each model
- **Filters** — by board, city, property type, price band
- **Predicted vs Actual** — scatter plot with perfect-prediction reference line
- **Signed Error Distribution** — histogram of over/under-prediction
- **Median Error % by Price Band / Quality / Property Type / Board** — grouped bar charts with shared y-axis
- **Cumulative Error Distribution** — CDF showing % of predictions within each error threshold
- **Residuals vs Price** — all models plotted as series to compare price-dependent bias
- **Win Rate** — head-to-head tables (off-market and on-market) showing how often each model beats the other
- **Composition** — property counts by type, quality score, board, and city
- **Property Details** — sortable, paginated table of every property with predictions and errors

All charts support zoom (click & drag) and fullscreen mode.

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Install dependencies for both root and app |
| `npm run generate` | Generate report data (default: last 7 days) |
| `npm run generate:30d` | Generate report data for last 30 days |
| `npm run generate:90d` | Generate report data for last 90 days |
| `npm start` | Generate data + launch dev server |
| `npm start:30d` | Generate 30-day data + launch dev server |
| `npm start:90d` | Generate 90-day data + launch dev server |
| `npm run dev` | Launch dev server only (uses existing data) |
| `npm run build` | Production build |

### Custom Date Ranges

```bash
npm run generate -- --from 2025-01-01 --to 2025-03-01
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DR_API_KEY` | Yes | Base64-encoded `userId:apiToken` for DataRobot |
| `DR_API_BASE_URL` | Yes | DataRobot API base URL |
| `DR_ON_MARKET_QUALITY_DEPLOYMENT_ID` | Yes | On-market model with quality scores |
| `DR_OFF_MARKET_QUALITY_DEPLOYMENT_ID` | Yes | Off-market model with quality scores |
| `DR_ON_MARKET_BASE_DEPLOYMENT_ID` | Yes | On-market model without quality scores |
| `DR_OFF_MARKET_BASE_DEPLOYMENT_ID` | Yes | Off-market model without quality scores |
| `DR_COMP_ESTIMATE_DEPLOYMENT_ID` | Yes | Weighted comparable estimate model |
| `DB_HOST` | Yes | MySQL database host |
| `DB_PORT` | No | MySQL port (default: 3306) |
| `DB_USER` | Yes | MySQL username |
| `DB_PASS` | Yes | MySQL password |
| `DB_NAME` | Yes | MySQL database name |

## Models Compared

| Model | Key | Description |
|-------|-----|-------------|
| Off-Market (Quality) | `offMarketQuality` | Predicts value without list price, uses image quality scores |
| Off-Market (No Quality) | `offMarketNoQuality` | Predicts value without list price or quality scores |
| On-Market (Quality) | `onMarketQuality` | Predicts value with list price and quality scores |
| On-Market (No Quality) | `onMarketNoQuality` | Predicts value with list price, no quality scores |
| Comp Estimate | `compEstimate` | Weighted comparable property estimate |

## Tech Stack

- **Data generation**: TypeScript, mysql2, DataRobot Prediction API
- **Frontend**: React 19, Vite, Tailwind CSS, Chart.js, shadcn/ui components
