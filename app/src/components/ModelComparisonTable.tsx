import type { ModelKey, ModelMetrics } from '../types';
import { MODEL_KEYS, MODEL_LABELS } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCurrency, formatPct } from '../lib/format';

interface Props {
  metrics: Record<ModelKey, ModelMetrics>;
}

type MetricRow = {
  label: string;
  getValue: (m: ModelMetrics) => string;
  getRaw: (m: ModelMetrics) => number;
  lowerIsBetter: boolean;
};

const METRIC_ROWS: MetricRow[] = [
  { label: 'Median Error', getValue: m => formatCurrency(m.medianError), getRaw: m => m.medianError, lowerIsBetter: true },
  { label: 'Median Error %', getValue: m => formatPct(m.medianErrorPct), getRaw: m => m.medianErrorPct, lowerIsBetter: true },
  { label: 'MAPE', getValue: m => formatPct(m.mape), getRaw: m => m.mape, lowerIsBetter: true },
  { label: 'Within 10%', getValue: m => formatPct(m.pctWithin10), getRaw: m => m.pctWithin10, lowerIsBetter: false },
  { label: 'P95 Error %', getValue: m => formatPct(m.p95ErrorPct), getRaw: m => m.p95ErrorPct, lowerIsBetter: true },
  { label: 'Scored', getValue: m => String(m.count), getRaw: m => m.count, lowerIsBetter: false },
];

// Column order: Off-Market Quality, Off-Market No Quality, On-Market Quality, On-Market No Quality, Comp Estimate
const COLUMN_ORDER: ModelKey[] = [
  'offMarketQuality', 'offMarketNoQuality',
  'onMarketQuality', 'onMarketNoQuality',
  'compEstimate',
];

export function ModelComparisonTable({ metrics }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Model Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground" />
                <th colSpan={2} className="text-center py-1 px-3 font-semibold text-muted-foreground border-b border-border/50">Off-Market</th>
                <th colSpan={2} className="text-center py-1 px-3 font-semibold text-muted-foreground border-b border-border/50">On-Market</th>
                <th className="text-center py-1 px-3 font-semibold text-muted-foreground border-b border-border/50">Comp</th>
              </tr>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Metric</th>
                {COLUMN_ORDER.map(key => (
                  <th key={key} className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">
                    {MODEL_LABELS[key].replace(/^(On|Off)-Market\s*/, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map(row => {
                // Find best value among off-market pair and on-market pair separately
                const offMarketPair: ModelKey[] = ['offMarketQuality', 'offMarketNoQuality'];
                const onMarketPair: ModelKey[] = ['onMarketQuality', 'onMarketNoQuality'];

                const bestInGroup = (group: ModelKey[]): number | null => {
                  const scored = group.filter(k => metrics[k].count > 0);
                  if (scored.length < 2) return null;
                  const vals = scored.map(k => row.getRaw(metrics[k]));
                  return row.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
                };

                const offBest = bestInGroup(offMarketPair);
                const onBest = bestInGroup(onMarketPair);

                return (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    {COLUMN_ORDER.map(key => {
                      const val = row.getRaw(metrics[key]);
                      const isBestOff = offMarketPair.includes(key) && offBest !== null && val === offBest && metrics[key].count > 0;
                      const isBestOn = onMarketPair.includes(key) && onBest !== null && val === onBest && metrics[key].count > 0;
                      const isBest = isBestOff || isBestOn;
                      return (
                        <td
                          key={key}
                          className={`text-right py-2 px-3 font-mono ${isBest ? 'text-green-500 font-semibold' : ''}`}
                        >
                          {row.getValue(metrics[key])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
